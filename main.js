let scene, camera, renderer, controls, gun, peer, conn, players = {}, myId;
let bullets = [], health = 100, ammo = 30;

init();

function init() {
  // Scene and Renderer
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("game") });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Light and Ground
  scene.add(new THREE.AmbientLight(0xffffff));
  let ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ color: 0x444444 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Controls
  controls = new THREE.PointerLockControls(camera, document.body);
  document.body.addEventListener('click', () => controls.lock());

  // Gun (box placeholder or load GLTF)
  gun = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 1), new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
  gun.position.set(0.2, -0.2, -1);
  camera.add(gun);
  scene.add(camera);

  // Move loop
  document.addEventListener('keydown', handleKeys);
  document.addEventListener('click', shoot);

  // UI Elements
  document.getElementById("connectBtn").onclick = connectToPeer;
  setupPeer();

  animate();
}

function setupPeer() {
  peer = new Peer();
  peer.on('open', id => {
    myId = id;
    document.getElementById("myId").innerText = "Your ID: " + id;
  });
  peer.on('connection', c => {
    conn = c;
    conn.on('data', handleData);
  });
}

function connectToPeer() {
  const id = document.getElementById("peerId").value;
  conn = peer.connect(id);
  conn.on('open', () => {
    conn.on('data', handleData);
  });
}

function handleData(data) {
  if (data.type === "position") {
    if (!players[data.id]) {
      let mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
      scene.add(mesh);
      players[data.id] = { mesh };
    }
    players[data.id].mesh.position.copy(data.pos);
    players[data.id].mesh.rotation.y = data.rotY;
  } else if (data.type === "shoot") {
    spawnBullet(data.pos, data.dir, false);
  } else if (data.type === "hit") {
    health -= 10;
    updateHUD();
  }
}

function handleKeys(e) {
  const speed = 0.2;
  const dir = new THREE.Vector3();
  controls.getDirection(dir);
  dir.y = 0;
  dir.normalize();

  if (e.key === 'w') camera.position.addScaledVector(dir, speed);
  if (e.key === 's') camera.position.addScaledVector(dir, -speed);
  if (e.key === 'a') camera.position.x -= speed;
  if (e.key === 'd') camera.position.x += speed;

  sendPosition();
}

function sendPosition() {
  if (conn && conn.open) {
    conn.send({
      type: "position",
      id: myId,
      pos: camera.position,
      rotY: camera.rotation.y
    });
  }
}

function shoot() {
  if (ammo <= 0) return;
  ammo--;
  updateHUD();

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const pos = camera.position.clone();

  spawnBullet(pos, dir, true);

  if (conn && conn.open) {
    conn.send({ type: "shoot", pos, dir });
  }
}

function spawnBullet(pos, dir, isMine) {
  const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({ color: isMine ? 0x00ff00 : 0xff0000 }));
  bullet.position.copy(pos);
  bullet.userData = { dir, mine: isMine };
  scene.add(bullet);
  bullets.push(bullet);
}

function updateHUD() {
  document.getElementById("health").innerText = "❤️ " + health;
  document.getElementById("ammo").innerText = "🔫 " + ammo + "/30";
}

function animate() {
  requestAnimationFrame(animate);
  bullets.forEach((b, i) => {
    b.position.addScaledVector(b.userData.dir, 0.5);
    if (b.userData.mine) {
      for (const id in players) {
        const target = players[id].mesh;
        if (b.position.distanceTo(target.position) < 1) {
          if (conn && conn.open) {
            conn.send({ type: "hit" });
          }
          scene.remove(b);
          bullets.splice(i, 1);
        }
      }
    }
  });
  renderer.render(scene, camera);
}

