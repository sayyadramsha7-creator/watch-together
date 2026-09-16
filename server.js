const path = require("path");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const db = new Database("watchtogether.db");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  url TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-secret-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly:true, sameSite:"lax", secure:false }
}));
app.use(express.static(path.join(__dirname, "public")));

function user(req) {
  if (!req.session.userId) return null;
  return db.prepare("SELECT id, username FROM users WHERE id=?").get(req.session.userId);
}
function makeCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

app.post("/api/register", async (req,res) => {
  const {username,password} = req.body;
  if (!username || !password || username.length < 3 || password.length < 6)
    return res.status(400).json({error:"Username must be 3+ characters and password 6+ characters."});
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare("INSERT INTO users (username,password) VALUES (?,?)").run(username.trim(), hash);
    req.session.userId = result.lastInsertRowid;
    res.json({user:{username:username.trim()}});
  } catch {
    res.status(409).json({error:"That username is already taken."});
  }
});

app.post("/api/login", async (req,res) => {
  const row = db.prepare("SELECT * FROM users WHERE username=?").get((req.body.username||"").trim());
  if (!row || !(await bcrypt.compare(req.body.password||"", row.password)))
    return res.status(401).json({error:"Invalid username or password."});
  req.session.userId = row.id;
  res.json({user:{username:row.username}});
});

app.post("/api/logout",(req,res)=>{
  req.session.destroy(()=>res.json({ok:true}));
});

app.get("/api/me",(req,res)=>{
  const u=user(req);
  res.json({user:u});
});

app.post("/api/rooms",(req,res)=>{
  const u=user(req);
  if (!u) return res.status(401).json({error:"Login required."});
  let code;
  do { code=makeCode(); } while(db.prepare("SELECT 1 FROM rooms WHERE code=?").get(code));
  const name=(req.body.name||"Movie Night").trim().slice(0,80);
  db.prepare("INSERT INTO rooms (code,name,owner_id) VALUES (?,?,?)").run(code,name,u.id);
  res.json({code,name});
});

app.get("/api/rooms/:code",(req,res)=>{
  const room=db.prepare(`
    SELECT rooms.code, rooms.name, rooms.url, users.username AS owner
    FROM rooms JOIN users ON users.id=rooms.owner_id WHERE rooms.code=?
  `).get(req.params.code.toUpperCase());
  if(!room) return res.status(404).json({error:"Room not found."});
  res.json(room);
});

app.post("/api/rooms/:code/url",(req,res)=>{
  const u=user(req);
  if(!u) return res.status(401).json({error:"Login required."});
  const room=db.prepare("SELECT * FROM rooms WHERE code=?").get(req.params.code.toUpperCase());
  if(!room) return res.status(404).json({error:"Room not found."});
  const url=(req.body.url||"").trim();
  db.prepare("UPDATE rooms SET url=? WHERE code=?").run(url,room.code);
  io.to(room.code).emit("media:url",{url});
  res.json({ok:true,url});
});

io.on("connection", socket=>{
  socket.on("room:join", ({code,username})=>{
    code=(code||"").toUpperCase();
    socket.join(code);
    socket.data.room=code;
    socket.data.username=username||"Guest";
    socket.to(code).emit("room:message",{system:true,text:`${socket.data.username} joined the room.`});
  });

  socket.on("chat:message", ({text})=>{
    const code=socket.data.room;
    if(!code || !text || !text.trim()) return;
    io.to(code).emit("room:message",{username:socket.data.username,text:text.trim().slice(0,500)});
  });

  socket.on("media:play", ({time})=>{
    if(socket.data.room) socket.to(socket.data.room).emit("media:play",{time});
  });
  socket.on("media:pause", ({time})=>{
    if(socket.data.room) socket.to(socket.data.room).emit("media:pause",{time});
  });
  socket.on("media:seek", ({time})=>{
    if(socket.data.room) socket.to(socket.data.room).emit("media:seek",{time});
  });
  socket.on("disconnect",()=>{
    if(socket.data.room)
      socket.to(socket.data.room).emit("room:message",{system:true,text:`${socket.data.username} left the room.`});
  });
});

app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"public","index.html"));
});

const PORT=process.env.PORT || 3000;
server.listen(PORT,()=>console.log(`Watch Together running on port ${PORT}`));