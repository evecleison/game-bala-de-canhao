import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Configuração da cena, câmera e renderizador
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
document.body.style.cursor = 'none';

// Carregador de textura para partículas e caixas
const textureLoader = new THREE.TextureLoader();
const particleTexture = textureLoader.load('/sprite-explosion.png');
const boxTexture = textureLoader.load('/caixa.jpg');

// Elementos do HUD
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');

// Configuração da física
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

// Chão
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const groundBody = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
});
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(groundBody);

// Canhão – com a rotação inicial para apontar para o eixo negativo Z
const cannonGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 32);
cannonGeometry.rotateX(Math.PI / 2);
const cannonMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
const cannon = new THREE.Mesh(cannonGeometry, cannonMaterial);
cannon.position.set(0, 1, 0);
cannon.rotation.y = Math.PI;
scene.add(cannon);

// Arrays para alvos e seus corpos físicos
const targets = [];
const targetBodies = [];

// Projéteis
const projectileGeometry = new THREE.SphereGeometry(0.2, 32, 32);
const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const projectiles = [];
const projectileBodies = [];

// Sistema de partículas
const particleCount = 100;
const particles = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particleMaterial = new THREE.PointsMaterial({ 
  map: particleTexture, 
  transparent: true, 
  size: 0.1 
});
const particleSystem = new THREE.Points(particles, particleMaterial);
scene.add(particleSystem);

// Variáveis de pontuação e fase
let score = 0;
let currentLevel = 1;

// Função para criar os alvos (grupos de caixas empilhadas)
function createTargets(level) {
  const numTargets = level * 5;
  // Remove alvos anteriores, se houver
  targets.forEach(t => scene.remove(t));
  targetBodies.forEach(b => world.removeBody(b));
  targets.length = 0;
  targetBodies.length = 0;
  
  const numBoxesStack = 3;
  const boxMaterial = new THREE.MeshBasicMaterial({ map: boxTexture });
  
  for (let i = 0; i < numTargets; i++) {
    const group = new THREE.Group();
    for (let j = 0; j < numBoxesStack; j++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), boxMaterial);
      box.position.set(0, j, 0);
      group.add(box);
    }
    const x = (i - (numTargets - 1) / 2) * 2;
    group.position.set(x, 0.5, -10);
    scene.add(group);
    targets.push(group);
    
    // Corpo físico composto para o grupo
    const compoundBody = new CANNON.Body({ mass: numBoxesStack });
    for (let j = 0; j < numBoxesStack; j++) {
      const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
      compoundBody.addShape(shape, new CANNON.Vec3(0, j, 0));
    }
    compoundBody.position.set(x, 0.5, -10);
    world.addBody(compoundBody);
    targetBodies.push(compoundBody);
  }
  if (levelElement) {
    levelElement.textContent = `Fase: ${level}`;
  }
}

// Inicializa a primeira fase
createTargets(currentLevel);

// Controle de mira com mouse e atualização da câmera
document.addEventListener('mousemove', (event) => {
  const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
  const yaw = mouseX * Math.PI + Math.PI;
  const pitch = mouseY * Math.PI / 4;
  cannon.rotation.set(pitch, yaw, 0);
  const direction = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch)
  );
  const cameraOffset = new THREE.Vector3(0, 2, 5);
  camera.position.copy(cannon.position).add(cameraOffset);
  camera.lookAt(cannon.position.clone().add(direction));
});

// Movimentação do canhão com teclado (A, D ou setas)
document.addEventListener('keydown', (event) => {
  if (event.key === 'a' || event.key === 'ArrowLeft') {
    cannon.position.x -= 0.1;
  } else if (event.key === 'd' || event.key === 'ArrowRight') {
    cannon.position.x += 0.1;
  }
});

// Disparo de projéteis
document.addEventListener('click', () => {
  const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
  projectile.position.copy(cannon.position);
  scene.add(projectile);
  projectiles.push(projectile);

  const projectileBody = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(cannon.position.x, cannon.position.y, cannon.position.z),
    shape: new CANNON.Sphere(0.2),
  });

  const yaw = cannon.rotation.y;
  const pitch = cannon.rotation.x;
  const shootDirection = new CANNON.Vec3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch)
  );
  shootDirection.scale(10, shootDirection);
  projectileBody.velocity.copy(shootDirection);
  world.addBody(projectileBody);
  projectileBodies.push(projectileBody);

  // Verifica colisões com os alvos
  projectileBody.addEventListener('collide', (event) => {
    const targetIndex = targetBodies.findIndex(body => body === event.body);
    if (targetIndex !== -1) {
      // Remove o projétil
      scene.remove(projectile);
      if (world.bodies.includes(projectileBody)) {
        world.removeBody(projectileBody);
      }
      const projectileIndex = projectileBodies.indexOf(projectileBody);
      if (projectileIndex !== -1) {
        projectiles.splice(projectileIndex, 1);
        projectileBodies.splice(projectileIndex, 1);
      }

      // Remove o grupo de caixas atingido
      scene.remove(targets[targetIndex]);
      if (world.bodies.includes(targetBodies[targetIndex])) {
        world.removeBody(targetBodies[targetIndex]);
      }
      targets.splice(targetIndex, 1);
      targetBodies.splice(targetIndex, 1);

      // Atualiza a pontuação
      score += 10;
      if (scoreElement) {
        scoreElement.textContent = `Pontuação: ${score}`;
      }
      explodeParticles(event.body.position);

      // Se não houver mais alvos, passa para a próxima fase
      if (targets.length === 0) {
        currentLevel++;
        createTargets(currentLevel);
      }
    }
  });
});

// Função para explosão de partículas
function explodeParticles(position) {
  const posArray = particles.attributes.position.array;
  for (let i = 0; i < particleCount; i++) {
    posArray[i * 3] = position.x + (Math.random() - 0.5) * 2;
    posArray[i * 3 + 1] = position.y + (Math.random() - 0.5) * 2;
    posArray[i * 3 + 2] = position.z + (Math.random() - 0.5) * 2;
  }
  particles.attributes.position.needsUpdate = true;
}

// Loop de animação
function animate() {
  requestAnimationFrame(animate);
  world.step(1 / 60);

  // Atualiza as posições dos alvos com base na física
  targets.forEach((target, index) => {
    if (targetBodies[index]) {
      target.position.copy(targetBodies[index].position);
      target.quaternion.copy(targetBodies[index].quaternion);
    }
  });
  // Atualiza as posições dos projéteis
  projectiles.forEach((projectile, index) => {
    if (projectileBodies[index]) {
      projectile.position.copy(projectileBodies[index].position);
      projectile.quaternion.copy(projectileBodies[index].quaternion);
    }
  });
  // Atualiza a câmera para seguir o canhão
  const currentYaw = cannon.rotation.y;
  const currentPitch = cannon.rotation.x;
  const currentDirection = new THREE.Vector3(
    Math.sin(currentYaw) * Math.cos(currentPitch),
    Math.sin(currentPitch),
    Math.cos(currentYaw) * Math.cos(currentPitch)
  );
  const cameraOffset = new THREE.Vector3(0, 2, 5);
  camera.position.copy(cannon.position).add(cameraOffset);
  camera.lookAt(cannon.position.clone().add(currentDirection));

  renderer.render(scene, camera);
}

// Controle da tela de início: só inicia o jogo ao clicar no botão "Iniciar"
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');

function startGame() {
  startScreen.style.display = 'none';
  animate();
}

startButton.addEventListener('click', startGame);
