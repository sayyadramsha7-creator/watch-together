const $=id=>document.getElementById(id);
let me=null, room=null, socket=null, suppress=false;

async function api(url,opts={}) {
  const r=await fetch(url,{headers:{"Content-Type":"application/json"},...opts});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||"Something went wrong");
  return data;
}
function show(id){["auth","home","room"].forEach(x=>$(x).classList.toggle("hidden",x!==id));}
function msg(t,system=false){$("messages").insertAdjacentHTML("beforeend",`<div class="${system?"msg system":"msg"}">${escapeHtml(t)}</div>`);$("messages").scrollTop=$("messages").scrollHeight}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

async function openRoom(code){
  room=await api("/api/rooms/"+code);
  $("roomTitle").textContent=room.name;
  $("roomCode").textContent="Code: "+room.code;
  $("videoUrl").value=room.url||"";
  show("room");
  socket=io();
  socket.emit("room:join",{code:room.code,username:me.username});
  socket.on("room:message",m=>msg(m.system?m.text:`${m.username}: ${m.text}`,m.system));
  socket.on("media:url",m=>{ $("videoUrl").value=m.url; loadVideo(m.url); });
  socket.on("media:play",m=>{const v=$("video");suppress=true;v.currentTime=m.time;v.play().finally(()=>suppress=false)});
  socket.on("media:pause",m=>{const v=$("video");suppress=true;v.currentTime=m.time;v.pause();suppress=false});
  socket.on("media:seek",m=>{const v=$("video");suppress=true;v.currentTime=m.time;suppress=false});
  if(room.url) loadVideo(room.url);
}
function loadVideo(url){
  $("video").src=url;
  $("video").load();
}

$("login").onclick=async()=>{
  try{const d=await api("/api/login",{method:"POST",body:JSON.stringify({username:$("username").value,password:$("password").value})});me=d.user;$("logout").classList.remove("hidden");show("home");}
  catch(e){$("authMsg").textContent=e.message}
};
$("register").onclick=async()=>{
  try{const d=await api("/api/register",{method:"POST",body:JSON.stringify({username:$("username").value,password:$("password").value})});me=d.user;$("logout").classList.remove("hidden");show("home");}
  catch(e){$("authMsg").textContent=e.message}
};
$("logout").onclick=async()=>{await api("/api/logout",{method:"POST"});location.reload()};
$("createRoom").onclick=async()=>{
  try{const d=await api("/api/rooms",{method:"POST",body:JSON.stringify({name:$("roomName").value})});location.hash=d.code;openRoom(d.code)}
  catch(e){alert(e.message)}
};
$("joinRoom").onclick=()=>{const c=$("joinCode").value.trim().toUpperCase();if(c) {location.hash=c;openRoom(c).catch(e=>alert(e.message))}};
$("copyInvite").onclick=async()=>{
  const link=location.origin+location.pathname+"#"+room.code;
  await navigator.clipboard.writeText(link);$("copyInvite").textContent="Copied ✓";setTimeout(()=>$("copyInvite").textContent="Copy invite",1200);
};
$("loadVideo").onclick=async()=>{
  const url=$("videoUrl").value.trim();
  if(!url)return;
  try{await api("/api/rooms/"+room.code+"/url",{method:"POST",body:JSON.stringify({url})});loadVideo(url)}catch(e){alert(e.message)}
};

$("video").addEventListener("play",()=>{if(!suppress&&socket)socket.emit("media:play",{time:$("video").currentTime})});
$("video").addEventListener("pause",()=>{if(!suppress&&socket)socket.emit("media:pause",{time:$("video").currentTime})});
$("video").addEventListener("seeked",()=>{if(!suppress&&socket)socket.emit("media:seek",{time:$("video").currentTime})});

$("chatForm").onsubmit=e=>{e.preventDefault();const text=$("chatInput").value.trim();if(text&&socket){socket.emit("chat:message",{text});$("chatInput").value=""}};
$("searchForm").onsubmit=e=>{
  e.preventDefault();
  const q=$("searchInput").value.trim();if(!q)return;
  const google="https://www.google.com/search?q="+encodeURIComponent(q);
  $("searchResults").innerHTML=`<div class="result">Search opened in a new tab: <a href="${google}" target="_blank" rel="noopener">Search for "${escapeHtml(q)}"</a></div>`;
  window.open(google,"_blank","noopener");
};

(async()=>{
  try{
    const d=await api("/api/me");
    if(d.user){me=d.user;$("logout").classList.remove("hidden");
      if(location.hash){await openRoom(location.hash.slice(1));}else show("home");
    } else show("auth");
  }catch{show("auth")}
})();