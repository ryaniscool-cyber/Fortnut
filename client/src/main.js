import * as THREE from "three";
import {
  MAP_SIZE,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  BUILD_TYPES,
} from "../../shared/constants.js";

const app = document.getElementById("app");
const inventoryEl = document.getElementById("inventory");
const healthBar = document.getElementById("health-bar");
const shieldBar = document.getElementById("shield-bar");
const resourcesEl = document.getElementById("resources");
const compassEl = document.getElementById("compass");
const messageEl = document.getElementById("message");
const minimapCanvas = document.getElementById("minimap-canvas");
const minimapCtx = minimapCanvas.getContext("2d");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0c1016, 120, 420);
scene.background = new THREE.Color(0x0c1016);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 800);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(40, 80, 20);
scene.add(dirLight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 32, 32),
  new THREE.MeshStandardMaterial({ color: 0x2f4f35 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(600, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0x0b1220, side: THREE.BackSide })
);
scene.add(skyDome);

const playerMeshes = new Map();
const buildMeshes = new Map();
const resourceMeshes = new Map();

const aim = {
  yaw: 0,
  pitch: 0,
};

const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
  crouch: false,
  jump: false,
  shoot: false,
  reload: false,
  harvest: false,
  build: null,
  activeWeapon: "ar",
};

let socket = null;
let playerId = null;
let worldState = null;
let lastSent = 0;

const weaponSlots = ["ar", "shotgun", "sniper", "smg"];

const createPlayerMesh = (isLocal) => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT - 0.4, 4, 8),
    new THREE.MeshStandardMaterial({ color: isLocal ? 0x58c0ff : 0xffa24c })
  );
  body.position.y = PLAYER_HEIGHT / 2;
  group.add(body);
  return group;
};

const createBuildMesh = (build) => {
  const size = BUILD_TYPES[build.type].size;
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const material = new THREE.MeshStandardMaterial({ color: 0xb38a5a, opacity: 0.95, transparent: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(build.position.x, size.y / 2, build.position.z);
  mesh.rotation.y = build.rotation || 0;
  return mesh;
};

const createResourceMesh = (node) => {
  const color = node.type === "wood" ? 0x7c5230 : node.type === "stone" ? 0x7a7a7a : 0x8a96a5;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1.2, 6, 6),
    new THREE.MeshStandardMaterial({ color })
  );
  mesh.position.set(node.position.x, 3, node.position.z);
  return mesh;
};

const updateInventory = (player) => {
  inventoryEl.innerHTML = "";
  weaponSlots.forEach((weapon) => {
    const slot = document.createElement("div");
    slot.className = "slot" + (player.activeWeapon === weapon ? " active" : "");
    const data = player.inventory[weapon];
    slot.textContent = `${weapon.toUpperCase()} ${data.ammo}/${data.reserve}`;
    inventoryEl.appendChild(slot);
  });
};

const updateHUD = (player) => {
  healthBar.style.width = `${Math.max(0, player.health)}%`;
  shieldBar.style.width = `${Math.max(0, player.shield)}%`;
  resourcesEl.textContent = `Wood ${player.resources.wood} | Stone ${player.resources.stone} | Metal ${player.resources.metal}`;
  updateInventory(player);
};

const updateCompass = () => {
  const degrees = THREE.MathUtils.radToDeg(aim.yaw) % 360;
  compassEl.textContent = `Heading ${degrees.toFixed(0)}°`;
};

const updateMinimap = () => {
  if (!worldState || !playerId) return;
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  minimapCtx.fillStyle = "rgba(0,0,0,0.4)";
  minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  const scale = minimapCanvas.width / MAP_SIZE;
  const center = MAP_SIZE / 2;

  minimapCtx.strokeStyle = "rgba(120,200,255,0.8)";
  minimapCtx.beginPath();
  const radius = worldState.storm.radius * scale;
  minimapCtx.arc(minimapCanvas.width / 2, minimapCanvas.height / 2, radius, 0, Math.PI * 2);
  minimapCtx.stroke();

  worldState.players.forEach((player) => {
    const x = (player.position.x + center) * scale;
    const y = (player.position.z + center) * scale;
    minimapCtx.fillStyle = player.id === playerId ? "#4cf3ff" : "#ffb25e";
    minimapCtx.beginPath();
    minimapCtx.arc(x, y, 3, 0, Math.PI * 2);
    minimapCtx.fill();
  });
};

const handleResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

window.addEventListener("resize", handleResize);

const connect = () => {
  socket = new WebSocket("ws://localhost:8080");

  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "init") {
      playerId = data.id;
    }
    if (data.type === "state") {
      worldState = data;
    }
    if (data.type === "hit") {
      messageEl.textContent = "Hit confirmed!";
      setTimeout(() => {
        messageEl.textContent = "";
      }, 400);
    }
  });
};

connect();

const sendInput = () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const now = performance.now();
  if (now - lastSent < 50) return;
  lastSent = now;
  const payload = {
    ...input,
    aimDir: {
      x: Math.sin(aim.yaw) * Math.cos(aim.pitch),
      y: Math.sin(aim.pitch),
      z: Math.cos(aim.yaw) * Math.cos(aim.pitch),
    },
  };
  socket.send(JSON.stringify({ type: "input", payload }));
  input.reload = false;
  input.harvest = false;
};

const updateCamera = (player) => {
  const offset = new THREE.Vector3(
    Math.sin(aim.yaw) * -8,
    5 + (input.crouch ? -1 : 0),
    Math.cos(aim.yaw) * -8
  );
  camera.position.set(
    player.position.x + offset.x,
    player.position.y + offset.y,
    player.position.z + offset.z
  );
  camera.lookAt(
    player.position.x,
    player.position.y + PLAYER_HEIGHT / 2,
    player.position.z
  );
};

const updateScene = () => {
  if (!worldState) return;

  worldState.players.forEach((player) => {
    if (!playerMeshes.has(player.id)) {
      const mesh = createPlayerMesh(player.id === playerId);
      playerMeshes.set(player.id, mesh);
      scene.add(mesh);
    }
    const mesh = playerMeshes.get(player.id);
    mesh.position.set(player.position.x, player.position.y, player.position.z);
  });

  playerMeshes.forEach((mesh, id) => {
    if (!worldState.players.find((player) => player.id === id)) {
      scene.remove(mesh);
      playerMeshes.delete(id);
    }
  });

  worldState.builds.forEach((build) => {
    if (!buildMeshes.has(build.id)) {
      const mesh = createBuildMesh(build);
      buildMeshes.set(build.id, mesh);
      scene.add(mesh);
    }
  });

  buildMeshes.forEach((mesh, id) => {
    if (!worldState.builds.find((build) => build.id === id)) {
      scene.remove(mesh);
      buildMeshes.delete(id);
    }
  });

  worldState.resources.forEach((node) => {
    if (!resourceMeshes.has(node.id)) {
      const mesh = createResourceMesh(node);
      resourceMeshes.set(node.id, mesh);
      scene.add(mesh);
    }
  });
  resourceMeshes.forEach((mesh, id) => {
    if (!worldState.resources.find((node) => node.id === id)) {
      scene.remove(mesh);
      resourceMeshes.delete(id);
    }
  });

  const localPlayer = worldState.players.find((player) => player.id === playerId);
  if (localPlayer) {
    updateCamera(localPlayer);
    updateHUD(localPlayer);
  }

  updateMinimap();
  updateCompass();
};

const animate = () => {
  requestAnimationFrame(animate);
  updateScene();
  sendInput();
  renderer.render(scene, camera);
};

animate();

const setKey = (event, state) => {
  switch (event.code) {
    case "KeyW":
      input.forward = state;
      break;
    case "KeyS":
      input.backward = state;
      break;
    case "KeyA":
      input.left = state;
      break;
    case "KeyD":
      input.right = state;
      break;
    case "ShiftLeft":
      input.sprint = state;
      break;
    case "ControlLeft":
      input.crouch = state;
      break;
    case "Space":
      input.jump = state;
      break;
    case "KeyR":
      if (state) input.reload = true;
      break;
    case "KeyE":
      if (state) input.harvest = true;
      break;
    case "Digit1":
    case "Digit2":
    case "Digit3":
    case "Digit4": {
      if (state) {
        const index = Number(event.code.replace("Digit", "")) - 1;
        input.activeWeapon = weaponSlots[index];
      }
      break;
    }
    case "KeyQ":
      if (state) input.build = { type: "wall", rotation: 0 };
      break;
    case "KeyF":
      if (state) input.build = { type: "floor", rotation: 0 };
      break;
    case "KeyV":
      if (state) input.build = { type: "ramp", rotation: 0 };
      break;
    case "KeyX":
      if (state && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "destroy-build" }));
      }
      break;
    default:
      break;
  }
};

window.addEventListener("keydown", (event) => setKey(event, true));
window.addEventListener("keyup", (event) => setKey(event, false));

window.addEventListener("mousedown", () => {
  input.shoot = true;
});
window.addEventListener("mouseup", () => {
  input.shoot = false;
});

renderer.domElement.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
  messageEl.textContent = "";
});

window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  const sensitivity = 0.0025;
  aim.yaw -= event.movementX * sensitivity;
  aim.pitch -= event.movementY * sensitivity;
  aim.pitch = THREE.MathUtils.clamp(aim.pitch, -0.8, 0.8);
});
