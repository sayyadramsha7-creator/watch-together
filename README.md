# Watch Together — starter MVP

## Run locally
1. Install Node.js 18+.
2. Open this folder in a terminal.
3. Run:
   npm install
   npm start
4. Open http://localhost:3000

## What is included
- Account registration/login
- SQLite database for users and rooms
- Create/join rooms with invite codes
- Room chat using Socket.IO
- Shared direct-video URL
- Synchronized play/pause/seek for HTML5-compatible videos
- Basic web search button

## Important limitation
A normal web page cannot freely embed every streaming website. Many services block iframes or automated playback. This starter therefore uses a direct video URL in the HTML5 player. A production version can add supported providers and/or a more sophisticated synchronized browsing architecture, subject to each site's terms and technical restrictions.

## Production
Before deploying publicly:
- Set a strong SESSION_SECRET environment variable.
- Use HTTPS.
- Use a production session store instead of the default MemoryStore.
- Add rate limiting, CSRF protection, validation, and account recovery.
- Use a managed database if scaling beyond a small group.
