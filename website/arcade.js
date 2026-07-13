import * as THREE from './vendor/three.module.min.js';

const COLORS = {
  cyan: 0x54f4ff,
  violet: 0x9d74ff,
  lime: 0xb8ff62,
  amber: 0xffc857,
  ink: 0x071019,
  grid: 0x173c4b,
};

function neonMaterial(color, intensity = 1.5) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.38,
    metalness: 0.22,
  });
}

function createVoxelCourier() {
  const courier = new THREE.Group();
  courier.name = 'packet-courier';

  const suit = neonMaterial(COLORS.violet, 0.65);
  const skin = neonMaterial(0xffc4a3, 0.35);
  const visor = neonMaterial(COLORS.cyan, 2.1);
  const boot = neonMaterial(0x19233c, 0.25);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.28), suit);
  torso.position.y = 0.56;
  courier.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skin);
  head.position.y = 0.98;
  courier.add(head);

  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.035), visor);
  visorMesh.position.set(0, 1.01, 0.177);
  courier.add(visorMesh);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.16), neonMaterial(COLORS.amber, 1.25));
  pack.position.set(0, 0.61, -0.22);
  courier.add(pack);

  const limbGeometry = new THREE.BoxGeometry(0.13, 0.42, 0.13);
  const leftArm = new THREE.Mesh(limbGeometry, suit);
  const rightArm = new THREE.Mesh(limbGeometry, suit);
  leftArm.position.set(-0.28, 0.57, 0);
  rightArm.position.set(0.28, 0.57, 0);
  courier.add(leftArm, rightArm);

  const legGeometry = new THREE.BoxGeometry(0.15, 0.38, 0.18);
  const leftLeg = new THREE.Mesh(legGeometry, boot);
  const rightLeg = new THREE.Mesh(legGeometry, boot);
  leftLeg.position.set(-0.12, 0.18, 0);
  rightLeg.position.set(0.12, 0.18, 0);
  courier.add(leftLeg, rightLeg);

  courier.userData.limbs = { leftArm, rightArm, leftLeg, rightLeg };
  courier.scale.setScalar(0.82);
  return courier;
}

function createGrid(size, divisions) {
  const points = [];
  const half = size / 2;
  const step = size / divisions;

  for (let index = 0; index <= divisions; index += 1) {
    const value = -half + index * step;
    points.push(-half, 0, value, half, 0, value);
    points.push(value, 0, -half, value, 0, half);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: COLORS.grid, transparent: true, opacity: 0.76 }),
  );
}

export class PacketChase {
  constructor({ onState } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'packet-chase';
    this.onState = onState || (() => {});
    this.gridSize = 11;
    this.cell = 0.48;
    this.half = Math.floor(this.gridSize / 2);
    this.mode = 'attract';
    this.status = 'ATTRACT MODE';
    this.score = 0;
    this.direction = { x: 1, z: 0 };
    this.queuedDirection = { x: 1, z: 0 };
    this.accumulator = 0;
    this.elapsed = 0;
    this.catchGrace = 0;
    this.snakeCells = [];

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(6.15, 0.18, 6.15),
      new THREE.MeshStandardMaterial({
        color: COLORS.ink,
        emissive: 0x071b25,
        emissiveIntensity: 0.45,
        roughness: 0.66,
        metalness: 0.55,
      }),
    );
    board.position.y = -0.12;
    board.receiveShadow = true;
    this.group.add(board);

    const grid = createGrid(this.gridSize * this.cell, this.gridSize);
    grid.position.y = 0.002;
    this.group.add(grid);

    const railMaterial = neonMaterial(COLORS.cyan, 1.4);
    const railGeometryX = new THREE.BoxGeometry(6.25, 0.12, 0.08);
    const railGeometryZ = new THREE.BoxGeometry(0.08, 0.12, 6.25);
    for (const z of [-3.07, 3.07]) {
      const rail = new THREE.Mesh(railGeometryX, railMaterial);
      rail.position.set(0, 0.04, z);
      this.group.add(rail);
    }
    for (const x of [-3.07, 3.07]) {
      const rail = new THREE.Mesh(railGeometryZ, railMaterial);
      rail.position.set(x, 0.04, 0);
      this.group.add(rail);
    }

    this.snakeMeshes = [];
    const segmentGeometry = new THREE.BoxGeometry(0.38, 0.32, 0.38);
    for (let index = 0; index < 22; index += 1) {
      const segment = new THREE.Mesh(
        segmentGeometry,
        neonMaterial(index === 0 ? COLORS.lime : COLORS.cyan, index === 0 ? 2.4 : 1.45),
      );
      segment.castShadow = true;
      segment.position.y = 0.22;
      this.snakeMeshes.push(segment);
      this.group.add(segment);
    }

    this.packet = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.25, 0),
      neonMaterial(COLORS.amber, 2.7),
    );
    this.packet.castShadow = true;
    this.group.add(this.packet);

    this.courier = createVoxelCourier();
    this.group.add(this.courier);

    this.resetAttract();
  }

  emitState() {
    this.onState({ mode: this.mode, status: this.status, score: this.score });
  }

  cellToPosition(cell, target = new THREE.Vector3()) {
    return target.set(cell.x * this.cell, 0.22, cell.z * this.cell);
  }

  resetAttract() {
    this.mode = 'attract';
    this.status = 'RUNNING LIVE';
    this.score = 0;
    this.elapsed = 0;
    this.packet.position.set(0, 0.42, 0);
    this.snakeMeshes.forEach((segment, index) => {
      segment.visible = index < 12;
    });
    this.emitState();
  }

  start() {
    this.mode = 'playing';
    this.status = 'YOU ARE THE PACKET';
    this.score = 0;
    this.direction = { x: 1, z: 0 };
    this.queuedDirection = { x: 1, z: 0 };
    this.snakeCells = [
      { x: -1, z: 0 },
      { x: -2, z: 0 },
      { x: -3, z: 0 },
      { x: -4, z: 0 },
    ];
    this.accumulator = 0;
    this.catchGrace = 2.4;
    this.courier.position.set(-this.half * this.cell, 0, -this.half * this.cell);
    this.spawnPacket();
    this.paintSnakeCells();
    this.emitState();
  }

  stop() {
    this.resetAttract();
  }

  setDirection(x, z) {
    if (this.mode !== 'playing') return;
    if (x === -this.direction.x && z === -this.direction.z) return;
    this.queuedDirection = { x, z };
  }

  spawnPacket() {
    const freeCells = [];
    for (let x = -this.half; x <= this.half; x += 1) {
      for (let z = -this.half; z <= this.half; z += 1) {
        if (!this.snakeCells.some((cell) => cell.x === x && cell.z === z)) freeCells.push({ x, z });
      }
    }
    const next = freeCells[Math.floor(Math.random() * freeCells.length)] || { x: 0, z: 0 };
    this.packetCell = next;
    this.cellToPosition(next, this.packet.position);
    this.packet.position.y = 0.43;
  }

  paintSnakeCells() {
    this.snakeMeshes.forEach((segment, index) => {
      const cell = this.snakeCells[index];
      segment.visible = Boolean(cell);
      if (cell) this.cellToPosition(cell, segment.position);
    });
  }

  gameOver(reason) {
    this.status = reason;
    this.emitState();
    this.mode = 'gameover';
    this.gameOverTimer = 1.45;
  }

  stepGame() {
    this.direction = this.queuedDirection;
    const head = this.snakeCells[0];
    const next = { x: head.x + this.direction.x, z: head.z + this.direction.z };
    const hitWall = Math.abs(next.x) > this.half || Math.abs(next.z) > this.half;
    const hitSelf = this.snakeCells.some((cell) => cell.x === next.x && cell.z === next.z);
    if (hitWall || hitSelf) {
      this.gameOver(hitWall ? 'SIGNAL LOST' : 'STACK OVERFLOW');
      return;
    }

    this.snakeCells.unshift(next);
    if (next.x === this.packetCell.x && next.z === this.packetCell.z) {
      this.score += 10;
      this.status = 'PACKET SECURED';
      this.spawnPacket();
      this.emitState();
    } else {
      this.snakeCells.pop();
    }
    this.paintSnakeCells();
  }

  updateCourier(dt, time) {
    const limbs = this.courier.userData.limbs;
    const gait = Math.sin(time * 11) * 0.72;
    limbs.leftArm.rotation.x = gait;
    limbs.rightArm.rotation.x = -gait;
    limbs.leftLeg.rotation.x = -gait;
    limbs.rightLeg.rotation.x = gait;
    this.courier.position.y = Math.abs(Math.sin(time * 11)) * 0.075;

    if (this.mode === 'playing') {
      const targetCell = this.snakeCells[this.snakeCells.length - 1];
      if (!targetCell) return;
      const target = this.cellToPosition(targetCell, new THREE.Vector3());
      target.y = 0;
      const delta = target.clone().sub(this.courier.position);
      delta.y = 0;
      const distance = delta.length();
      if (distance > 0.001) {
        const heading = Math.atan2(delta.x, delta.z);
        this.courier.rotation.y = heading;
        this.courier.position.addScaledVector(delta.normalize(), dt * (1.22 + this.score * 0.003));
      }
      if (this.catchGrace <= 0 && distance < 0.31) {
        this.gameOver('COURIER CAUGHT YOU');
      }
    }
  }

  updateAttract(time) {
    for (let index = 0; index < 12; index += 1) {
      const phase = time * 0.92 - index * 0.28;
      const segment = this.snakeMeshes[index];
      segment.position.set(Math.sin(phase) * 2.1, 0.22, Math.sin(phase * 2) * 1.62);
      segment.rotation.y = phase;
    }
    const chasePhase = time * 0.92 - 12 * 0.28;
    const courierTarget = new THREE.Vector3(
      Math.sin(chasePhase) * 2.1,
      0,
      Math.sin(chasePhase * 2) * 1.62,
    );
    this.courier.position.x = THREE.MathUtils.lerp(this.courier.position.x, courierTarget.x, 0.18);
    this.courier.position.z = THREE.MathUtils.lerp(this.courier.position.z, courierTarget.z, 0.18);
    this.courier.rotation.y = Math.atan2(
      courierTarget.x - this.courier.position.x,
      courierTarget.z - this.courier.position.z,
    );
  }

  update(dt, time) {
    this.elapsed += dt;
    this.packet.rotation.y += dt * 2.5;
    this.packet.rotation.x += dt * 1.4;
    this.packet.position.y = 0.43 + Math.sin(time * 3.2) * 0.08;

    if (this.mode === 'attract') {
      this.updateAttract(time);
    } else if (this.mode === 'playing') {
      this.catchGrace = Math.max(0, this.catchGrace - dt);
      this.accumulator += dt;
      const cadence = Math.max(0.105, 0.18 - this.score * 0.0007);
      while (this.accumulator >= cadence && this.mode === 'playing') {
        this.accumulator -= cadence;
        this.stepGame();
      }
    } else if (this.mode === 'gameover') {
      this.gameOverTimer -= dt;
      this.snakeMeshes.forEach((segment, index) => {
        if (segment.visible) segment.position.y = 0.22 + Math.sin(time * 16 + index) * 0.11;
      });
      if (this.gameOverTimer <= 0) this.start();
    }

    this.updateCourier(dt, time);
  }
}

export class HoloPong {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'holo-pong';
    this.bounds = { x: 1.72, y: 1.05 };
    this.velocity = new THREE.Vector2(1.55, 1.18);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(4.1, 2.7),
      new THREE.MeshBasicMaterial({
        color: 0x061826,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      }),
    );
    this.group.add(screen);

    const frameMaterial = neonMaterial(COLORS.violet, 1.8);
    const horizontal = new THREE.BoxGeometry(4.25, 0.07, 0.07);
    const vertical = new THREE.BoxGeometry(0.07, 2.82, 0.07);
    for (const y of [-1.39, 1.39]) {
      const edge = new THREE.Mesh(horizontal, frameMaterial);
      edge.position.y = y;
      this.group.add(edge);
    }
    for (const x of [-2.1, 2.1]) {
      const edge = new THREE.Mesh(vertical, frameMaterial);
      edge.position.x = x;
      this.group.add(edge);
    }

    const paddleGeometry = new THREE.BoxGeometry(0.13, 0.65, 0.13);
    const paddleMaterial = neonMaterial(COLORS.cyan, 2.2);
    this.leftPaddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
    this.rightPaddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
    this.leftPaddle.position.x = -1.8;
    this.rightPaddle.position.x = 1.8;
    this.group.add(this.leftPaddle, this.rightPaddle);

    this.ball = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13, 0),
      neonMaterial(COLORS.lime, 2.7),
    );
    this.ball.position.z = 0.08;
    this.group.add(this.ball);

    const dividerGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -1.25, 0.02),
      new THREE.Vector3(0, 1.25, 0.02),
    ]);
    this.group.add(
      new THREE.Line(
        dividerGeometry,
        new THREE.LineDashedMaterial({ color: COLORS.grid, dashSize: 0.12, gapSize: 0.1 }),
      ),
    );
    this.group.children.at(-1).computeLineDistances();
  }

  update(dt, time) {
    this.ball.position.x += this.velocity.x * dt;
    this.ball.position.y += this.velocity.y * dt;
    this.ball.rotation.x += dt * 2.4;
    this.ball.rotation.y += dt * 3.1;

    if (Math.abs(this.ball.position.y) >= this.bounds.y) {
      this.ball.position.y = Math.sign(this.ball.position.y) * this.bounds.y;
      this.velocity.y *= -1;
    }
    if (Math.abs(this.ball.position.x) >= this.bounds.x) {
      this.ball.position.x = Math.sign(this.ball.position.x) * this.bounds.x;
      this.velocity.x *= -1;
      this.velocity.y += (Math.random() - 0.5) * 0.22;
    }

    this.leftPaddle.position.y = THREE.MathUtils.lerp(
      this.leftPaddle.position.y,
      this.ball.position.y * 0.86 + Math.sin(time * 0.8) * 0.08,
      0.085,
    );
    this.rightPaddle.position.y = THREE.MathUtils.lerp(
      this.rightPaddle.position.y,
      this.ball.position.y * 0.78 + Math.cos(time * 0.7) * 0.12,
      0.075,
    );
  }
}
