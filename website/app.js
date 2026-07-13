import { BrokeDevWorld } from './experience.js';

document.documentElement.classList.add('js');

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ui = {
  boot: $('#boot-screen'),
  bootStatus: $('#boot-status'),
  worldStatus: $('#world-status-text'),
  intro: $('#intro-card'),
  panel: $('#panel-shell'),
  panelRoute: $('#panel-route'),
  tooltip: $('#world-tooltip'),
  tooltipKicker: $('#tooltip-kicker'),
  tooltipTitle: $('#tooltip-title'),
  toast: $('#world-toast'),
  missionTitle: $('#mission-title'),
  missionCopy: $('#mission-copy'),
  shardCount: $('#shard-count'),
  fps: $('#fps-counter'),
  position: $('#position-readout'),
  arcadeHud: $('#arcade-hud'),
  arcadeScore: $('#arcade-score'),
  arcadeStatus: $('#arcade-status'),
  sound: $('#sound-toggle'),
};

const NODE_LABELS = {
  project: ['PROJECT NODE', 'PROJECT_001'],
  arcade: ['LIVE SIMULATION', 'PACKET CHASE'],
  tools: ['UTILITY NODE', 'FREE TOOLS'],
  support: ['PUBLIC NODE', 'SUPPORT'],
};

const state = {
  entered: false,
  worldReady: false,
  panel: null,
  arcade: false,
  sound: false,
  toastTimer: 0,
  previousFocus: null,
};

const modalBackground = $$('.hud-top, .mission-hud, .telemetry-hud, .action-dock, .mobile-controls');

function setBackgroundInert(inert) {
  modalBackground.forEach((element) => {
    element.inert = inert;
    if (inert) element.setAttribute('aria-hidden', 'true');
    else element.removeAttribute('aria-hidden');
  });
}

class InterfaceAudio {
  constructor() {
    this.context = null;
    this.master = null;
  }

  async enable() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.13;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    return true;
  }

  blip(frequency = 520, duration = 0.06, type = 'square', volume = 0.2) {
    if (!state.sound || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(70, frequency * 0.72), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
  }

  collect() {
    this.blip(760, 0.08, 'square', 0.18);
    window.setTimeout(() => this.blip(1040, 0.09, 'square', 0.13), 55);
  }
}

const audio = new InterfaceAudio();
let world = null;

function setWorldStatus(text, mode = 'ready') {
  ui.worldStatus.textContent = text;
  document.documentElement.dataset.world = mode;
}

function showToast(message, duration = 1900) {
  window.clearTimeout(state.toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add('is-visible');
  state.toastTimer = window.setTimeout(() => ui.toast.classList.remove('is-visible'), duration);
}

function completeBoot(fallback = false) {
  ui.bootStatus.textContent = fallback ? 'DOM FALLBACK ONLINE' : 'WORLD READY';
  window.setTimeout(() => ui.boot.classList.add('is-complete'), 320);
}

function enterWorld() {
  if (state.entered) return;
  state.entered = true;
  document.documentElement.classList.add('is-playing');
  world?.setActive(true);
  ui.missionTitle.textContent = state.worldReady ? 'RECOVER DATA SHARDS' : 'INSPECT PUBLIC NODES';
  ui.missionCopy.textContent = state.worldReady
    ? 'Move through the studio. Find all six.'
    : 'Use the dock to inspect the public build.';
  audio.blip(420, 0.12, 'sawtooth', 0.16);
  window.setTimeout(() => showToast(state.worldReady ? 'WASD to move. Drag to orbit. E to interact.' : 'WebGL fallback active. Interface remains online.'), 350);
}

function leaveArcade() {
  if (!state.arcade) return;
  state.arcade = false;
  ui.arcadeHud.hidden = true;
  document.documentElement.classList.remove('arcade-active');
  world?.stopArcade();
  ui.missionTitle.textContent = 'RECOVER DATA SHARDS';
  ui.missionCopy.textContent = 'Move through the studio. Find all six.';
  audio.blip(280, 0.08, 'square', 0.12);
}

function startArcade() {
  enterWorld();
  closePanel(false);
  state.arcade = true;
  ui.arcadeHud.hidden = false;
  document.documentElement.classList.add('arcade-active');
  world?.startArcade();
  ui.missionTitle.textContent = 'OUTRUN THE COURIER';
  ui.missionCopy.textContent = 'Collect packets. Do not hit the firewall.';
  audio.blip(620, 0.1, 'square', 0.18);
}

function openPanel(panelName) {
  const view = $(`[data-panel-view="${panelName}"]`);
  if (!view) return;
  if (state.arcade) leaveArcade();
  enterWorld();
  state.previousFocus = document.activeElement;
  state.panel = panelName;
  $$('.panel-view', ui.panel).forEach((panelView) => {
    panelView.hidden = panelView !== view;
  });
  ui.panelRoute.textContent = `/public/${panelName}`;
  ui.panel.hidden = false;
  document.documentElement.classList.add('panel-open');
  setBackgroundInert(true);
  world?.setPanelOpen(true);
  window.setTimeout(() => $('[data-close-panel]', ui.panel)?.focus(), 30);
  audio.blip(520, 0.055, 'square', 0.12);
}

function closePanel(restoreFocus = true) {
  if (!state.panel && ui.panel.hidden) return;
  ui.panel.hidden = true;
  document.documentElement.classList.remove('panel-open');
  setBackgroundInert(false);
  world?.setPanelOpen(false);
  state.panel = null;
  if (restoreFocus && state.previousFocus instanceof HTMLElement) state.previousFocus.focus();
  state.previousFocus = null;
  audio.blip(310, 0.05, 'square', 0.1);
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const fallback = document.createElement('textarea');
  fallback.value = text;
  fallback.style.position = 'fixed';
  fallback.style.opacity = '0';
  document.body.appendChild(fallback);
  fallback.select();
  document.execCommand('copy');
  fallback.remove();
  return Promise.resolve();
}

function positiveNumber(id) {
  const value = Number($(id)?.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function calculatePixelScale() {
  const baseWidth = positiveNumber('#base-width');
  const baseHeight = positiveNumber('#base-height');
  const targetWidth = positiveNumber('#target-width');
  const targetHeight = positiveNumber('#target-height');
  const output = ui.panel.querySelector('#pixel-output');
  if (!output) return;

  if (!baseWidth || !baseHeight || !targetWidth || !targetHeight) {
    output.innerHTML = '<span>SCALE <b>INVALID</b></span><span>OUTPUT <b>CHECK INPUT</b></span><span>LETTERBOX <b>CHECK INPUT</b></span>';
    return;
  }

  const scale = Math.floor(Math.min(targetWidth / baseWidth, targetHeight / baseHeight));
  if (scale < 1) {
    output.innerHTML = `<span>SCALE <b>NO FIT</b></span><span>OUTPUT <b>${baseWidth} × ${baseHeight}</b></span><span>LETTERBOX <b>TARGET TOO SMALL</b></span>`;
    return;
  }

  const width = baseWidth * scale;
  const height = baseHeight * scale;
  output.innerHTML = `<span>SCALE <b>${scale}×</b></span><span>OUTPUT <b>${width} × ${height}</b></span><span>LETTERBOX <b>${targetWidth - width} × ${targetHeight - height}</b></span>`;
}

function initializeClock() {
  const clock = $('#studio-clock');
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const update = () => {
    clock.textContent = `LIMA ${formatter.format(new Date())}`;
  };
  update();
  window.setInterval(update, 1000);
}

function initializeWorld() {
  ui.bootStatus.textContent = 'COMPILING WEBGL WORLD';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    world = new BrokeDevWorld({
      root: $('#webgl-root'),
      reducedMotion,
      callbacks: {
        onReady() {
          state.worldReady = true;
          setWorldStatus('WORLD: ONLINE');
          completeBoot(false);
        },
        onFallback(error) {
          document.documentElement.classList.add('no-webgl');
          setWorldStatus('WORLD: DOM MODE', 'fallback');
          completeBoot(true);
          console.warn('WebGL world unavailable.', error);
        },
        onHover(nodeId, pointer) {
          if (!nodeId || state.panel || state.arcade) {
            ui.tooltip.classList.remove('is-visible');
            ui.tooltip.setAttribute('aria-hidden', 'true');
            return;
          }
          const label = NODE_LABELS[nodeId];
          if (!label) return;
          ui.tooltipKicker.textContent = label[0];
          ui.tooltipTitle.textContent = label[1];
          ui.tooltip.style.left = `${pointer.x}px`;
          ui.tooltip.style.top = `${pointer.y}px`;
          ui.tooltip.classList.add('is-visible');
          ui.tooltip.setAttribute('aria-hidden', 'false');
        },
        onInteract(nodeId) {
          ui.tooltip.classList.remove('is-visible');
          if (nodeId === 'arcade') {
            state.arcade = true;
            ui.arcadeHud.hidden = false;
            document.documentElement.classList.add('arcade-active');
            ui.missionTitle.textContent = 'OUTRUN THE COURIER';
            ui.missionCopy.textContent = 'Collect packets. Do not hit the firewall.';
          } else {
            openPanel(nodeId);
          }
        },
        onCollect({ count, total }) {
          ui.shardCount.textContent = String(count);
          audio.collect();
          if (count === total) {
            ui.missionTitle.textContent = 'STUDIO SYNCED';
            ui.missionCopy.textContent = 'All public data shards recovered.';
            showToast('6/6 DATA SHARDS // WORLD SYNC COMPLETE', 2800);
          } else {
            showToast(`DATA SHARD ${count}/${total} RECOVERED`);
          }
        },
        onTelemetry({ fps, x, z }) {
          ui.fps.textContent = String(fps).padStart(2, '0');
          ui.position.textContent = `${x.toFixed(1).padStart(4, '0')} / ${z.toFixed(1).padStart(4, '0')}`;
        },
        onArcadeState({ score, status, mode }) {
          ui.arcadeScore.textContent = String(score).padStart(3, '0');
          ui.arcadeStatus.textContent = status;
          if (mode === 'gameover') audio.blip(130, 0.18, 'sawtooth', 0.18);
          else if (status === 'PACKET SECURED') audio.collect();
        },
        onHint(message) {
          showToast(message);
        },
      },
    });
  } catch (error) {
    document.documentElement.classList.add('no-webgl');
    setWorldStatus('WORLD: DOM MODE', 'fallback');
    completeBoot(true);
  }
}

function movementForKey(key) {
  return {
    w: 'up',
    arrowup: 'up',
    s: 'down',
    arrowdown: 'down',
    a: 'left',
    arrowleft: 'left',
    d: 'right',
    arrowright: 'right',
  }[key];
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
}

function bindInterface() {
  $$('[data-enter-world]').forEach((button) => button.addEventListener('click', enterWorld));
  $$('[data-panel]').forEach((button) => {
    button.addEventListener('click', () => openPanel(button.dataset.panel));
  });
  $('[data-close-panel]')?.addEventListener('click', () => closePanel());
  $$('[data-start-arcade]').forEach((button) => button.addEventListener('click', startArcade));
  $$('[data-exit-arcade]').forEach((button) => button.addEventListener('click', leaveArcade));
  $$('[data-focus-node]').forEach((button) => {
    button.addEventListener('click', () => {
      const nodeId = button.dataset.focusNode;
      closePanel(false);
      world?.focusNode(nodeId);
      showToast('CAMERA ROUTED TO LIVE_ARCADE');
    });
  });

  $('[data-home]')?.addEventListener('click', (event) => {
    event.preventDefault();
    closePanel(false);
    leaveArcade();
    state.entered = false;
    document.documentElement.classList.remove('is-playing');
    world?.setActive(false);
    ui.missionTitle.textContent = 'ENTER THE STUDIO';
    ui.missionCopy.textContent = 'Initialize the playable world.';
  });

  $('#pixel-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    calculatePixelScale();
    audio.blip(650, 0.07, 'square', 0.12);
  });
  $$('#pixel-form input').forEach((input) => input.addEventListener('input', calculatePixelScale));

  $('#copy-wallet')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const original = button.textContent;
    try {
      await copyText($('#support-wallet').textContent.trim());
      button.textContent = 'WALLET COPIED';
      showToast('PUBLIC SOLANA ADDRESS COPIED');
      audio.blip(720, 0.08, 'square', 0.13);
    } catch (error) {
      button.textContent = 'COPY FAILED';
    }
    window.setTimeout(() => {
      button.textContent = original;
    }, 1700);
  });

  ui.sound.addEventListener('click', async () => {
    if (!state.sound) {
      const enabled = await audio.enable();
      if (!enabled) {
        showToast('AUDIO IS NOT AVAILABLE IN THIS BROWSER');
        return;
      }
      state.sound = true;
      ui.sound.textContent = 'SOUND ON';
      ui.sound.setAttribute('aria-pressed', 'true');
      audio.blip(540, 0.09, 'square', 0.14);
    } else {
      audio.blip(260, 0.07, 'square', 0.1);
      state.sound = false;
      ui.sound.textContent = 'SOUND OFF';
      ui.sound.setAttribute('aria-pressed', 'false');
    }
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (isTypingTarget(event.target)) {
      if (key === 'escape') event.target.blur();
      return;
    }

    const movement = movementForKey(key);
    if (movement) {
      event.preventDefault();
      enterWorld();
      world?.setMovement(movement, true);
      return;
    }
    if (event.repeat) return;

    if (key === 'enter' && !state.entered) enterWorld();
    else if (key === 'escape') {
      if (state.panel) closePanel();
      else if (state.arcade) leaveArcade();
    } else if (key === 'e') {
      enterWorld();
      world?.interactNearest();
    } else if (key === '1') startArcade();
    else if (key === '2') openPanel('project');
    else if (key === '3') openPanel('tools');
    else if (key === '4') openPanel('support');
  });

  document.addEventListener('keyup', (event) => {
    const movement = movementForKey(event.key.toLowerCase());
    if (movement) world?.setMovement(movement, false);
  });

  $$('.mobile-dpad [data-move]').forEach((button) => {
    const direction = button.dataset.move;
    const press = (event) => {
      event.preventDefault();
      enterWorld();
      button.setPointerCapture?.(event.pointerId);
      world?.setMovement(direction, true);
    };
    const release = (event) => {
      event.preventDefault();
      world?.setMovement(direction, false);
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
  });
  $('[data-mobile-action]')?.addEventListener('click', () => {
    enterWorld();
    world?.interactNearest();
  });

  ui.panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = $$('a[href], button:not([disabled]), input:not([disabled])', ui.panel).filter((element) => !element.closest('[hidden]'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

bindInterface();
initializeClock();
calculatePixelScale();
initializeWorld();
