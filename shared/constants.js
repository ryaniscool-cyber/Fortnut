export const TICK_RATE = 20;
export const MAP_SIZE = 500;
export const PLAYER_RADIUS = 1;
export const PLAYER_HEIGHT = 1.8;
export const MAX_PLAYERS = 64;
export const STARTING_RESOURCES = { wood: 150, stone: 100, metal: 50 };
export const MAX_HEALTH = 100;
export const MAX_SHIELD = 100;
export const BUILD_GRID = 4;
export const BUILD_TYPES = {
  wall: { cost: { wood: 10 }, hp: 250, size: { x: 4, y: 3, z: 0.2 } },
  floor: { cost: { wood: 8 }, hp: 200, size: { x: 4, y: 0.2, z: 4 } },
  ramp: { cost: { wood: 12 }, hp: 200, size: { x: 4, y: 3, z: 4 } },
};
export const WEAPONS = {
  ar: { name: "AR", damage: 24, fireRate: 8, range: 120, spread: 0.04, magazine: 30, reload: 2.2 },
  shotgun: { name: "Shotgun", damage: 12, pellets: 8, fireRate: 1.1, range: 45, spread: 0.14, magazine: 6, reload: 2.8 },
  sniper: { name: "Sniper", damage: 90, fireRate: 0.6, range: 200, spread: 0.005, magazine: 4, reload: 3.0 },
  smg: { name: "SMG", damage: 16, fireRate: 11, range: 80, spread: 0.06, magazine: 40, reload: 2.0 },
};
export const STORM = {
  startRadius: 220,
  endRadius: 40,
  shrinkDuration: 240,
  damagePerSecond: 5,
};
export const BOT_COUNT = 6;
export const GRAVITY = -18;
export const JUMP_VELOCITY = 8.5;
export const MAX_SPEED = 8;
export const SPRINT_SPEED = 12;
export const CROUCH_SPEED = 4;
