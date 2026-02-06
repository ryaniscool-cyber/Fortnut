# Fortnite-Style Multiplayer Game

## Features
- Third-person shooter: run, sprint, crouch, jump
- Weapons: AR, Shotgun, SMG, Sniper
- Health, Shields, Ammo
- Building: Walls, Ramps, Floors
- Resource harvesting: Wood, Stone, Metal
- Shrinking storm circle
- Server-authoritative multiplayer
- AI bots

## Tech Stack
- Client: Three.js + WebGL + JavaScript
- Server: Node.js + WebSockets
- Packaging: Electron for Windows `.exe`

## Setup
1. Install dependencies: `npm install`
2. Start server: `npm run server`
3. Start client in Electron: `npm run start`
4. Development (server + client concurrently): `npm run dev`
5. Build Windows `.exe`: `npm run build`

## Controls
- W/A/S/D: Move
- Shift: Sprint
- Space: Jump
- Ctrl: Crouch
- Mouse: Aim & Shoot
- 1/2/3/4: Switch Weapons
- F: Build Wall
- G: Build Ramp
- H: Build Floor
