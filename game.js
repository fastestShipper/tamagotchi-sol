// Broke Dev: a pixel developer who survives on SOL tips. Tips do two things:
// refill volatile STAMINA (burnout at zero) and raise cumulative SOL that funds
// visible UPGRADES to this very room/app (no promises of external games — the
// upgrade IS the deliverable, and it happens live).
const D = window.DevSprites;

const WORLD_W = 160;
const WORLD_H = 100;

const ENERGY_MAX = 100;
const DRAIN_PER_SEC = 0.14;       // ~12 min from full to burnout
const SLEEP_DRAIN_PER_SEC = 0.05;
const SLEEPY_THRESHOLD = 30;

// Funded upgrade ladder. thresholds are cumulative SOL. Crossing one visibly
// levels up the room/dev on screen. Escalating so the world keeps growing.
const UPGRADES = [
  { id: 'lamp',     threshold: 0.05, label: 'DESK LAMP',      blurb: 'finally i can see the keyboard' },
  { id: 'plant',    threshold: 0.15, label: 'A LITTLE PLANT', blurb: 'a sign of life in here' },
  { id: 'pc',       threshold: 0.40, label: 'NEW MONITOR',    blurb: 'the toaster is officially retired' },
  { id: 'monitor2', threshold: 1.00, label: 'SECOND SCREEN',  blurb: 'double the screen, double the bugs' },
  { id: 'cat',      threshold: 2.50, label: 'A CODING CAT',   blurb: 'he judges my commits' },
  { id: 'studio',   threshold: 5.00, label: 'STUDIO GLOW',    blurb: 'RGB everything. we made it.' },
];

// Tip tiers = a broke dev's survival kit. Higher tiers restore more stamina.
const TIERS = [
  { id: 'sponsor', minSol: 0.5,  label: 'SPONSOR',   energy: ENERGY_MAX, sprite: 'ICON_SPONSOR',
    thanks: ['A SPONSOR?! {donor} you absolute legend!', '{donor} just backed the whole grind!'] },
  { id: 'rent',    minSol: 0.1,  label: 'RENT PAID',  energy: ENERGY_MAX, sprite: 'ICON_CASH',
    thanks: ['RENT IS PAID! thank you {donor}!', '{donor} kept the lights on another month!'] },
  { id: 'pizza',   minSol: 0.05, label: 'PIZZA',      energy: 55, sprite: 'ICON_PIZZA',
    thanks: ['REAL FOOD! thanks {donor}!', 'pizza time, back to the keyboard {donor}!'] },
  { id: 'redbull', minSol: 0.02, label: 'RED BULL',   energy: 65, sprite: 'ICON_REDBULL',
    thanks: ['WIIINGS! thank you {donor}!', '{donor} fueled the all-nighter!'] },
  { id: 'coffee',  minSol: 0.01, label: 'COFFEE',     energy: 30, sprite: 'ICON_COFFEE',
    thanks: ['caffeine acquired! thanks {donor}!', '{donor} bought me a coffee, we build!'] },
  { id: 'tip',     minSol: 0,    label: 'TIP',        energy: 8,  sprite: 'ICON_TIP',
    thanks: ['every lamport counts, thanks {donor}!'] },
];

const CODING_PHRASES = [
  'git push --force, yolo', 'just one more commit...', 'works on my machine',
  'refactoring... again', 'npm install and pray', 'shipping this upgrade live',
  'stackoverflow is my mentor', 'who needs sleep anyway',
];
const LOW_PHRASES = [
  'running on fumes...', 'need caffeine...', 'my eyes hurt...',
  'rent is due soon...', 'send help (and red bull)...',
];
const BURNOUT_PHRASES = [
  'i cant anymore...', 'burned out. anyone?', 'is someone there...?',
  'one tip and i\'m back... please',
];

// Rotating "features" for the dashboard flavor (shows he actually works).
const FEATURES = [
  'auto-save', 'lighting shader', 'save-game format', 'inventory grid',
  'dialogue system', 'particle FX', 'settings menu', 'pathfinding',
];

const state = {
  energy: ENERGY_MAX,
  activity: 'coding',   // coding | drink | stress | sleep | burnout | ship
  activityUntil: 0,
  frame: 0,
  raised: 0,            // cumulative SOL, monotonic, never decreases
  upgradeLevel: 0,      // count of unlocked visual upgrades (derived from raised)
  sugarRushUntil: 0,    // sponsor buff: half drain
  confetti: [],
  stars: [{ x: 14, y: 12 }, { x: 30, y: 9 }, { x: 22, y: 20 }, { x: 38, y: 16 }],
  bornAt: Date.now(),
  burnout: false,
  // dashboard flavor
  featureIdx: 0,
  buildPct: 12,
  bugs: 0,
  hoursAwake: 0,
  changelog: ['v0.1 — it runs'],
  stats: null,
};

const defaultStats = () => ({ totalSol: 0, donations: 0, upgrades: 0, burnouts: 0 });

let canvas, ctx, lastTime = 0, lastLogicAt = 0, animTimer = 0, blinkTimer = 0, phraseTimer = 6;
let spriteW = 26, spriteH = 22, spriteX = 67, spriteY = 60;
let dashTimer = 0;

// ---------- persistence ----------
const SAVE_KEY = 'brokedev_save_v2';

function upgradesUnlocked(raised) {
  return UPGRADES.filter(u => raised >= u.threshold).length;
}

function saveState() {
  const sugarRemaining = Math.max(0, state.sugarRushUntil - performance.now());
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    energy: state.energy, raised: state.raised, sugarRemaining,
    bornAt: state.bornAt, burnout: state.burnout, hoursAwake: state.hoursAwake,
    changelog: state.changelog.slice(-8), lastSeen: Date.now(), stats: state.stats,
  }));
}

function loadState() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { saved = null; }
  state.stats = saved ? { ...defaultStats(), ...(saved.stats || {}) } : defaultStats();
  if (!saved) { state.upgradeLevel = 0; return; }

  state.raised = Math.max(0, saved.raised || 0);
  state.upgradeLevel = upgradesUnlocked(state.raised); // always consistent with money
  state.stats.upgrades = state.upgradeLevel;
  state.bornAt = saved.bornAt || Date.now();
  state.hoursAwake = saved.hoursAwake || 0;
  if (Array.isArray(saved.changelog) && saved.changelog.length) state.changelog = saved.changelog;
  state.sugarRushUntil = performance.now() + (saved.sugarRemaining || 0);

  const offlineSec = Math.max(0, (Date.now() - (saved.lastSeen || Date.now())) / 1000);
  const rate = saved.sugarRemaining > 0 ? DRAIN_PER_SEC * 0.5 : DRAIN_PER_SEC;
  state.energy = Math.max(0, (saved.energy ?? ENERGY_MAX) - rate * offlineSec);
  if (state.energy <= 0) { state.burnout = true; state.activity = 'burnout'; }
}

// ---------- lifecycle ----------
function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  spriteW = D.DEV_CODE[0].length;
  spriteH = D.DEV_CODE.length;
  spriteX = Math.round((WORLD_W - spriteW) / 2);
  spriteY = WORLD_H - spriteH - 6;

  loadState();
  UI.renderStats(state.stats);
  UI.setUpgrade(upgradeProgress());
  UI.renderDashboard(dashboard());

  lastTime = performance.now();
  lastLogicAt = lastTime;
  requestAnimationFrame(loop);
  setInterval(heartbeat, 1000);
  setInterval(saveState, 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });
  window.addEventListener('beforeunload', saveState);

  setActivity('coding', 4);
  render();
}

// Progress within the current upgrade tier (previous threshold -> next threshold).
function upgradeProgress() {
  const next = UPGRADES[state.upgradeLevel];
  if (!next) return { raised: state.raised, pct: 100, label: 'FULLY UPGRADED', done: true };
  const prev = state.upgradeLevel > 0 ? UPGRADES[state.upgradeLevel - 1].threshold : 0;
  const pct = Math.max(0, Math.min(100, ((state.raised - prev) / (next.threshold - prev)) * 100));
  return { raised: state.raised, target: next.threshold, pct, label: next.label, done: false };
}

function dashboard() {
  return {
    feature: FEATURES[state.featureIdx % FEATURES.length],
    buildPct: Math.floor(state.buildPct),
    bugs: state.bugs,
    hoursAwake: Math.floor(state.hoursAwake),
    broken: state.bugs >= 3 || state.burnout,
    changelog: state.changelog[state.changelog.length - 1],
  };
}

function setActivity(name, seconds) {
  state.activity = name;
  state.activityUntil = performance.now() + seconds * 1000;
}

function pickNextActivity() {
  if (state.burnout) { setActivity('burnout', 3); return; }
  if (state.energy < SLEEPY_THRESHOLD) {
    setActivity(Math.random() < 0.5 ? 'sleep' : 'stress', 4 + Math.random() * 4);
    return;
  }
  const roll = Math.random();
  if (roll < 0.72) setActivity('coding', 3 + Math.random() * 4);
  else setActivity('stress', 2 + Math.random() * 2);
}

// ---------- update ----------
function drainEnergy(elapsedSec) {
  if (state.burnout) return;
  let drain = state.activity === 'sleep' ? SLEEP_DRAIN_PER_SEC : DRAIN_PER_SEC;
  if (performance.now() < state.sugarRushUntil) drain *= 0.5;
  state.energy = Math.max(0, state.energy - drain * elapsedSec);
  if (state.energy <= 0) enterBurnout();
}

function enterBurnout() {
  if (state.burnout) return;
  state.burnout = true;
  state.activity = 'burnout';
  state.stats.burnouts += 1;
  saveState();
  say(BURNOUT_PHRASES[0], 4000);
  UI.renderStats(state.stats);
}

function update(dt) {
  if (performance.now() > state.activityUntil) pickNextActivity();

  state.confetti = state.confetti.filter(p => p.y < WORLD_H);
  for (const p of state.confetti) { p.y += p.vy * dt; p.x += p.vx * dt; }

  // Dashboard flavor: he makes coding progress while actually coding.
  if (state.activity === 'coding' && !state.burnout) {
    state.buildPct += 6 * dt;
    state.hoursAwake += dt * 0.4;
    if (Math.random() < 0.02 * dt * 60) state.bugs = Math.min(5, state.bugs + 1);
    if (state.buildPct >= 100) {
      state.buildPct = 0;
      state.featureIdx += 1;
      const v = (state.changelog.length + 1);
      state.changelog.push(`v0.${v} — ${FEATURES[(state.featureIdx - 1) % FEATURES.length]} done`);
      if (state.changelog.length > 8) state.changelog.shift();
      state.bugs = Math.max(0, state.bugs - 1);
    }
    dashTimer += dt;
    if (dashTimer > 1) { dashTimer = 0; UI.renderDashboard(dashboard()); }
  }
  if (state.activity === 'sleep') { state.hoursAwake = 0; state.bugs = Math.max(0, state.bugs - 0.5 * dt); }

  phraseTimer -= dt;
  if (phraseTimer <= 0) {
    let pool = CODING_PHRASES;
    if (state.burnout) pool = BURNOUT_PHRASES;
    else if (state.energy < SLEEPY_THRESHOLD) pool = LOW_PHRASES;
    if (state.activity !== 'sleep' || state.burnout) {
      say(pool[Math.floor(Math.random() * pool.length)], 3500);
    }
    phraseTimer = state.burnout ? 5 : 7 + Math.random() * 6;
  }

  animTimer += dt;
  if (animTimer > 0.25) { animTimer = 0; state.frame = (state.frame + 1) % 2; }
  blinkTimer += dt;
  for (const s of state.stars) { s.tw = (Math.sin(performance.now() / 500 + s.x) + 1) / 2; }
}

function currentSprite() {
  switch (state.activity) {
    case 'drink':   return D.DEV_DRINK;
    case 'stress':  return D.DEV_STRESS;
    case 'sleep':   return D.DEV_SLEEP;
    case 'burnout': return D.DEV_BURN;
    case 'ship':    return D.DEV_SHIP;
    default:        return D.DEV_CODE;
  }
}

// ---------- render ----------
function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

function drawUpgrades(lvl) {
  // lvl>=1 desk lamp with warm glow (right of dev)
  if (lvl >= 1) {
    px(120, 62, 2, 16, '#6f7784');        // lamp pole
    px(116, 58, 10, 4, '#3b2f52');        // shade
    px(118, 62, 6, 2, '#ffe28a');         // bulb
    ctx.fillStyle = 'rgba(255,214,120,0.14)';
    ctx.fillRect(104, 60, 34, 30);        // warm glow pool
  }
  // lvl>=2 potted plant (left, on floor)
  if (lvl >= 2) {
    px(26, 84, 8, 8, '#b07a44');          // pot
    px(28, 90, 4, 2, '#835831');
    px(28, 78, 4, 6, '#6fbf5e');          // stem/leaves
    px(25, 80, 4, 4, '#8fd97a'); px(31, 80, 4, 4, '#8fd97a');
    px(28, 74, 4, 4, '#8fd97a');
  }
  // lvl>=3 new monitor (left of dev on desk) with bright screen
  if (lvl >= 3) {
    px(40, 70, 18, 14, '#2b2331');        // bezel
    px(42, 72, 14, 10, '#1d3a5a');        // screen
    px(43, 74, 10, 1, '#74f0a6'); px(43, 76, 7, 1, '#74f0a6'); px(43, 78, 9, 1, '#74f0a6');
    px(47, 84, 4, 4, '#3b2f52');          // stand
  }
  // lvl>=4 second monitor (right of dev)
  if (lvl >= 4) {
    px(102, 70, 18, 14, '#2b2331');
    px(104, 72, 14, 10, '#3a1d5a');
    px(105, 74, 9, 1, '#c98ff2'); px(105, 76, 11, 1, '#c98ff2'); px(105, 78, 7, 1, '#c98ff2');
    px(109, 84, 4, 4, '#3b2f52');
  }
  // lvl>=5 a coding cat curled on the floor (right)
  if (lvl >= 5) {
    px(132, 88, 12, 4, '#f2b378');        // body
    px(142, 86, 4, 4, '#f2b378');         // head
    px(142, 85, 1, 2, '#f2b378'); px(145, 85, 1, 2, '#f2b378'); // ears
    px(131, 87, 2, 2, '#f2b378');         // tail
    px(143, 87, 1, 1, '#3b2d3f'); px(145, 87, 1, 1, '#3b2d3f'); // eyes
  }
  // lvl>=6 studio RGB strips along the ceiling
  if (lvl >= 6) {
    const cols = ['#ff5c6a', '#ffd94a', '#8fd97a', '#7fc8f0', '#c98ff2'];
    for (let x = 0; x < WORLD_W; x += 8) px(x, 0, 6, 2, cols[(x / 8) % cols.length]);
    ctx.fillStyle = 'rgba(140,120,255,0.06)';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
}

function render() {
  const bands = ['#1c1830', '#241d3a', '#2b2342', '#33294c'];
  for (let i = 0; i < bands.length; i++) px(0, i * 18, WORLD_W, 18, bands[i]);
  // window + moon + stars
  px(112, 8, 40, 30, '#12203a');
  px(138, 12, 8, 8, '#e9e6c8'); px(140, 11, 4, 10, '#e9e6c8'); px(140, 12, 4, 6, '#0d1830');
  for (const s of state.stars) { ctx.fillStyle = (s.tw ?? 1) > 0.5 ? '#fffbe6' : '#8a86b0'; ctx.fillRect(112 + (s.x % 40), 8 + (s.y % 28), 1, 1); }
  px(112, 8, 40, 2, '#3b2f52'); px(112, 36, 40, 2, '#3b2f52');
  px(112, 8, 2, 30, '#3b2f52'); px(150, 8, 2, 30, '#3b2f52'); px(131, 8, 1, 30, '#3b2f52');
  // string lights
  for (let x = 4; x < WORLD_W; x += 14) px(x, 3, 2, 2, ['#ff9fb8', '#8fd97a', '#7fc8f0', '#ffd94a'][((x / 14) | 0) % 4]);
  // floor
  px(0, WORLD_H - 8, WORLD_W, 8, '#191324');
  // cans of the grind (fewer once the studio glows up)
  const cans = state.upgradeLevel >= 6 ? [] : [[6, 88], [10, 88], [8, 84], [14, 88]];
  for (const [cx, cy] of cans) { px(cx, cy, 3, 4, '#e2482f'); px(cx, cy, 3, 1, '#ffd94a'); }

  drawUpgrades(state.upgradeLevel);
  D.drawSprite(ctx, currentSprite(), spriteX, spriteY);

  if (state.activity === 'sleep') {
    ctx.fillStyle = '#9fb0c4';
    const t = Math.floor(performance.now() / 500) % 3;
    ctx.font = '6px monospace';
    ctx.fillText('z', spriteX + spriteW - 2 + t, spriteY + 2 - t * 2);
  }
  if (state.burnout) { ctx.fillStyle = 'rgba(10,8,16,0.55)'; ctx.fillRect(0, 0, WORLD_W, WORLD_H); }

  for (const p of state.confetti) { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }

  UI.setEnergy(state.energy);
}

function loop(t) {
  const rawDt = (t - lastTime) / 1000;
  const dt = Math.min(rawDt, 0.1);
  lastTime = t;
  lastLogicAt = performance.now();
  drainEnergy(rawDt);
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function heartbeat() {
  const now = performance.now();
  const elapsed = (now - lastLogicAt) / 1000;
  if (elapsed > 1.5) { lastLogicAt = now; drainEnergy(elapsed); UI.setEnergy(state.energy); }
}

// ---------- donations ----------
function say(text, ms) { UI.showBubble(text, spriteX / WORLD_W, ms); }

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

function onDonation(amountSol, donor) {
  const tier = TIERS.find(t => amountSol >= t.minSol) || TIERS[TIERS.length - 1];

  state.energy = Math.min(ENERGY_MAX, state.energy + tier.energy);
  if (state.burnout && state.energy > 0) { state.burnout = false; say('IM BACK. thank you.', 4000); }

  state.raised += amountSol;
  state.stats.totalSol = state.raised;
  state.stats.donations += 1;

  const shortDonor = donor.length > 12 ? donor.slice(0, 4) + '..' + donor.slice(-4) : donor;
  const msg = tier.thanks[Math.floor(Math.random() * tier.thanks.length)].replace('{donor}', shortDonor);

  UI.showAlert(tier, amountSol, shortDonor);
  say(msg, 6000);
  UI.playChime(tier.id);
  UI.setUpgrade(upgradeProgress());
  UI.renderStats(state.stats);

  if (tier.id === 'sponsor') { state.sugarRushUntil = performance.now() + 10 * 60 * 1000; throwConfetti(70); }
  else if (tier.id === 'rent') throwConfetti(50);
  else setActivity('drink', 3);

  checkUpgrades();
  saveState();
}

// Crossing an upgrade threshold visibly levels up the room, live.
function checkUpgrades() {
  const nowLevel = upgradesUnlocked(state.raised);
  while (state.upgradeLevel < nowLevel) {
    const up = UPGRADES[state.upgradeLevel];
    state.upgradeLevel += 1;
    state.stats.upgrades = state.upgradeLevel;
    setActivity('ship', 6);
    throwConfetti(90);
    state.changelog.push(`upgrade — ${up.label.toLowerCase()}`);
    if (state.changelog.length > 8) state.changelog.shift();
    UI.showUpgrade(up.label, up.blurb, state.raised);
  }
  UI.setUpgrade(upgradeProgress());
  UI.renderStats(state.stats);
  UI.renderDashboard(dashboard());
}

function dismissUpgrade() { UI.hideUpgrade(); setActivity('coding', 3); }

window.Game = { init, onDonation, dismissUpgrade, TIERS, UPGRADES, state };
