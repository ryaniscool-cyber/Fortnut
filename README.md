# Fortnut Multiplayer Prototype

## Framework & Networking Model
- **Client**: JavaScript + Three.js + WebGL (Vite dev server)
- **Server**: Node.js authoritative simulation using WebSockets (`ws`)

## Folder Structure
```
Fortnut/
├── client/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       └── main.js
├── server/
│   ├── package.json
│   └── server.js
├── shared/
│   └── constants.js
└── README.md
```

## Setup & Run
1. **Server**
   ```bash
   cd server
   npm install
   npm run start
   ```
2. **Client**
   ```bash
   cd client
   npm install
   npm run dev
   ```
3. Open the client at `http://localhost:5173`.

## Controls
- **Movement**: WASD
- **Sprint**: Left Shift
- **Crouch**: Left Ctrl
- **Jump**: Space
- **Shoot**: Mouse left
- **Reload**: R
- **Harvest**: E
- **Build**: Q (wall), F (floor), V (ramp)
- **Destroy build**: X
- **Weapons**: 1-4
- **Look**: Mouse (click to lock pointer)

## Multiplayer Architecture (Authoritative Server)
- Server is the source of truth for player positions, health, weapons, storm, builds, and resource nodes.
- Clients only send inputs; the server validates and simulates everything, then broadcasts snapshots.

### Client → Server Sync
- **Player Movement**: Send input state (`forward`, `backward`, `left`, `right`, `jump`, `sprint`, `crouch`) + aim direction.
- **Shooting**: Send `shoot` input; server checks fire rate, ammo, range, and hit detection.
- **Building**: Send build requests with type; server validates placement/grid collisions/resources.
- **Storm Damage**: Server checks distance to storm each tick and applies damage.
- **Join/Leave**: Server assigns ID on connect and removes player on disconnect.
- **Anti-cheat**: Server clamps movement to max speed, enforces ammo/weapon fire rate, validates builds.

### Server → Client Sync
- **State Snapshot**: Broadcasts players, builds, resource nodes, storm, and inventory ammo counts each tick.

## Gameplay Systems
- **Third-person shooter**: Camera follows behind player with mouse look and player movement.
- **Weapons**: AR, Shotgun, Sniper, SMG with unique fire rates, spread, and damage.
- **Health & Shield**: Shield absorbs damage first; respawn after elimination.
- **Building**: Walls, floors, ramps with grid snapping and resource cost.
- **Resources**: Harvest wood, stone, metal from nodes.
- **Storm**: Shrinks over time and damages players outside the safe zone.
- **AI Bots**: Server-controlled bots roam, aim, and shoot at players.
