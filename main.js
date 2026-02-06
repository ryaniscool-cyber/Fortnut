import * as THREE from 'three';
import { PLAYER_SPEED, SPRINT_MULTIPLIER, JUMP_HEIGHT } from './constants.js';
import MESSAGES from './messages.js';

let scene, camera, renderer;
let player = { id: Date.now(), x: 0, y: 0, z: 0, rotation: 0, health: 100, shield: 100 };
let keys = {};

const socket = new WebSocket('ws://localhost:8080');
socket.onopen = () => console.log('Connected to server');
socket.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.type === MESSAGES.GAME_STATE) {
    player.health = data.players[player.id]?.health ?? player.health;
    player.shield = data.players[player.id]?.shield ?? player.shield;
    document.getElementById('health').innerText = Math.floor(player.health);
    document.getElementById('shield').innerText = Math.floor(player.shield);
    document.getElementById('storm').innerText = data.stormRadius.toFixed(1);
  }
};

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 2, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshPhongMaterial({ color: 0x228B22 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 20, 10);
  scene.add(light);

  window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
  window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
}

function animate() {
  requestAnimationFrame(animate);
  handleInput();
  renderer.render(scene, camera);
  sendPlayerUpdate();
}

function handleInput() {
  let speed = PLAYER_SPEED;
  if (keys['shift']) speed *= SPRINT_MULTIPLIER;

  if (keys['w']) player.z -= speed;
  if (keys['s']) player.z += speed;
  if (keys['a']) player.x -= speed;
  if (keys['d']) player.x += speed;
  if (keys[' ']) player.y += JUMP_HEIGHT;

  camera.position.set(player.x, player.y + 2, player.z + 5);
  camera.lookAt(player.x, player.y, player.z);
}

function sendPlayerUpdate() {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: MESSAGES.PLAYER_UPDATE, ...player }));
  }
}
