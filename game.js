// Broke Dev: a pixel developer who survives on SOL tips. Two meters, both fed by
// donations but distinct: STAMINA (volatile, drains over time, burnout at zero)
// and the SHIP GOAL (cumulative SOL raised toward a target, never resets).
const D = window.DevSprites;

const WORLD_W = 160;
const WORLD_H = 100;

const ENERGY_MAX = 100;
const DRAIN_PER_SEC = 0.14;       // ~12 min from full to burnout
const SLEEP_DRAIN_PER_SEC = 0.05;
const SLEEPY_THRESHOLD = 30;

// Funded roadmap. raised is cumulative; each goal target is an absolute SOL total.
// Edit these: set your real SOL targets and what actually ships at each one.
const GOALS = [
  { target: 1.0, label: 'SHIP GAME #1', reward: 'a finished game + site + domain + pump.fun token' },
  { target: 3.0, label: 'SHIP GAME #2', reward: 'the next build, funded live by chat' },
  { target: 8.0, label: 'GO FULL-TIME', reward: 'quit the day job, build for real' },
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
  'refactoring... again', 'npm install and pray', 'ship it friday',
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

const state = {
  energy: ENERGY_MAX,
  activity: 'coding',   // coding | drink | stress | sleep | burnout | ship
  activityUntil: 0,
  frame: 0,
  goalIndex: 0,
  raised: 0,            // cumulative SOL, monotonic, never decreases
  sugarRushUntil: 0,    // sponsor buff: half drain
  confetti: [],
  stars: [{ x: 14, y: 12 }, { x: 30, y: 9 }, { x: 22, y: 20 }, { x: 38, y: 16 }],
  bornAt: Date.now(),
  burnout: false,
  stats: null,
};

const defaultStats = () => ({ totalSol: 0, donations: 0, shipped: 0, burnouts: 0 });

let canvas, ctx, lastTime = 0, lastLogicAt = 0, animTimer = 0, blinkTimer = 0, phraseTimer = 6;
let spriteW = 26, spriteH = 22, spriteX = 67, spriteY = 60;

// ---------- persistence ----------
const SAVE_KEY = 'brokedev_save_v1';

function saveState() {
  const sugarRemaining = Math.max(0, state.sugarRushUntil - performance.now());
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    energy: state.energy, raised: state.raised, goalIndex: state.goalIndex,
    sugarRemaining, bornAt: state.bornAt, burnout: state.burnout,
    lastSeen: Date.now(), stats: state.stats,
  }));
}

function loadState() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { saved = null; }
  state.stats = saved ? { ...defaultStats(), ...(saved.stats || {}) } : defaultStats();
  if (!saved) return;

  // Goal progress is money; it can only be restored upward, never reset.
  state.raised = Math.max(0, saved.raised || 0);
  state.goalIndex = saved.goalIndex || 0;
  state.bornAt = saved.bornAt || Date.now();
  state.sugarRushUntil = performance.now() + (saved.sugarRemaining || 0);

  // Stamina keeps draining while the tab is closed.
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
  UI.setGoal(state.raised, currentGoal().target, currentGoal().label);

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

function currentGoal() {
  return GOALS[Math.min(state.goalIndex, GOALS.length - 1)];
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
  if (roll < 0.7) setActivity('coding', 3 + Math.random() * 4);
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
function render() {
  // Cozy dark room, coder-at-night mood.
  const bands = ['#1c1830', '#241d3a', '#2b2342', '#33294c'];
  for (let i = 0; i < bands.length; i++) {
    ctx.fillStyle = bands[i];
    ctx.fillRect(0, i * 18, WORLD_W, 18);
  }
  // Window with moon + stars (upper right)
  ctx.fillStyle = '#12203a';
  ctx.fillRect(112, 8, 40, 30);
  ctx.fillStyle = '#e9e6c8';
  ctx.fillRect(138, 12, 8, 8); ctx.fillRect(140, 11, 4, 10); // moon
  ctx.fillStyle = '#0d1830';
  ctx.fillRect(140, 12, 4, 6); // moon crescent shade
  for (const s of state.stars) {
    ctx.fillStyle = (s.tw ?? 1) > 0.5 ? '#fffbe6' : '#8a86b0';
    ctx.fillRect(112 + (s.x % 40), 8 + (s.y % 28), 1, 1);
  }
  // window frame
  ctx.fillStyle = '#3b2f52';
  ctx.fillRect(112, 8, 40, 2); ctx.fillRect(112, 36, 40, 2);
  ctx.fillRect(112, 8, 2, 30); ctx.fillRect(150, 8, 2, 30); ctx.fillRect(131, 8, 1, 30);
  // string lights along the top
  for (let x = 4; x < WORLD_W; x += 14) {
    ctx.fillStyle = ['#ff9fb8', '#8fd97a', '#7fc8f0', '#ffd94a'][(x / 14) % 4 | 0];
    ctx.fillRect(x, 3, 2, 2);
  }
  // floor
  ctx.fillStyle = '#191324';
  ctx.fillRect(0, WORLD_H - 8, WORLD_W, 8);
  // pile of empty cans in the corner (evidence of the grind)
  const cans = [[6, WORLD_H - 12], [10, WORLD_H - 12], [8, WORLD_H - 16], [14, WORLD_H - 12]];
  for (const [cx, cy] of cans) {
    ctx.fillStyle = '#e2482f'; ctx.fillRect(cx, cy, 3, 4);
    ctx.fillStyle = '#ffd94a'; ctx.fillRect(cx, cy, 3, 1);
  }

  // the dev
  D.drawSprite(ctx, currentSprite(), spriteX, spriteY);

  // sleep zzz
  if (state.activity === 'sleep') {
    ctx.fillStyle = '#9fb0c4';
    const t = Math.floor(performance.now() / 500) % 3;
    ctx.font = '6px monospace';
    ctx.fillText('z', spriteX + spriteW - 2 + t, spriteY + 2 - t * 2);
  }

  // burnout dims the whole room
  if (state.burnout) {
    ctx.fillStyle = 'rgba(10,8,16,0.55)';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  for (const p of state.confetti) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
  }

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

// Keeps stamina draining when the tab is hidden and rAF is frozen.
function heartbeat() {
  const now = performance.now();
  const elapsed = (now - lastLogicAt) / 1000;
  if (elapsed > 1.5) {
    lastLogicAt = now;
    drainEnergy(elapsed);
    UI.setEnergy(state.energy);
  }
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

  // Survival meter (volatile) + revive from burnout.
  state.energy = Math.min(ENERGY_MAX, state.energy + tier.energy);
  if (state.burnout && state.energy > 0) {
    state.burnout = false;
    say('IM BACK. thank you.', 4000);
  }

  // Ship goal (permanent, money). Cumulative, never decreases.
  state.raised += amountSol;
  state.stats.totalSol = state.raised;
  state.stats.donations += 1;

  const shortDonor = donor.length > 12 ? donor.slice(0, 4) + '..' + donor.slice(-4) : donor;
  const msg = tier.thanks[Math.floor(Math.random() * tier.thanks.length)].replace('{donor}', shortDonor);

  UI.showAlert(tier, amountSol, shortDonor);
  say(msg, 6000);
  UI.playChime(tier.id);
  UI.setGoal(state.raised, currentGoal().target, currentGoal().label);
  UI.renderStats(state.stats);

  if (tier.id === 'sponsor') {
    state.sugarRushUntil = performance.now() + 10 * 60 * 1000;
    throwConfetti(70);
  } else if (tier.id === 'rent') {
    throwConfetti(50);
  } else {
    setActivity('drink', 3); // coffee / red bull / pizza: he consumes it
  }

  checkMilestone();
  saveState();
}

// Crossing the current goal target ships something real.
function checkMilestone() {
  const goal = currentGoal();
  if (state.raised >= goal.target && state.goalIndex < GOALS.length) {
    state.stats.shipped += 1;
    state.goalIndex += 1;
    setActivity('ship', 8);
    throwConfetti(120);
    UI.showShip(goal.label, goal.reward, state.raised);
    UI.setGoal(state.raised, currentGoal().target, currentGoal().label);
    UI.renderStats(state.stats);
  }
}

function dismissShip() { UI.hideShip(); setActivity('coding', 3); }

window.Game = { init, onDonation, dismissShip, TIERS, GOALS, state };
