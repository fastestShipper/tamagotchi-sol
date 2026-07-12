// DOM layer: stamina bar, upgrade bar, dev dashboard, speech bubbles, tip alerts,
// upgrade-unlock overlay, chimes, tier list, portfolio, demo buttons.
const UI = {};

const bubbleEl = document.getElementById('bubble');
const alertEl = document.getElementById('alert');
let bubbleTimeout, alertTimeout;
let audioCtx;

UI.setEnergy = function (value) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = document.getElementById('energy-fill');
  fill.style.width = pct + '%';
  fill.style.background = pct > 50 ? '#8fd97a' : pct > 25 ? '#ffd94a' : '#e2607e';
  document.getElementById('energy-num').textContent = Math.ceil(pct);
};

// NEXT UPGRADE bar: SOL raised toward the next visible room/dev upgrade.
UI.setUpgrade = function (p) {
  document.getElementById('upgrade-fill').style.width = p.pct + '%';
  document.getElementById('upgrade-label').textContent = p.done ? 'FULLY UPGRADED' : 'NEXT: ' + p.label;
  document.getElementById('upgrade-num').textContent = p.done
    ? `${p.raised.toFixed(3)} SOL raised`
    : `${p.raised.toFixed(3)} / ${p.target} SOL`;
};

// Dev dashboard: proof he actually works (feature, build %, bugs, changelog).
UI.renderDashboard = function (d) {
  const bars = Math.round(d.buildPct / 10);
  const bar = '█'.repeat(bars) + '░'.repeat(10 - bars);
  document.getElementById('dash-feature').textContent = d.feature;
  document.getElementById('dash-bar').textContent = bar + ' ' + d.buildPct + '%';
  const status = document.getElementById('dash-status');
  status.textContent = d.broken ? 'BROKEN' : 'STABLE';
  status.style.color = d.broken ? '#e2607e' : '#8fd97a';
  document.getElementById('dash-meta').textContent =
    `bugs: ${d.bugs} · awake: ${d.hoursAwake}h`;
  document.getElementById('dash-log').textContent = '> ' + d.changelog;
};

UI.showBubble = function (text, xRatio, ms) {
  bubbleEl.textContent = text;
  bubbleEl.classList.remove('hidden');
  bubbleEl.style.left = Math.max(5, Math.min(60, xRatio * 100 - 10)) + '%';
  clearTimeout(bubbleTimeout);
  bubbleTimeout = setTimeout(() => bubbleEl.classList.add('hidden'), ms);
};

UI.showAlert = function (tier, amountSol, donor) {
  document.getElementById('alert-icon').src =
    DevSprites.spriteToDataURL(DevSprites[tier.sprite], 5);
  document.getElementById('alert-title').textContent =
    `${donor} sent ${amountSol.toFixed(3)} SOL`;
  document.getElementById('alert-sub').textContent = `→ ${tier.label}`;
  alertEl.classList.remove('hidden');
  alertEl.classList.remove('pop');
  void alertEl.offsetWidth;
  alertEl.classList.add('pop');
  clearTimeout(alertTimeout);
  alertTimeout = setTimeout(() => alertEl.classList.add('hidden'), 6000);
};

function setLines(el, lines) {
  el.replaceChildren();
  lines.forEach((text, i) => {
    if (i > 0) el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(text));
  });
}

// A funded upgrade lands live. Reuses the overlay element.
UI.showUpgrade = function (label, blurb, raised) {
  document.getElementById('death-title').textContent = 'UPGRADED';
  setLines(document.getElementById('death-sub'), [label, `"${blurb}"`]);
  setLines(document.getElementById('death-stats'), [`funded live at ${raised.toFixed(3)} SOL raised`]);
  document.getElementById('restart-btn').textContent = 'BACK TO WORK →';
  document.getElementById('death').classList.remove('hidden');
};

UI.hideUpgrade = function () {
  document.getElementById('death').classList.add('hidden');
};

UI.renderStats = function (stats) {
  if (!stats) return;
  const el = document.getElementById('stats');
  el.replaceChildren();
  const label = document.createElement('span');
  label.textContent = 'lifetime';
  el.append(label, document.createTextNode(
    ` ${stats.totalSol.toFixed(3)} SOL raised · ${stats.donations} tips · ` +
    `${stats.upgrades} upgrades · ${stats.burnouts} burnouts`));
};

UI.setNetStatus = function (status) {
  const el = document.getElementById('net-status');
  const map = {
    off: ['NET: OFF', '#9aa3b2'], connecting: ['NET: ...', '#ffd94a'],
    watching: ['NET: LIVE', '#8fd97a'], error: ['NET: ERROR', '#e2607e'],
  };
  const [text, color] = map[status] || map.off;
  el.textContent = text; el.style.color = color;
};

UI.playChime = function (tierId) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { tip: 1, coffee: 2, redbull: 3, pizza: 4, rent: 6, sponsor: 8 }[tierId] || 2;
    const base = [523, 659, 784, 1047, 1319, 1568, 2093, 2637];
    for (let i = 0; i < notes; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = base[i % base.length];
      const t = audioCtx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t); osc.stop(t + 0.16);
    }
  } catch (_) { /* audio blocked until user interacts */ }
};

function buildTierList() {
  const wrap = document.getElementById('tiers');
  for (const t of Game.TIERS) {
    if (t.id === 'tip') continue;
    const div = document.createElement('div');
    div.className = 'tier';
    const img = document.createElement('img');
    img.src = DevSprites.spriteToDataURL(DevSprites[t.sprite], 3);
    const span = document.createElement('span');
    span.textContent = `${t.minSol} · ${t.label}`;
    div.append(img, span);
    wrap.appendChild(div);
  }
}

// Portfolio: real demos/projects the dev has already built (proof of work, not
// promises). Fill PROJECTS with your actual links + blurbs.
const PROJECTS = [
  { title: 'Demo 001', url: '#', blurb: 'replace with a real project you shipped' },
  { title: 'Demo 002', url: '#', blurb: 'a live demo people can click' },
  { title: 'Demo 003', url: '#', blurb: 'another thing you actually built' },
];

function buildPortfolio() {
  const wrap = document.getElementById('portfolio-list');
  for (const p of PROJECTS) {
    const a = document.createElement('a');
    a.className = 'proj';
    a.href = p.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    const t = document.createElement('div');
    t.className = 'proj-title';
    t.textContent = p.title;
    const b = document.createElement('div');
    b.className = 'proj-blurb';
    b.textContent = p.blurb;
    a.append(t, b);
    wrap.appendChild(a);
  }
}

function buildDemoButtons() {
  const wrap = document.getElementById('demo-btns');
  for (const t of Game.TIERS) {
    const btn = document.createElement('button');
    btn.textContent = `${t.label} (${t.minSol})`;
    btn.addEventListener('click', () =>
      Game.onDonation(t.minSol || 0.005, 'DemoFan' + Math.floor(Math.random() * 99)));
    wrap.appendChild(btn);
  }
}

function initUI() {
  buildTierList();
  buildPortfolio();
  buildDemoButtons();

  const addr = Solana.CONFIG.WALLET_ADDRESS;
  if (addr) {
    document.getElementById('wallet-addr').textContent = addr.slice(0, 6) + '...' + addr.slice(-6);
  }
  document.getElementById('copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(addr || '');
    document.getElementById('copy-btn').textContent = 'COPIED!';
    setTimeout(() => document.getElementById('copy-btn').textContent = 'COPY', 1500);
  });
  document.getElementById('restart-btn').addEventListener('click', Game.dismissUpgrade);

  Game.init();
  Solana.startWatcher();
}

window.UI = UI;
initUI();
