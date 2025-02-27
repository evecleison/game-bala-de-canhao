import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import * as CANNON from 'cannon-es';

// Variáveis globais do jogo
let scene, camera, renderer, controls, world;
let cannonMesh, cannonBody;
let projectiles = [];
let boxes = [];
let score = 0;
let level = 1;
let levelTimer = 60; // segundos para cada nível
let lastShotTime = 0;
const shotCooldown = 3000; // 3 segundos de recarga

// Áudios 
const cannonSound = new Audio('/cannonball.mp3');
const explosionSound = new Audio('/medium-explosion.mp3');

// Inicialização
init();
animate();

function init() {
  // Cena e câmera
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Céu azul claro

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 2, 2);

  // Renderizador
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Iluminação
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 10, 5);
  scene.add(directionalLight);

  // Inicializa o mundo físico
  world = new CANNON.World();
  world.gravity.set(0, -9.82, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);

  // Campo
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  scene.add(groundMesh);

  const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane()
  });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);

  // Criação do canhão
  const cannonGeometry = new THREE.CylinderGeometry(0.2, 0.4, 1, 32);
  const cannonMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
  cannonMesh = new THREE.Mesh(cannonGeometry, cannonMaterial);
  cannonMesh.position.set(0, 0.5, 0);
  scene.add(cannonMesh);

  // Posiciona o canhão de forma relativa à câmera
  cannonMesh.position.set(0, -1, -2);
  
  // Adiciona o canhão como filho da câmera para herdar suas rotações e movimentos
  camera.add(cannonMesh);
  scene.add(camera);

  // Corpo físico do canhão
  cannonBody = new CANNON.Body({ mass: 0 });
  const cannonShape = new CANNON.Cylinder(0.2, 0.4, 1, 32);
  cannonBody.addShape(cannonShape);
  
  // Configura os controles com Pointer Lock
  controls = new PointerLockControls(camera, renderer.domElement);
  document.addEventListener('click', () => {
    controls.lock();
    // Ao clicar, dispara o canhão
    fireProjectile();
  });

  // Configura o nível atual (os alvos)
  setupLevel(level);

  // Cria a interface simples para pontuação e cronômetro
  createUI();
}

function createUI() {
  const uiContainer = document.createElement('div');
  uiContainer.id = 'ui';
  uiContainer.style.position = 'absolute';
  uiContainer.style.top = '10px';
  uiContainer.style.left = '10px';
  uiContainer.style.color = 'white';
  uiContainer.style.fontFamily = 'Arial';
  uiContainer.innerHTML = `<div id="score">Pontos: ${score}</div>
                           <div id="timer">Tempo: ${levelTimer}</div>`;
  document.body.appendChild(uiContainer);
}

function updateUI() {
  document.getElementById('score').innerText = `Pontos: ${score}`;
  document.getElementById('timer').innerText = `Tempo: ${Math.max(
    0,
    Math.floor(levelTimer)
  )}`;
}

function setupLevel(lvl) {
  // Remove caixas do nível anterior
  boxes.forEach(b => {
    scene.remove(b.mesh);
    world.removeBody(b.body);
  });
  boxes = [];

  // Exemplo: Nível 1 = 5 caixas; Nível 10 = 30 caixas
  const numBoxes = 5 + Math.floor((lvl - 1) * (25 / 9));
  for (let i = 0; i < numBoxes; i++) {
    const boxSize = 0.5;
    const boxGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const boxMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);

    // Posiciona as caixas de forma aleatória (em pilhas simples)
    const x = (Math.random() - 0.5) * 10;
    const z = - (Math.random() * 20 + 5);
    const y = boxSize / 2 + (i % 3) * boxSize; // empilhamento de até 3 caixas
    boxMesh.position.set(x, y, z);
    scene.add(boxMesh);

    // Corpo físico da caixa
    const boxShape = new CANNON.Box(new CANNON.Vec3(boxSize / 2, boxSize / 2, boxSize / 2));
    const boxBody = new CANNON.Body({ mass: 1 });
    boxBody.addShape(boxShape);
    boxBody.position.copy(boxMesh.position);
    world.addBody(boxBody);

    boxes.push({ mesh: boxMesh, body: boxBody });
  }

  // Reinicia o cronômetro para o nível
  levelTimer = 60;
}

function onMouseMove(event) {
  // Atualiza a direção do canhão com base na posição do mouse
  const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  // Rotaciona de forma simples 
  cannonMesh.rotation.y = mouseX * Math.PI;
}

function fireProjectile() {
  const now = performance.now();
  if (now - lastShotTime < shotCooldown) {
    console.log("Recarregando...");
    return;
  }
  lastShotTime = now;
  cannonSound.play();

  // Cria o projétil
  const sphereRadius = 0.1;
  const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 16, 16);
  const sphereMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
  const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);

  // Define a posição da ponta do canhão em coordenadas locais (por exemplo, 1 unidade à frente)
  const localTip = new THREE.Vector3(0, 0, -1);
  // Converte para coordenadas do mundo, já que o canhão é filho da câmera
  cannonMesh.localToWorld(localTip);
  sphereMesh.position.copy(localTip);
  scene.add(sphereMesh);

  // Corpo físico do projétil
  const sphereShape = new CANNON.Sphere(sphereRadius);
  const sphereBody = new CANNON.Body({ mass: 0.1 });
  sphereBody.addShape(sphereShape);
  sphereBody.position.copy(sphereMesh.position);
  world.addBody(sphereBody);

  // Calcula a direção do projétil com base na rotação do canhão
  const cannonWorldQuat = new THREE.Quaternion();
  cannonMesh.getWorldQuaternion(cannonWorldQuat);

  // Vetor apontando para frente no espaço local do canhão
  const forward = new THREE.Vector3(0, 0, -1);
  // Aplica a rotação mundial do canhão para obter a direção correta
  forward.applyQuaternion(cannonWorldQuat);
  forward.normalize();
  forward.multiplyScalar(15); // Ajuste a velocidade conforme necessário

  sphereBody.velocity.set(forward.x, forward.y, forward.z);
  projectiles.push({ mesh: sphereMesh, body: sphereBody });
}

function animate() {
  requestAnimationFrame(animate);
  const delta = 1 / 60;
  world.step(delta);

  // Atualiza a posição dos projéteis
  projectiles.forEach((p, i) => {
    p.mesh.position.copy(p.body.position);
    if (p.mesh.position.length() > 100) {
      scene.remove(p.mesh);
      world.removeBody(p.body);
      projectiles.splice(i, 1);
    }
  });

  // Atualiza a posição e rotação das caixas
  boxes.forEach(b => {
    b.mesh.position.copy(b.body.position);
    b.mesh.quaternion.copy(b.body.quaternion);
  });

  // Verifica colisões entre projéteis e caixas
  projectiles.forEach(p => {
    boxes.forEach((b, index) => {
      const distance = p.mesh.position.distanceTo(b.mesh.position);
      if (distance < 0.5) {
        explosionSound.play();
        triggerExplosion(b.mesh.position);
        scene.remove(b.mesh);
        world.removeBody(b.body);
        boxes.splice(index, 1);
        score++;
      }
    });
  });

  // Atualiza o cronômetro do nível
  levelTimer -= delta;
  if (levelTimer <= 0) {
    showEndGame(false);
  }

  updateUI();
  renderer.render(scene, camera);

  // Verifica se todas as caixas foram destruídas
  if (boxes.length === 0) {
    if (level < 10) {
      // Exibe um menu para avançar para o próximo nível
      showNextLevelMenu(level + 1);
    } else {
      // Se for o último nível, exibe a vitória
      showEndGame(true);
    }
  }
}


function triggerExplosion(position) {
  // Aqui poderia ter colocado um efeito visual na explosão
  console.log("Explosão em:", position);
}

// Flag para evitar a criação múltipla de menus
let menuAtivo = false;

function showEndGame(victory) {
  // Libera o Pointer Lock para permitir interação com a UI
  if (controls.isLocked) {
    controls.unlock();
  }

  if (menuAtivo) return; // Evita múltiplas instâncias
  menuAtivo = true;

  // Cria o container do menu final
  const endMenu = document.createElement('div');
  endMenu.id = "endMenu";
  endMenu.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 20px;
    text-align: center;
    z-index: 999;
  `;
  
  if (victory) {
    endMenu.innerHTML = `
      <h1>Parabéns!</h1>
      <p>Pontuação final: ${score}</p>
      <button id="restartBtn">Recomeçar</button>
    `;
  } else {
    endMenu.innerHTML = `
      <h1>Tempo Esgotado</h1>
      <p>Nível alcançado: ${level}</p>
      <p>Pontuação: ${score}</p>
      <button id="restartBtn">Recomeçar</button>
    `;
  }
  
  document.body.appendChild(endMenu);

  // Associa o evento de clique ao botão "Recomeçar"
  const restartBtn = document.getElementById('restartBtn');
  restartBtn.addEventListener('click', () => {
    // Remove o menu e reinicia o jogo
    endMenu.remove();
    location.reload();
  });
}

function showNextLevelMenu(nextLevel) {
  // Libera o Pointer Lock para permitir interação com a UI
  if (controls.isLocked) {
    controls.unlock();
  }

  if (menuAtivo) return;
  menuAtivo = true;

  // Cria o container do menu de próximo nível
  const nextMenu = document.createElement('div');
  nextMenu.id = "nextLevelMenu";
  nextMenu.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 20px;
    text-align: center;
    z-index: 999;
  `;
  
  nextMenu.innerHTML = `
    <h1>Nível ${nextLevel}</h1>
    <button id="nextLevelBtn">OK</button>
  `;
  
  document.body.appendChild(nextMenu);

  // Associa o evento de clique ao botão "OK"
  const nextLevelBtn = document.getElementById('nextLevelBtn');
  nextLevelBtn.addEventListener('click', () => {
    // Remove o menu e inicia o próximo nível
    nextMenu.remove();
    menuAtivo = false; // Reseta a flag para permitir novos menus
    level = nextLevel;
    setupLevel(level);
    controls.lock();
  });
}
