module.exports = {
  PLAYER_SPEED: 0.2,
  SPRINT_MULTIPLIER: 1.5,
  JUMP_HEIGHT: 0.3,
  WEAPONS: {
    AR: { damage: 10, fireRate: 200, ammo: 30 },
    SHOTGUN: { damage: 25, fireRate: 800, ammo: 8 },
    SMG: { damage: 5, fireRate: 100, ammo: 50 },
    SNIPER: { damage: 80, fireRate: 1200, ammo: 5 }
  },
  BUILD_TYPES: ['wall', 'ramp', 'floor'],
  RESOURCE_TYPES: ['wood', 'stone', 'metal'],
  STORM_DAMAGE: 0.5,
  TICK_RATE: 60
};
