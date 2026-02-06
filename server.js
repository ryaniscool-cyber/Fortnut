const WebSocket = require('ws');
const { PLAYER_SPEED, TICK_RATE, STORM_DAMAGE } = require('./constants');
const MESSAGES = require('./messages');

const wss = new WebSocket.Server({ port: 8080 });
let players = {};
let stormRadius = 50;

console.log('Server running on ws://localhost:8080');

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

function tick() {
  // Storm shrink
  stormRadius = Math.max(0, stormRadius - 0.01);

  // Apply storm damage
  Object.values(players).forEach(player => {
    const dist = Math.hypot(player.x, player.z);
    if (dist > stormRadius) {
      player.health -= STORM_DAMAGE;
      if (player.health <= 0) player.health = 0;
    }
  });

  broadcast({ type: MESSAGES.GAME_STATE, players, stormRadius });
}

wss.on('connection', ws => {
  const id = Date.now();
  players[id] = { id, x: 0, y: 0, z: 0, health: 100, shield: 100 };
  broadcast({ type: MESSAGES.PLAYER_JOIN, player: players[id] });

  ws.on('message', message => {
    const msg = JSON.parse(message);
    switch (msg.type) {
      case MESSAGES.PLAYER_UPDATE:
        const p = players[id];
        p.x = msg.x;
        p.y = msg.y;
        p.z = msg.z;
        p.rotation = msg.rotation;
        break;
      case MESSAGES.PLAYER_SHOOT:
        break;
      case MESSAGES.BUILD_PLACE:
        break;
      case MESSAGES.BUILD_DESTROY:
        break;
    }
  });

  ws.on('close', () => {
    delete players[id];
    broadcast({ type: MESSAGES.PLAYER_LEAVE, id });
  });
});

setInterval(tick, 1000 / TICK_RATE);
