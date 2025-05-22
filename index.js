require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { TikTokLiveConnection } = require('tiktok-live-connector');

// Lecture de la liste d’influenceurs et intervalle depuis .env
const INFLUENCERS = process.env.INFLUENCERS.split(',');
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 30000;

// Initialisation Express + CORS
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN }));

// Serveur HTTP + WebSocket
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN }
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur actif sur le port ${PORT}`);
});

// État live de chaque influenceur
const states = {};
INFLUENCERS.forEach(id => states[id] = false);

// Pour chaque influenceur, on lance le polling
INFLUENCERS.forEach(uniqueId => {
  const conn = new TikTokLiveConnection(uniqueId, {
    processInitialData: false,
    fetchRoomInfoOnConnect: false
  });

  async function checkLive() {
    try {
      const { isLive } = await conn.fetchIsLive();
      const prev = states[uniqueId];
      if (!prev && isLive) {
        states[uniqueId] = true;
        io.emit('live-start', { uniqueId, timestamp: Date.now() });
      }
      if (prev && !isLive) {
        states[uniqueId] = false;
        io.emit('live-end', { uniqueId, timestamp: Date.now() });
      }
    } catch (err) {
      console.error(`Erreur pour ${uniqueId}:`, err.message);
    } finally {
      setTimeout(checkLive, POLL_INTERVAL_MS);
    }
  }

  checkLive();
});
