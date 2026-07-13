import * as THREE from './vendor/three.module.min.js';
import { HoloPong, PacketChase } from './arcade.js';

const NODE_DATA = {
  project: { label: 'PROJECT_001', color: 0x54f4ff, position: [-6.1, 0, 1.2] },
  arcade: { label: 'LIVE_ARCADE', color: 0xb8ff62, position: [6.2, 0, -4.25] },
  tools: { label: 'FREE_TOOLS', color: 0x9d74ff, position: [-5.1, 0, -5.25] },
  support: { label: 'SUPPORT_NODE', color: 0xffc857, position: [6.1, 0, 4.2] },
};

const PLAYER_LIMIT = 8.2;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,.88)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,.22)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function createLabelTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const hex = '#' + color.toString(16).padStart(6, '0');

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(4, 12, 22, .88)';
  context.fillRect(2, 2, 508, 124);
  context.strokeStyle = hex;
  context.lineWidth = 4;
  context.strokeRect(4, 4, 504, 120);
  context.fillStyle = hex;
  context.fillRect(20, 28, 8, 72);
  context.font = '700 42px ui-monospace, SFMono-Regular, Consolas, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = hex;
  context.shadowBlur = 16;
  context.fillText(text, 272, 65);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function emissiveMaterial(color, intensity = 1.2, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: options.metalness ?? 0.42,
    roughness: options.roughness ?? 0.34,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

function markInteractive(object, nodeId) {
  object.traverse((child) => {
    if (child.isMesh || child.isSprite) child.userData.nodeId = nodeId;
  });
}

function makeFloorMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x1b8195) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec2 cells = fract(vUv * 22.0);
        float line = max(smoothstep(0.93, 0.985, cells.x), smoothstep(0.93, 0.985, cells.y));
        float axis = 1.0 - smoothstep(0.004, 0.018, min(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
        float scan = 0.45 + 0.3 * sin((vUv.x + vUv.y) * 24.0 - uTime * 1.5);
        float alpha = line * (0.10 + scan * 0.08) + axis * 0.18;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

export class BrokeDevWorld {
  constructor({ root, callbacks = {}, reducedMotion = false } = {}) {
    if (!root) throw new Error('A WebGL root element is required.');
    this.root = root;
    this.callbacks = callbacks;
    this.reducedMotion = reducedMotion;
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.elapsed = 0;
    this.active = false;
    this.panelOpen = false;
    this.arcadeActive = false;
    this.pointerDragging = false;
    this.pointerStart = new THREE.Vector2();
    this.pointer = new THREE.Vector2(2, 2);
    this.hoveredNode = null;
    this.keys = new Set();
    this.cameraYaw = -0.72;
    this.cameraPitch = 0.72;
    this.cameraDistance = 15.4;
    this.cameraTarget = new THREE.Vector3(0, 0.5, 0);
    this.cameraFocus = null;
    this.shardsCollected = 0;
    this.disposed = false;
    this.telemetryAccumulator = 0;
    this.frames = 0;
    this.fpsElapsed = 0;
    this.fps = 60;

    try {
      this.initializeRenderer();
      this.initializeScene();
      this.bindEvents();
      this.resize();
      this.renderer.setAnimationLoop(() => this.render());
      window.setTimeout(() => this.callbacks.onReady?.(), 320);
    } catch (error) {
      this.root.classList.add('webgl-unavailable');
      this.callbacks.onFallback?.(error);
      throw error;
    }
  }

  initializeRenderer() {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    const context = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: window.devicePixelRatio <= 2,
      powerPreference: 'high-performance',
      depth: true,
      stencil: false,
    });
    if (!context) throw new Error('WebGL 2 is unavailable.');

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      context,
      alpha: true,
      antialias: window.devicePixelRatio <= 2,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.reducedMotion && window.innerWidth > 720;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.root.replaceChildren(this.canvas);
  }

  initializeScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02060d);
    this.scene.fog = new THREE.FogExp2(0x02060d, 0.034);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
    this.camera.position.set(10, 11, 12);

    const ambient = new THREE.HemisphereLight(0x91e9ff, 0x080612, 1.05);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xb6efff, 2.35);
    key.position.set(-8, 14, 8);
    key.castShadow = this.renderer.shadowMap.enabled;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -13;
    key.shadow.camera.right = 13;
    key.shadow.camera.top = 13;
    key.shadow.camera.bottom = -13;
    this.scene.add(key);

    const violetLight = new THREE.PointLight(0x8d65ff, 18, 17, 2);
    violetLight.position.set(-5, 3, -5);
    this.scene.add(violetLight);
    const cyanLight = new THREE.PointLight(0x38e5ff, 22, 18, 2);
    cyanLight.position.set(5, 3, 3);
    this.scene.add(cyanLight);

    this.glowTexture = createGlowTexture();
    this.createStars();
    this.createPlatform();
    this.createCentralCore();
    this.createSkyline();
    this.createNodes();
    this.createArcadeMachines();
    this.createPlayer();
    this.createShards();
    this.createDataTraffic();
  }

  createStars() {
    const positions = [];
    for (let index = 0; index < 650; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 18 + Math.random() * 28;
      positions.push(
        Math.cos(angle) * radius,
        3 + Math.random() * 22,
        Math.sin(angle) * radius,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0x8bdff4, size: 0.055, transparent: true, opacity: 0.62 }),
    );
    this.scene.add(this.stars);
  }

  createPlatform() {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.5, 22),
      new THREE.MeshStandardMaterial({
        color: 0x06111c,
        emissive: 0x030a11,
        roughness: 0.64,
        metalness: 0.74,
      }),
    );
    base.position.y = -0.34;
    base.receiveShadow = true;
    this.scene.add(base);

    this.floorMaterial = makeFloorMaterial();
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(21.5, 21.5), this.floorMaterial);
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = -0.075;
    this.scene.add(grid);

    const edgeMaterial = emissiveMaterial(0x54f4ff, 1.7, { roughness: 0.42 });
    const railX = new THREE.BoxGeometry(22.1, 0.12, 0.1);
    const railZ = new THREE.BoxGeometry(0.1, 0.12, 22.1);
    for (const z of [-11, 11]) {
      const rail = new THREE.Mesh(railX, edgeMaterial);
      rail.position.set(0, 0.03, z);
      this.scene.add(rail);
    }
    for (const x of [-11, 11]) {
      const rail = new THREE.Mesh(railZ, edgeMaterial);
      rail.position.set(x, 0.03, 0);
      this.scene.add(rail);
    }

    const pathMaterial = new THREE.MeshBasicMaterial({ color: 0x155c6c, transparent: true, opacity: 0.42 });
    const pathGeometry = new THREE.PlaneGeometry(0.08, 8.6);
    for (let index = 0; index < 8; index += 1) {
      const path = new THREE.Mesh(pathGeometry, pathMaterial);
      path.rotation.x = -Math.PI / 2;
      path.rotation.z = (index * Math.PI) / 4;
      path.position.y = -0.055;
      this.scene.add(path);
    }
  }

  createCentralCore() {
    this.core = new THREE.Group();
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.55, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x0b1827, metalness: 0.8, roughness: 0.3 }),
    );
    pedestal.position.y = 0.2;
    pedestal.castShadow = true;
    this.core.add(pedestal);

    this.coreCrystal = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.68, 1),
      emissiveMaterial(0x54f4ff, 2.4, { metalness: 0.24, roughness: 0.17 }),
    );
    this.coreCrystal.position.y = 1.45;
    this.coreCrystal.castShadow = true;
    this.core.add(this.coreCrystal);

    this.coreRings = [];
    for (let index = 0; index < 3; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.02 + index * 0.24, 0.025, 8, 64),
        emissiveMaterial(index === 1 ? 0x9d74ff : 0x54f4ff, 2.2),
      );
      ring.position.y = 1.45;
      ring.rotation.x = Math.PI / 2 + index * 0.42;
      ring.rotation.y = index * 0.6;
      this.coreRings.push(ring);
      this.core.add(ring);
    }

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0x54f4ff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.position.y = 1.45;
    glow.scale.set(4.4, 4.4, 1);
    this.core.add(glow);
    this.scene.add(this.core);
  }

  createSkyline() {
    this.skyline = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x07121f, metalness: 0.66, roughness: 0.54 });
    const windowMaterial = emissiveMaterial(0x2e8ca0, 1.05);
    const placements = [];

    for (let index = 0; index < 34; index += 1) {
      const edge = index % 4;
      const offset = -10 + ((index * 3.7) % 20);
      const x = edge < 2 ? (edge === 0 ? -12.1 : 12.1) : offset;
      const z = edge >= 2 ? (edge === 2 ? -12.1 : 12.1) : offset;
      placements.push([x, z, 0.65 + ((index * 1.47) % 2.9)]);
    }

    placements.forEach(([x, z, height], index) => {
      const width = 0.6 + ((index * 0.31) % 0.7);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), bodyMaterial);
      tower.position.set(x, height / 2 - 0.05, z);
      this.skyline.add(tower);

      const window = new THREE.Mesh(new THREE.BoxGeometry(width * 0.58, 0.05, width * 0.58), windowMaterial);
      window.position.set(x, height + 0.02, z);
      this.skyline.add(window);
    });
    this.scene.add(this.skyline);
  }

  createKiosk(nodeId, data) {
    const group = new THREE.Group();
    group.name = `node-${nodeId}`;
    group.position.set(...data.position);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.92, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x0a1724, metalness: 0.82, roughness: 0.3 }),
    );
    base.position.y = 0.12;
    base.castShadow = true;
    group.add(base);

    const column = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.45, 0.18),
      emissiveMaterial(data.color, 1.25),
    );
    column.position.y = 0.92;
    group.add(column);

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.78, 0.12),
      new THREE.MeshStandardMaterial({
        color: 0x08121e,
        emissive: data.color,
        emissiveIntensity: 0.28,
        metalness: 0.72,
        roughness: 0.28,
      }),
    );
    panel.position.set(0, 1.63, 0);
    group.add(panel);

    const icon = new THREE.Mesh(
      nodeId === 'arcade'
        ? new THREE.BoxGeometry(0.38, 0.38, 0.38)
        : nodeId === 'tools'
          ? new THREE.OctahedronGeometry(0.31, 0)
          : nodeId === 'support'
            ? new THREE.TorusGeometry(0.28, 0.085, 8, 24)
            : new THREE.IcosahedronGeometry(0.3, 0),
      emissiveMaterial(data.color, 2.4),
    );
    icon.position.set(0, 1.63, 0.12);
    icon.userData.spin = 0.6 + Math.random() * 0.8;
    group.add(icon);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.93, 0.032, 8, 48),
      emissiveMaterial(data.color, 2),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    group.add(ring);

    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createLabelTexture(data.label, data.color),
        transparent: true,
        depthTest: false,
      }),
    );
    label.position.set(0, 2.55, 0);
    label.scale.set(3.25, 0.82, 1);
    label.userData.baseY = 2.55;
    group.add(label);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: data.color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.45,
      }),
    );
    glow.position.y = 1.35;
    glow.scale.set(3.3, 3.3, 1);
    group.add(glow);

    group.userData = { nodeId, icon, ring, label, glow, baseY: group.position.y };
    markInteractive(group, nodeId);
    this.scene.add(group);
    return group;
  }

  createNodes() {
    this.nodes = {};
    this.interactiveObjects = [];
    Object.entries(NODE_DATA).forEach(([nodeId, data]) => {
      const node = this.createKiosk(nodeId, data);
      this.nodes[nodeId] = node;
      node.traverse((child) => {
        if (child.userData.nodeId) this.interactiveObjects.push(child);
      });
    });
    this.raycaster = new THREE.Raycaster();
  }

  createArcadeMachines() {
    this.packetChase = new PacketChase({
      onState: (state) => this.callbacks.onArcadeState?.(state),
    });
    this.packetChase.group.position.set(6.1, 0.08, -7.1);
    this.packetChase.group.scale.setScalar(0.48);
    this.scene.add(this.packetChase.group);

    this.holoPong = new HoloPong();
    this.holoPong.group.position.set(-1.7, 2.05, -8.65);
    this.holoPong.group.rotation.y = 0.12;
    this.holoPong.group.scale.setScalar(0.82);
    this.scene.add(this.holoPong.group);

    const pongStand = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 3.7, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x111b2e, metalness: 0.8, roughness: 0.34 }),
    );
    pongStand.position.set(-1.7, 1.5, -8.78);
    this.scene.add(pongStand);
  }

  createPlayer() {
    this.player = new THREE.Group();
    this.player.name = 'visitor-drone';
    this.player.position.set(0, 0.55, 6.8);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.5, 0.28, 8),
      new THREE.MeshStandardMaterial({
        color: 0x13283a,
        emissive: 0x16495a,
        emissiveIntensity: 0.72,
        metalness: 0.76,
        roughness: 0.25,
      }),
    );
    body.castShadow = true;
    this.player.add(body);

    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.1, 0.08),
      emissiveMaterial(0xb8ff62, 2.6),
    );
    eye.position.set(0, 0.03, 0.35);
    this.player.add(eye);

    this.playerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.025, 8, 40),
      emissiveMaterial(0x54f4ff, 2.1),
    );
    this.playerRing.rotation.x = Math.PI / 2;
    this.player.add(this.playerRing);

    const pointer = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.3, 4),
      emissiveMaterial(0xb8ff62, 2.2),
    );
    pointer.position.set(0, 0, 0.58);
    pointer.rotation.x = Math.PI / 2;
    this.player.add(pointer);

    this.playerGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0x54f4ff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.55,
      }),
    );
    this.playerGlow.scale.set(2.1, 2.1, 1);
    this.player.add(this.playerGlow);
    this.scene.add(this.player);
  }

  createShards() {
    const positions = [
      [-8, 0.7, 6.5],
      [-8.4, 0.7, -2.8],
      [-1.5, 0.7, -7.2],
      [2.5, 0.7, 7.8],
      [8.4, 0.7, 0.4],
      [1.8, 0.7, 3.8],
    ];
    this.shards = positions.map((position, index) => {
      const group = new THREE.Group();
      group.position.set(...position);
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.26, 0),
        emissiveMaterial(index % 2 ? 0x9d74ff : 0x54f4ff, 2.5),
      );
      shard.scale.y = 1.65;
      group.add(shard);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.44, 0.018, 6, 28),
        emissiveMaterial(index % 2 ? 0x9d74ff : 0x54f4ff, 2),
      );
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      group.userData = { index, collected: false, shard, ring, baseY: position[1] };
      this.scene.add(group);
      return group;
    });
  }

  createDataTraffic() {
    this.dataBits = [];
    const geometry = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    for (let index = 0; index < 36; index += 1) {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: index % 3 === 0 ? 0xb8ff62 : index % 2 ? 0x9d74ff : 0x54f4ff,
          transparent: true,
          opacity: 0.58,
        }),
      );
      mesh.userData = {
        phase: Math.random() * Math.PI * 2,
        radius: 3.2 + Math.random() * 6.5,
        speed: 0.08 + Math.random() * 0.18,
        height: 0.5 + Math.random() * 3.2,
      };
      this.dataBits.push(mesh);
      this.scene.add(mesh);
    }
  }

  bindEvents() {
    this.onResize = () => this.resize();
    this.onPointerDown = (event) => {
      if (event.button !== 0 || this.panelOpen) return;
      this.pointerDragging = true;
      this.pointerStart.set(event.clientX, event.clientY);
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture?.(event.pointerId);
    };
    this.onPointerMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      if (this.pointerDragging && this.lastPointer) {
        const dx = event.clientX - this.lastPointer.x;
        const dy = event.clientY - this.lastPointer.y;
        if (Math.abs(event.clientX - this.pointerStart.x) + Math.abs(event.clientY - this.pointerStart.y) > 5) {
          this.cameraFocus = null;
        }
        this.cameraYaw -= dx * 0.006;
        this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + dy * 0.004, 0.42, 1.08);
        this.lastPointer = { x: event.clientX, y: event.clientY };
      }
      this.pickNode(event.clientX, event.clientY);
    };
    this.onPointerUp = (event) => {
      const wasClick = this.pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) < 7;
      this.pointerDragging = false;
      this.lastPointer = null;
      if (wasClick && this.hoveredNode && !this.panelOpen) this.interact(this.hoveredNode);
    };
    this.onWheel = (event) => {
      this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance + event.deltaY * 0.012, 8.5, 22);
      this.cameraFocus = null;
    };
    this.onContextLost = (event) => {
      event.preventDefault();
      this.callbacks.onFallback?.(new Error('The WebGL context was lost.'));
    };

    window.addEventListener('resize', this.onResize, { passive: true });
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove, { passive: true });
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: true });
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(1, this.root.clientWidth || window.innerWidth);
    const height = Math.max(1, this.root.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.nodes) {
      Object.values(this.nodes).forEach((node) => {
        node.userData.label.scale.set(width < 600 ? 2.25 : 3.25, width < 600 ? 0.57 : 0.82, 1);
      });
    }
  }

  setActive(active) {
    this.active = Boolean(active);
  }

  setPanelOpen(open) {
    this.panelOpen = Boolean(open);
    if (open) this.keys.clear();
  }

  setMovement(direction, pressed) {
    if (this.arcadeActive && pressed) {
      const map = {
        up: [0, -1],
        down: [0, 1],
        left: [-1, 0],
        right: [1, 0],
      };
      const vector = map[direction];
      if (vector) this.packetChase.setDirection(vector[0], vector[1]);
      return;
    }
    if (pressed) this.keys.add(direction);
    else this.keys.delete(direction);
  }

  focusNode(nodeId) {
    const node = this.nodes[nodeId];
    if (!node) return;
    this.cameraFocus = {
      target: node.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
      distance: nodeId === 'arcade' ? 10 : 11.5,
      until: this.elapsed + 3.2,
    };
  }

  startArcade() {
    this.active = true;
    this.panelOpen = false;
    this.arcadeActive = true;
    this.keys.clear();
    this.packetChase.start();
    this.nodes.arcade.userData.label.visible = false;
    this.cameraFocus = {
      target: new THREE.Vector3(6.1, 0.45, -7.1),
      distance: 8.2,
      until: Number.POSITIVE_INFINITY,
      pitch: 0.92,
      yaw: 0.02,
    };
  }

  stopArcade() {
    this.arcadeActive = false;
    this.packetChase.stop();
    this.nodes.arcade.userData.label.visible = true;
    this.cameraFocus = null;
  }

  interactNearest() {
    if (this.arcadeActive) return;
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    Object.entries(this.nodes).forEach(([nodeId, node]) => {
      const distance = this.player.position.distanceTo(node.position);
      if (distance < nearestDistance) {
        nearest = nodeId;
        nearestDistance = distance;
      }
    });
    if (nearest && nearestDistance <= 2.6) this.interact(nearest);
    else this.callbacks.onHint?.('Move closer to a glowing node.');
  }

  interact(nodeId) {
    if (nodeId === 'arcade') this.startArcade();
    this.callbacks.onInteract?.(nodeId);
  }

  pickNode(clientX, clientY) {
    if (!this.camera || !this.raycaster || this.panelOpen || this.pointerDragging) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.interactiveObjects, false)[0];
    const nodeId = hit?.object?.userData?.nodeId || null;
    if (nodeId !== this.hoveredNode) {
      this.hoveredNode = nodeId;
      this.canvas.style.cursor = nodeId ? 'pointer' : this.active ? 'grab' : 'default';
    }
    this.callbacks.onHover?.(nodeId, { x: clientX, y: clientY });
  }

  updatePlayer(dt, time) {
    this.player.position.y = 0.55 + Math.sin(time * 3.1) * 0.055;
    this.playerRing.rotation.z += dt * 1.8;
    this.playerGlow.material.opacity = 0.44 + Math.sin(time * 4.1) * 0.08;
    if (!this.active || this.panelOpen || this.arcadeActive) return;

    const input = new THREE.Vector2(
      (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0),
      (this.keys.has('down') ? 1 : 0) - (this.keys.has('up') ? 1 : 0),
    );
    if (input.lengthSq() === 0) return;
    input.normalize();
    const forward = new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
    const right = new THREE.Vector3().crossVectors(WORLD_UP, forward);
    const velocity = forward.multiplyScalar(-input.y).add(right.multiplyScalar(input.x)).normalize();
    this.player.position.addScaledVector(velocity, dt * 4.3);
    this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, -PLAYER_LIMIT, PLAYER_LIMIT);
    this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, -PLAYER_LIMIT, PLAYER_LIMIT);
    this.player.rotation.y = Math.atan2(velocity.x, velocity.z);
    this.cameraFocus = null;
  }

  updateCamera(dt) {
    let target = new THREE.Vector3(
      this.player.position.x * 0.55,
      this.player.position.y,
      this.player.position.z * 0.55,
    );
    let desiredDistance = this.cameraDistance;
    let yaw = this.cameraYaw;
    let pitch = this.cameraPitch;

    if (this.cameraFocus) {
      target = this.cameraFocus.target;
      desiredDistance = this.cameraFocus.distance;
      yaw = this.cameraFocus.yaw ?? this.cameraYaw;
      pitch = this.cameraFocus.pitch ?? this.cameraPitch;
      if (this.elapsed > this.cameraFocus.until && !this.arcadeActive) this.cameraFocus = null;
    }

    this.cameraTarget.lerp(target, 1 - Math.pow(0.001, dt));
    const horizontal = Math.cos(pitch) * desiredDistance;
    const desired = new THREE.Vector3(
      this.cameraTarget.x + Math.sin(yaw) * horizontal,
      this.cameraTarget.y + Math.sin(pitch) * desiredDistance,
      this.cameraTarget.z + Math.cos(yaw) * horizontal,
    );
    this.camera.position.lerp(desired, 1 - Math.pow(0.003, dt));
    this.camera.lookAt(this.cameraTarget);
  }

  updateNodes(time, dt) {
    Object.values(this.nodes).forEach((node, index) => {
      const { icon, ring, label, glow } = node.userData;
      icon.rotation.y += dt * icon.userData.spin;
      icon.rotation.x += dt * 0.2;
      ring.rotation.z += dt * (0.3 + index * 0.05);
      label.position.y = label.userData.baseY + Math.sin(time * 1.9 + index) * 0.07;
      const near = this.player.position.distanceTo(node.position) < 2.6;
      const hovered = this.hoveredNode === node.userData.nodeId;
      const scale = near || hovered ? 1.08 : 1;
      node.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.08);
      glow.material.opacity = near || hovered ? 0.72 : 0.38 + Math.sin(time * 2 + index) * 0.07;
    });
  }

  updateShards(time, dt) {
    this.shards.forEach((group, index) => {
      if (group.userData.collected) return;
      group.position.y = group.userData.baseY + Math.sin(time * 2.4 + index) * 0.16;
      group.userData.shard.rotation.y += dt * 1.5;
      group.userData.ring.rotation.z += dt * 0.9;
      if (this.active && !this.arcadeActive && this.player.position.distanceTo(group.position) < 0.9) {
        group.userData.collected = true;
        group.visible = false;
        this.shardsCollected += 1;
        this.callbacks.onCollect?.({ count: this.shardsCollected, total: this.shards.length });
      }
    });
  }

  updateTraffic(time) {
    this.dataBits.forEach((bit) => {
      const data = bit.userData;
      const angle = data.phase + time * data.speed;
      bit.position.set(
        Math.cos(angle) * data.radius,
        data.height + Math.sin(time * 1.4 + data.phase) * 0.35,
        Math.sin(angle) * data.radius,
      );
      bit.rotation.x = angle;
      bit.rotation.y = angle * 1.4;
    });
  }

  render() {
    if (this.disposed) return;
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.elapsed += dt;
    this.frames += 1;
    this.fpsElapsed += dt;
    if (this.fpsElapsed >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsElapsed);
      this.frames = 0;
      this.fpsElapsed = 0;
    }

    this.floorMaterial.uniforms.uTime.value = this.elapsed;
    this.coreCrystal.rotation.x += dt * 0.25;
    this.coreCrystal.rotation.y += dt * 0.46;
    this.coreCrystal.position.y = 1.45 + Math.sin(this.elapsed * 1.8) * 0.12;
    this.coreRings.forEach((ring, index) => {
      ring.rotation.y += dt * (index % 2 ? -0.72 : 0.52);
      ring.rotation.z += dt * (0.18 + index * 0.08);
    });
    this.stars.rotation.y += dt * 0.006;
    this.updatePlayer(dt, this.elapsed);
    this.updateCamera(dt);
    this.updateNodes(this.elapsed, dt);
    this.updateShards(this.elapsed, dt);
    this.updateTraffic(this.elapsed);
    this.packetChase.update(dt, this.elapsed);
    this.holoPong.update(dt, this.elapsed);
    this.renderer.render(this.scene, this.camera);

    this.telemetryAccumulator += dt;
    if (this.telemetryAccumulator >= 0.2) {
      this.telemetryAccumulator = 0;
      this.callbacks.onTelemetry?.({
        fps: this.fps,
        x: this.player.position.x,
        z: this.player.position.z,
      });
    }
  }

  destroy() {
    this.disposed = true;
    this.renderer?.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    this.canvas?.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas?.removeEventListener('pointermove', this.onPointerMove);
    this.canvas?.removeEventListener('pointerup', this.onPointerUp);
    this.canvas?.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas?.removeEventListener('wheel', this.onWheel);
    this.canvas?.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer?.dispose();
    this.timer?.dispose();
    this.glowTexture?.dispose();
  }
}
