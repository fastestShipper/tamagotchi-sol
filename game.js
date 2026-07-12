// Core game: pet state machine, energy, rendering, donation reactions.
const S = window.Sprites;

const WORLD_W = 160;
const WORLD_H = 100;
const FLOOR_Y = 78; // top of grass
const PET_W = 16;

const ENERGY_MAX = 100;
const DRAIN_PER_SEC = 0.14;      // ~12 min of life from full
const SLEEP_DRAIN_PER_SEC = 0.05;
const SLEEPY_THRESHOLD = 30;

// Donation tiers, highest first. minSol is the floor for that tier.
const TIERS = [
  { id: 'crown', minSol: 0.5,  label: 'GOLDEN CROWN', energy: ENERGY_MAX, sprite: 'CROWN',
    thanks: ['A CROWN?! I am royalty now, thank you {donor}!', 'Thank you {donor}, I shall rule this meadow with sweetness'] },
  { id: 'party', minSol: 0.1,  label: 'CAKE PARTY', energy: ENERGY_MAX, sprite: 'CAKE',
    thanks: ['CAAAKE! {donor} you are my favorite person!', 'Party time! All thanks to {donor}!'] },
  { id: 'toy',   minSol: 0.05, label: 'NEW BALL', energy: 45, sprite: 'BALL',
    thanks: ['A ball! Thanks {donor}, watch me play!', '{donor} got me a ball, I am so happy!'] },
  { id: 'meal',  minSol: 0.02, label: 'FULL MEAL', energy: 60, sprite: 'BOWL',
    thanks: ['Nom nom nom... thank you {donor}!', 'A feast! {donor} knows what I like'] },
  { id: 'snack', minSol: 0.01, label: 'SNACK', energy: 25, sprite: 'APPLE',
    thanks: ['A little apple! Thanks {donor}!', 'Crunch crunch, thanks {donor}!'] },
  { id: 'tip',   minSol: 0,    label: 'TINY TIP', energy: 5, sprite: 'HEART',
    thanks: ['Every lamport counts, thanks {donor}!'] },
];

const IDLE_PHRASES = [
  'la la la~', 'feeling sleepy...', 'does anyone love me?', 'what a lovely day',
  'let\'s play!', 'mmm... snacks', 'boing boing', 'hi hi!',
];
const HUNGRY_PHRASES = [
  'i\'m hungry...', 'feeling weak...', '0.01 SOL and i keep dancing...',
  'don\'t let me die...', 'a snack please...',
];

const SAVE_KEY = 'pixelpet_save_v1';

// Lifetime stats persist even across pet deaths (the "stakes").
const defaultStats = () => ({
  totalSol: 0, donations: 0, bestLifeMs: 0, petsLost: 0,
});

const state = {
  energy: ENERGY_MAX,
  activity: 'idle',      // idle | walk | play | eat | party | sleep | dead
  activityUntil: 0,
  x: 88, facing: 1,
  frame: 0,
  hasCrown: false,
  sugarRushUntil: 0,     // crown buff: half drain (performance.now clock)
  ballUntil: 0,          // toy: chases ball
  ballX: 60,
  confetti: [],
  clouds: [{ x: 18, y: 12, s: 1 }, { x: 90, y: 26, s: 0.6 }, { x: 130, y: 8, s: 0.8 }],
  dead: false,
  bornAt: Date.now(),
  stats: defaultStats(),
};

// Persist only the durable fields. sugarRush is stored as remaining ms so it
// survives the performance.now() clock reset on reload.
function saveState() {
  const sugarRemaining = Math.max(0, state.sugarRushUntil - performance.now());
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    energy: state.energy,
    hasCrown: state.hasCrown,
    sugarRemaining,
    bornAt: state.bornAt,
    dead: state.dead,
    lastSeen: Date.now(),
    stats: state.stats,
  }));
}

function loadState() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { saved = null; }
  if (!saved) return;

  state.stats = { ...defaultStats(), ...(saved.stats || {}) };
  state.bornAt = saved.bornAt || Date.now();
  state.hasCrown = !!saved.hasCrown;
  state.sugarRushUntil = performance.now() + (saved.sugarRemaining || 0);

  if (saved.dead) { state.dead = true; state.activity = 'dead'; state.energy = 0; return; }

  // The pet keeps starving while the tab is closed. Apply offline drain.
  const offlineSec = Math.max(0, (Date.now() - (saved.lastSeen || Date.now())) / 1000);
  const drainRate = saved.sugarRemaining > 0 ? DRAIN_PER_SEC * 0.5 : DRAIN_PER_SEC;
  state.energy = Math.max(0, (saved.energy ?? ENERGY_MAX) - drainRate * offlineSec);
  if (state.energy <= 0) { state.dead = true; state.activity = 'dead'; state.offlineDeath = true; }
}

let canvas, ctx, lastTime = 0, lastLogicAt = 0, animTimer = 0, blinkTimer = 0, phraseTimer = 8;

function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  loadState();
  UI.renderStats(state.stats);

  lastTime = performance.now();
  lastLogicAt = lastTime;
  requestAnimationFrame(loop);
  setInterval(heartbeat, 1000);
  setInterval(saveState, 5000);
  // Save when the tab is hidden or closed so offline drain is accurate.
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });
  window.addEventListener('beforeunload', saveState);

  if (state.dead) {
    UI.showDeath(Date.now() - state.bornAt, state.stats, state.offlineDeath);
  } else {
    setActivity('walk', 4);
  }
  render(); // first paint even if rAF is throttled (hidden tab)
}

function setActivity(name, seconds) {
  state.activity = name;
  state.activityUntil = performance.now() + seconds * 1000;
}

function pickNextActivity() {
  if (state.dead) return;
  if (performance.now() < state.ballUntil) { setActivity('play', 3); return; }
  if (state.energy < SLEEPY_THRESHOLD) {
    setActivity(Math.random() < 0.6 ? 'sleep' : 'idle', 5 + Math.random() * 4);
    return;
  }
  const roll = Math.random();
  if (roll < 0.45) setActivity('walk', 2 + Math.random() * 4);
  else if (roll < 0.75) setActivity('idle', 2 + Math.random() * 3);
  else setActivity('play', 3 + Math.random() * 3);
}

// Energy uses real elapsed time (uncapped) so hidden tabs still drain honestly.
function drainEnergy(elapsedSec) {
  if (state.dead) return;
  let drain = state.activity === 'sleep' ? SLEEP_DRAIN_PER_SEC : DRAIN_PER_SEC;
  if (performance.now() < state.sugarRushUntil) drain *= 0.5;
  state.energy = Math.max(0, state.energy - drain * elapsedSec);
  if (state.energy <= 0) die();
}

function update(dt) {
  if (state.dead) return;

  // Activity scheduling
  if (performance.now() > state.activityUntil) pickNextActivity();

  // Movement
  if (state.activity === 'walk') {
    state.x += state.facing * 14 * dt;
    if (state.x < 8) { state.x = 8; state.facing = 1; }
    if (state.x > WORLD_W - PET_W - 8) { state.x = WORLD_W - PET_W - 8; state.facing = -1; }
    if (Math.random() < 0.008) state.facing *= -1;
  } else if (state.activity === 'play') {
    // Chase the ball back and forth
    state.ballX = WORLD_W / 2 + Math.sin(performance.now() / 600) * 50;
    const target = state.ballX - PET_W / 2;
    const diff = target - state.x;
    state.facing = diff > 0 ? 1 : -1;
    state.x += Math.sign(diff) * Math.min(Math.abs(diff), 30 * dt);
  }

  // Confetti physics
  state.confetti = state.confetti.filter(p => p.y < WORLD_H);
  for (const p of state.confetti) { p.y += p.vy * dt; p.x += p.vx * dt; }

  // Ambient speech
  phraseTimer -= dt;
  if (phraseTimer <= 0 && state.activity !== 'sleep') {
    const pool = state.energy < SLEEPY_THRESHOLD ? HUNGRY_PHRASES : IDLE_PHRASES;
    say(pool[Math.floor(Math.random() * pool.length)], 3500);
    phraseTimer = 7 + Math.random() * 8;
  }

  // Timers for anim frames + blink
  animTimer += dt;
  if (animTimer > 0.25) { animTimer = 0; state.frame = (state.frame + 1) % 2; }
  blinkTimer += dt;

  // Clouds drift
  for (const c of state.clouds) {
    c.x += c.s * 2 * dt;
    if (c.x > WORLD_W + 20) c.x = -30;
  }
}

function die() {
  state.dead = true;
  state.activity = 'dead';
  const lifeMs = Date.now() - state.bornAt;
  state.stats.petsLost += 1;
  state.stats.bestLifeMs = Math.max(state.stats.bestLifeMs, lifeMs);
  saveState();
  say('...', 2000);
  UI.showDeath(lifeMs, state.stats);
  UI.renderStats(state.stats);
}

function currentSprite() {
  switch (state.activity) {
    case 'sleep': return S.CAT_SLEEP;
    case 'eat':   return S.CAT_EAT;
    case 'party': return S.CAT_HAPPY;
    case 'play':  return state.frame ? S.CAT_HAPPY : S.CAT_IDLE;
    case 'dead':  return S.CAT_DEAD;
    default:
      if (blinkTimer % 4 > 3.8) return S.CAT_BLINK;
      return S.CAT_IDLE;
  }
}

function render() {
  // Sky bands
  const bands = ['#bfe8ff', '#cdeeff', '#dbf4ff', '#e9faff'];
  for (let i = 0; i < bands.length; i++) {
    ctx.fillStyle = bands[i];
    ctx.fillRect(0, i * 24, WORLD_W, 24);
  }
  // Sun
  ctx.fillStyle = '#ffe28a';
  ctx.fillRect(136, 8, 12, 12);
  ctx.fillStyle = '#ffd94a';
  ctx.fillRect(138, 10, 8, 8);
  // Clouds
  ctx.fillStyle = '#ffffff';
  for (const c of state.clouds) {
    const x = Math.round(c.x), y = c.y;
    ctx.fillRect(x, y + 3, 22, 5);
    ctx.fillRect(x + 4, y, 12, 4);
  }
  // Grass
  ctx.fillStyle = '#8fd97a';
  ctx.fillRect(0, FLOOR_Y, WORLD_W, WORLD_H - FLOOR_Y);
  ctx.fillStyle = '#6fbf5e';
  for (let x = 0; x < WORLD_W; x += 10) ctx.fillRect(x + (x % 20 ? 3 : 6), FLOOR_Y, 2, 3);
  // Flowers
  ctx.fillStyle = '#ff9fb8';
  ctx.fillRect(24, FLOOR_Y + 8, 2, 2); ctx.fillRect(132, FLOOR_Y + 12, 2, 2);
  ctx.fillStyle = '#ffd94a';
  ctx.fillRect(90, FLOOR_Y + 14, 2, 2);

  const px = Math.round(state.x);
  const bounce = (state.activity === 'walk' || state.activity === 'play') && state.frame ? -1 : 0;
  const py = FLOOR_Y - 15 + bounce;

  if (state.dead) {
    S.drawSprite(ctx, S.GRAVE, px, FLOOR_Y - 15);
  } else {
    if (performance.now() < state.ballUntil) {
      S.drawSprite(ctx, S.BALL, Math.round(state.ballX), FLOOR_Y - 7);
    }
    S.drawSprite(ctx, currentSprite(), px, py, state.facing < 0);
    if (state.hasCrown && state.activity !== 'sleep') {
      S.drawSprite(ctx, S.CROWN, px + 3, py - 3, state.facing < 0);
    }
    if (state.activity === 'sleep') {
      ctx.fillStyle = '#3b2d3f';
      const t = Math.floor(performance.now() / 500) % 3;
      ctx.font = '6px monospace';
      ctx.fillText('z', px + 16 + t, py - 2 - t * 2);
    }
  }

  // Confetti
  for (const p of state.confetti) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
  }

  UI.setEnergy(state.energy);
}

function loop(t) {
  const rawDt = (t - lastTime) / 1000;
  const dt = Math.min(rawDt, 0.1); // cap for movement/animation only
  lastTime = t;
  lastLogicAt = performance.now();
  drainEnergy(rawDt);
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// Heartbeat: browsers freeze rAF in hidden/occluded tabs, but setInterval
// still fires (throttled to >=1s). Keeps energy draining and death honest.
function heartbeat() {
  const now = performance.now();
  const elapsed = (now - lastLogicAt) / 1000;
  if (elapsed > 1.5) { // rAF is frozen; take over logic
    lastLogicAt = now;
    drainEnergy(elapsed);
    UI.setEnergy(state.energy);
  }
}

function say(text, ms) {
  UI.showBubble(text, state.x / WORLD_W, ms);
}

function throwConfetti(n) {
  const colors = ['#ff9fb8', '#ffd94a', '#8fd97a', '#7fc8f0', '#c98ff2'];
  for (let i = 0; i < n; i++) {
    state.confetti.push({
      x: Math.random() * WORLD_W, y: -Math.random() * 30,
      vx: (Math.random() - 0.5) * 10, vy: 20 + Math.random() * 25,
      color: colors[i % colors.length],
    });
  }
}

// Entry point for donations (real or demo). amountSol is a number, donor a display string.
function onDonation(amountSol, donor) {
  if (state.dead) return;
  const tier = TIERS.find(t => amountSol >= t.minSol) || TIERS[TIERS.length - 1];
  state.energy = Math.min(ENERGY_MAX, state.energy + tier.energy);
  state.stats.totalSol += amountSol;
  state.stats.donations += 1;
  UI.renderStats(state.stats);

  const shortDonor = donor.length > 12 ? donor.slice(0, 4) + '..' + donor.slice(-4) : donor;
  const msg = tier.thanks[Math.floor(Math.random() * tier.thanks.length)]
    .replace('{donor}', shortDonor);

  UI.showAlert(tier, amountSol, shortDonor);
  say(msg, 6000);
  UI.playChime(tier.id);

  saveState();

  switch (tier.id) {
    case 'crown':
      state.hasCrown = true;
      state.sugarRushUntil = performance.now() + 10 * 60 * 1000;
      throwConfetti(80);
      setActivity('party', 6);
      break;
    case 'party':
      throwConfetti(60);
      setActivity('party', 6);
      break;
    case 'toy':
      state.ballUntil = performance.now() + 30 * 1000;
      setActivity('play', 5);
      break;
    case 'meal':
      setActivity('eat', 4);
      break;
    case 'snack':
      setActivity('eat', 2.5);
      break;
    default:
      setActivity('party', 2);
  }
}

function restart() {
  // Fresh pet, but lifetime stats (donations, pets lost) carry over.
  state.energy = ENERGY_MAX;
  state.dead = false;
  state.offlineDeath = false;
  state.hasCrown = false;
  state.sugarRushUntil = 0;
  state.ballUntil = 0;
  state.confetti = [];
  state.bornAt = Date.now();
  setActivity('walk', 3);
  UI.hideDeath();
  saveState();
  say('hello! i\'m new here!', 4000);
}

window.Game = { init, onDonation, restart, TIERS, state };
