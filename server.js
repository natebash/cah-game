// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  pingInterval: 25000,
  pingTimeout: 20000,
});

// In production, Vite builds the frontend to the 'dist' directory.
// This line serves all the static assets from that directory.
app.use(express.static(path.join(__dirname, 'dist')));

// The rest of your API routes and socket handlers can go here.
// For a single-page app, you'll often want to send the index.html
// for any routes that don't match a static file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Pass the io instance to the game manager and socket handlers
const { setIo } = require('./server/gameManager');
setIo(io);

const initializeSocketHandlers = require('./server/socketHandlers');
initializeSocketHandlers(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
