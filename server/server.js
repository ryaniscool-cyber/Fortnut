import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";
import {
  TICK_RATE,
  MAP_SIZE,
  PLAYER_RADIUS,
  MAX_PLAYERS,
  STARTING_RESOURCES,
  MAX_HEALTH,
  MAX_SHIELD,
  BUILD_GRID,
  BUILD_TYPES,
  WEAPONS,
  STORM,
  BOT_COUNT,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_SPEED,
  SPRINT_SPEED,
  CROUCH_SPEED,
} from "../shared/constants.js";

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

const clients = new Map();
const players = new Map();
const builds = new Map();
const resourceNodes = new Map();
const pendingRespawns = new Map();

const storm = {
  radius: STORM.startRadius,
  center: { x: 0, y: 0, z: 0 },
  time: 0,
};

const world = {
  size: MAP_SIZE,
  bounds: MAP_SIZE / 2,
};

const randomInRange = (min, max) => Math.random() * (max - min) + min;

const createResourceNodes = () => {
  const nodes = [];
  for (let i = 0; i < 80; i += 1) {
    nodes.push({
      id: randomUUID(),
      type: "wood",
      position: { x: randomInRange(-200, 200), y: 0, z: randomInRange(-200, 200) },
      hp: 50,
    });
  }
  for (let i = 0; i < 40; i += 1) {
    nodes.push({
      id: randomUUID(),
      type: "stone",
      position: { x: randomInRange(-220, 220), y: 0, z: randomInRange(-220, 220) },
      hp: 70,
    });
  }
  for (let i = 0; i < 25; i += 1) {
    nodes.push({
      id: randomUUID(),
      type: "metal",
      position: { x: randomInRange(-240, 240), y: 0, z: randomInRange(-240, 240) },
      hp: 90,
    });
  }
  nodes.forEach((node) => resourceNodes.set(node.id, node));
};

createResourceNodes();

const createPlayer = ({ id, name, isBot }) => ({
  id,
  name,
  isBot,
  position: { x: randomInRange(-40, 40), y: 0, z: randomInRange(-40, 40) },
  velocity: { x: 0, y: 0, z: 0 },
  yaw: 0,
  pitch: 0,
  health: MAX_HEALTH,
  shield: MAX_SHIELD,
  resources: { ...STARTING_RESOURCES },
  inventory: {
    ar: { ...WEAPONS.ar, ammo: WEAPONS.ar.magazine, reserve: 120 },
    shotgun: { ...WEAPONS.shotgun, ammo: WEAPONS.shotgun.magazine, reserve: 30 },
    sniper: { ...WEAPONS.sniper, ammo: WEAPONS.sniper.magazine, reserve: 12 },
    smg: { ...WEAPONS.smg, ammo: WEAPONS.smg.magazine, reserve: 160 },
  },
  activeWeapon: "ar",
  input: {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    crouch: false,
    jump: false,
    shoot: false,
    reload: false,
    build: null,
    aimDir: { x: 0, y: 0, z: -1 },
    harvest: false,
  },
  onGround: true,
  lastShot: 0,
  reloadUntil: 0,
  eliminations: 0,
});

const broadcast = (data) => {
  const payload = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
};

const sendTo = (id, data) => {
  const client = clients.get(id);
  if (client && client.readyState === client.OPEN) {
    client.send(JSON.stringify(data));
  }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const applyDamage = (player, amount, sourceId) => {
  let remaining = amount;
  if (player.shield > 0) {
    const shieldDamage = Math.min(player.shield, remaining);
    player.shield -= shieldDamage;
    remaining -= shieldDamage;
  }
  if (remaining > 0) {
    player.health = Math.max(0, player.health - remaining);
  }
  if (player.health <= 0) {
    scheduleRespawn(player);
    if (sourceId && players.has(sourceId)) {
      players.get(sourceId).eliminations += 1;
    }
  }
};

const scheduleRespawn = (player) => {
  pendingRespawns.set(player.id, Date.now() + 4000);
  player.health = 0;
  player.shield = 0;
  player.input.shoot = false;
};

const respawnPlayers = () => {
  const now = Date.now();
  pendingRespawns.forEach((time, id) => {
    if (now >= time && players.has(id)) {
      const player = players.get(id);
      player.position = { x: randomInRange(-30, 30), y: 0, z: randomInRange(-30, 30) };
      player.velocity = { x: 0, y: 0, z: 0 };
      player.health = MAX_HEALTH;
      player.shield = MAX_SHIELD * 0.5;
      player.resources = { ...STARTING_RESOURCES };
      player.inventory.ar.ammo = WEAPONS.ar.magazine;
      player.inventory.ar.reserve = 120;
      pendingRespawns.delete(id);
    }
  });
};

const isBuildColliding = (position, size) => {
  for (const build of builds.values()) {
    const dx = Math.abs(build.position.x - position.x);
    const dz = Math.abs(build.position.z - position.z);
    if (dx < (build.size.x + size.x) / 2 && dz < (build.size.z + size.z) / 2) {
      return true;
    }
  }
  return false;
};

const tryPlaceBuild = (player, buildRequest) => {
  if (!buildRequest) return;
  const { type } = buildRequest;
  const config = BUILD_TYPES[type];
  if (!config) return;

  const distance = 6;
  const targetX = player.position.x + player.input.aimDir.x * distance;
  const targetZ = player.position.z + player.input.aimDir.z * distance;
  const snapX = Math.round(targetX / BUILD_GRID) * BUILD_GRID;
  const snapZ = Math.round(targetZ / BUILD_GRID) * BUILD_GRID;
  const position = { x: clamp(snapX, -world.bounds, world.bounds), y: 0, z: clamp(snapZ, -world.bounds, world.bounds) };

  const hasResources = Object.entries(config.cost).every(
    ([key, value]) => player.resources[key] >= value
  );
  if (!hasResources) return;
  if (isBuildColliding(position, config.size)) return;

  Object.entries(config.cost).forEach(([key, value]) => {
    player.resources[key] -= value;
  });

  const build = {
    id: randomUUID(),
    type,
    position,
    rotation: buildRequest.rotation || 0,
    hp: config.hp,
    size: config.size,
  };
  builds.set(build.id, build);
};

const tryDestroyBuild = (player) => {
  const range = 5;
  for (const build of builds.values()) {
    const dx = build.position.x - player.position.x;
    const dz = build.position.z - player.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < range) {
      build.hp -= 50;
      if (build.hp <= 0) {
        builds.delete(build.id);
      }
      return;
    }
  }
};

const performHarvest = (player) => {
  const range = 4;
  for (const node of resourceNodes.values()) {
    const dx = node.position.x - player.position.x;
    const dz = node.position.z - player.position.z;
    if (Math.hypot(dx, dz) < range && node.hp > 0) {
      node.hp -= 10;
      player.resources[node.type] = (player.resources[node.type] || 0) + 5;
      if (node.hp <= 0) {
        resourceNodes.delete(node.id);
      }
      return;
    }
  }
};

const rayHitsPlayer = (origin, direction, target) => {
  const toTarget = {
    x: target.position.x - origin.x,
    y: target.position.y + 1 - origin.y,
    z: target.position.z - origin.z,
  };
  const projection = toTarget.x * direction.x + toTarget.y * direction.y + toTarget.z * direction.z;
  if (projection <= 0) return null;
  const closest = {
    x: origin.x + direction.x * projection,
    y: origin.y + direction.y * projection,
    z: origin.z + direction.z * projection,
  };
  const distance = Math.hypot(
    closest.x - target.position.x,
    closest.y - (target.position.y + 1),
    closest.z - target.position.z
  );
  if (distance <= PLAYER_RADIUS) {
    return projection;
  }
  return null;
};

const fireWeapon = (player) => {
  const weapon = player.inventory[player.activeWeapon];
  if (!weapon || weapon.ammo <= 0) return;

  const now = Date.now();
  if (now < player.reloadUntil) return;
  const fireDelay = 1000 / weapon.fireRate;
  if (now - player.lastShot < fireDelay) return;

  player.lastShot = now;
  weapon.ammo -= 1;

  const pellets = weapon.pellets || 1;
  let hitId = null;

  for (let i = 0; i < pellets; i += 1) {
    const spreadX = (Math.random() - 0.5) * weapon.spread;
    const spreadY = (Math.random() - 0.5) * weapon.spread;
    const spreadZ = (Math.random() - 0.5) * weapon.spread;
    const direction = {
      x: player.input.aimDir.x + spreadX,
      y: player.input.aimDir.y + spreadY,
      z: player.input.aimDir.z + spreadZ,
    };
    const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
    direction.x /= length;
    direction.y /= length;
    direction.z /= length;

    let closest = { id: null, dist: Infinity };
    players.forEach((target) => {
      if (target.id === player.id || target.health <= 0) return;
      const hitDist = rayHitsPlayer(player.position, direction, target);
      if (hitDist !== null && hitDist < closest.dist && hitDist <= weapon.range) {
        closest = { id: target.id, dist: hitDist };
      }
    });

    if (closest.id) {
      const target = players.get(closest.id);
      if (target) {
        applyDamage(target, weapon.damage, player.id);
        hitId = target.id;
      }
    }
  }

  if (hitId) {
    sendTo(player.id, { type: "hit", targetId: hitId });
  }
};

const handleReload = (player) => {
  const weapon = player.inventory[player.activeWeapon];
  if (!weapon) return;
  if (weapon.ammo >= weapon.magazine || weapon.reserve <= 0) return;
  player.reloadUntil = Date.now() + weapon.reload * 1000;
  const needed = weapon.magazine - weapon.ammo;
  const taken = Math.min(needed, weapon.reserve);
  weapon.reserve -= taken;
  weapon.ammo += taken;
};

const applyMovement = (player, delta) => {
  const input = player.input;
  const forward = input.forward ? 1 : 0;
  const backward = input.backward ? 1 : 0;
  const left = input.left ? 1 : 0;
  const right = input.right ? 1 : 0;

  const moveX = right - left;
  const moveZ = forward - backward;

  let speed = MAX_SPEED;
  if (input.sprint) speed = SPRINT_SPEED;
  if (input.crouch) speed = CROUCH_SPEED;

  const length = Math.hypot(moveX, moveZ) || 1;
  const dirX = (moveX / length) * speed;
  const dirZ = (moveZ / length) * speed;

  player.velocity.x = dirX;
  player.velocity.z = dirZ;

  if (input.jump && player.onGround) {
    player.velocity.y = JUMP_VELOCITY;
    player.onGround = false;
  }

  player.velocity.y += GRAVITY * delta;
  player.position.x += player.velocity.x * delta;
  player.position.y += player.velocity.y * delta;
  player.position.z += player.velocity.z * delta;

  if (player.position.y <= 0) {
    player.position.y = 0;
    player.velocity.y = 0;
    player.onGround = true;
  }

  player.position.x = clamp(player.position.x, -world.bounds, world.bounds);
  player.position.z = clamp(player.position.z, -world.bounds, world.bounds);
};

const updateStorm = (delta) => {
  storm.time += delta;
  const progress = clamp(storm.time / STORM.shrinkDuration, 0, 1);
  storm.radius = STORM.startRadius + (STORM.endRadius - STORM.startRadius) * progress;
};

const applyStormDamage = (player, delta) => {
  const dx = player.position.x - storm.center.x;
  const dz = player.position.z - storm.center.z;
  const dist = Math.hypot(dx, dz);
  if (dist > storm.radius) {
    applyDamage(player, STORM.damagePerSecond * delta, null);
  }
};

const updateBots = (delta) => {
  players.forEach((bot) => {
    if (!bot.isBot || bot.health <= 0) return;
    let target = null;
    players.forEach((player) => {
      if (player.isBot || player.health <= 0) return;
      if (!target) target = player;
      const dist = Math.hypot(player.position.x - bot.position.x, player.position.z - bot.position.z);
      const bestDist = Math.hypot(target.position.x - bot.position.x, target.position.z - bot.position.z);
      if (dist < bestDist) target = player;
    });

    const dirToTarget = target
      ? {
          x: target.position.x - bot.position.x,
          y: 0,
          z: target.position.z - bot.position.z,
        }
      : { x: storm.center.x - bot.position.x, y: 0, z: storm.center.z - bot.position.z };

    const length = Math.hypot(dirToTarget.x, dirToTarget.z) || 1;
    bot.input.forward = true;
    bot.input.backward = false;
    bot.input.left = false;
    bot.input.right = false;
    bot.input.sprint = true;
    bot.input.crouch = false;
    bot.input.jump = false;
    bot.input.aimDir = { x: dirToTarget.x / length, y: 0, z: dirToTarget.z / length };

    if (target) {
      const distance = Math.hypot(dirToTarget.x, dirToTarget.z);
      bot.input.shoot = distance < 80;
    } else {
      bot.input.shoot = false;
    }

    if (Math.random() < 0.005) {
      const weapons = Object.keys(bot.inventory);
      bot.activeWeapon = weapons[Math.floor(Math.random() * weapons.length)];
    }

    applyMovement(bot, delta);
    if (bot.input.shoot) {
      fireWeapon(bot);
    }
  });
};

const sendWorldState = () => {
  const payload = {
    type: "state",
    players: Array.from(players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      yaw: player.yaw,
      pitch: player.pitch,
      health: player.health,
      shield: player.shield,
      resources: player.resources,
      activeWeapon: player.activeWeapon,
      inventory: Object.fromEntries(
        Object.entries(player.inventory).map(([key, item]) => [
          key,
          { ammo: item.ammo, reserve: item.reserve, magazine: item.magazine },
        ])
      ),
      eliminations: player.eliminations,
      isBot: player.isBot,
    })),
    builds: Array.from(builds.values()),
    storm,
    resources: Array.from(resourceNodes.values()),
  };
  broadcast(payload);
};

const processInputs = (delta) => {
  players.forEach((player) => {
    if (player.health <= 0) return;
    if (!player.isBot) {
      applyMovement(player, delta);
    }

    if (player.input.build) {
      tryPlaceBuild(player, player.input.build);
      player.input.build = null;
    }

    if (player.input.harvest) {
      performHarvest(player);
    }

    if (player.input.reload) {
      handleReload(player);
      player.input.reload = false;
    }

    if (player.input.shoot) {
      fireWeapon(player);
    }

    applyStormDamage(player, delta);
  });
};

const tick = () => {
  const delta = 1 / TICK_RATE;
  updateStorm(delta);
  processInputs(delta);
  updateBots(delta);
  respawnPlayers();
  sendWorldState();
};

setInterval(tick, 1000 / TICK_RATE);

const handleMessage = (id, message) => {
  let data = null;
  try {
    data = JSON.parse(message);
  } catch (error) {
    return;
  }

  const player = players.get(id);
  if (!player) return;

  if (data.type === "input") {
    const input = data.payload;
    player.input.forward = !!input.forward;
    player.input.backward = !!input.backward;
    player.input.left = !!input.left;
    player.input.right = !!input.right;
    player.input.sprint = !!input.sprint;
    player.input.crouch = !!input.crouch;
    player.input.jump = !!input.jump;
    player.input.shoot = !!input.shoot;
    player.input.reload = !!input.reload;
    player.input.harvest = !!input.harvest;
    player.input.aimDir = input.aimDir || player.input.aimDir;
    if (input.activeWeapon && player.inventory[input.activeWeapon]) {
      player.activeWeapon = input.activeWeapon;
    }
    if (input.build) {
      player.input.build = input.build;
    }
  }

  if (data.type === "destroy-build") {
    tryDestroyBuild(player);
  }
};

const createBot = (index) => {
  const botId = `bot-${index}-${randomUUID()}`;
  const bot = createPlayer({ id: botId, name: `Bot ${index + 1}`, isBot: true });
  players.set(botId, bot);
};

for (let i = 0; i < BOT_COUNT; i += 1) {
  createBot(i);
}

wss.on("connection", (ws) => {
  if (players.size >= MAX_PLAYERS) {
    ws.close();
    return;
  }

  const id = randomUUID();
  const player = createPlayer({ id, name: `Player-${id.slice(0, 4)}`, isBot: false });
  clients.set(id, ws);
  players.set(id, player);

  ws.send(JSON.stringify({
    type: "init",
    id,
    mapSize: MAP_SIZE,
    buildGrid: BUILD_GRID,
    weapons: WEAPONS,
  }));

  ws.on("message", (message) => handleMessage(id, message));

  ws.on("close", () => {
    clients.delete(id);
    players.delete(id);
  });
});

console.log(`Fortnut server running on ws://localhost:${PORT}`);
