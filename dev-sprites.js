// Broke Dev sprite set: a coder at a battlestation, front view, behind a laptop.
// Rows are ragged; normalizeSprite() pads them to a common width so the drawer
// and horizontal-flip logic stay simple. Char -> color via DEV_PALETTE.
const DEV_PALETTE = {
  o: '#2b2331', // outline / headphones
  K: '#4a2f22', // hair
  S: '#f4c9a0', // skin
  s: '#d99f74', // skin shade
  H: '#6d7be8', // hoodie
  h: '#4553b8', // hoodie shade
  W: '#ffffff',
  Y: '#ffd94a', // logo / highlights
  D: '#b07a44', // desk wood
  d: '#835831', // desk shade
  M: '#c2cad6', // laptop body
  m: '#8a93a3', // laptop shade
  G: '#15324a', // screen background
  g: '#74f0a6', // code text (green)
  R: '#ff5c6a', // error red
  C: '#e2482f', // energy can red
  c: '#b5351f', // can shade
  P: '#f0a63c', // pizza
  z: '#9fb0c4', // zzz / sweat blue-grey
};

// Pad every row to the widest row so column indexing + flip are uniform.
function normalizeSprite(rows) {
  const w = Math.max(...rows.map(r => r.length));
  return rows.map(r => r + '.'.repeat(w - r.length));
}

// Shared lower half: laptop on a desk, hands, energy can, empty cans.
// The screen chars (SCREEN) get swapped per state to signal mood.
function build(headRows, screen, opts = {}) {
  const cans = opts.cans !== false;
  const s = screen; // 12-wide screen content lines (5 rows), chars G/g/R/W
  return normalizeSprite([
    ...headRows,
    '.......ooooooooooooooooooo',       // laptop lid top
    '......oM' + s[0] + 'Mo',
    '......oM' + s[1] + 'Mo',
    '......oM' + s[2] + 'Mo',
    '......oM' + s[3] + 'Mo',
    '......oM' + s[4] + 'Mo',
    '.....oMMMMMMMMMMMMMMMMMMMo',        // hinge
    '....oSSMMMMMMMMMMMMMMMMSSMo',       // hands + keyboard deck
    '....osSMMMMMMMMMMMMMMMSssMo' + (cans ? '.CC' : ''),
    '...DDDDDDDDDDDDDDDDDDDDDDDD' + (cans ? 'CCCC' : ''),
    '...dddddddddddddddddddddddd' + (cans ? 'cccc' : ''),
    '...dddddddddddddddddddddddd',
  ]);
}

// Screen presets (5 rows x 12 cols).
const SCR_CODE = ['gg.gggg.gg..', 'g.gg..ggg.g.', 'gggg.gg..gg.', 'g.g..gggg.g.', 'gg.ggg..gg..'];
const SCR_ERR  = ['RR.RR..RR.R.', 'R..RRRR..RR.', 'RRR..RR.RRR.', 'R.RR..RRR.R.', 'RR..RRR..RR.'];
const SCR_DIM  = ['GGGGGGGGGGGG', 'GGGGGGGGGGGG', 'GGGGGGGGGGGG', 'GGGGGGGGGGGG', 'GGGGGGGGGGGG'];
const SCR_SHIP = ['gg..YYYY..gg', 'g..YYYYYY..g', 'g.YYWWWWYY.g', 'g..YYYYYY..g', 'gg..YYYY..gg'];

// --- Heads (front view, ~26 wide). Eyes/mouth change per state. ---
const HEAD_CODE = [
  '..........KKKKKKKK',
  '.........KKKKKKKKKK',
  '........KKSSSSSSSSKK',
  '.......oKSSSSSSSSSSKo',
  '.......oKSSWoSSWoSSKo',   // focused eyes
  '.......oKSSSSSSSSSSKo',
  '.......oKSSSooSSSSSKo',   // small mouth
  '........KSSSSSSSSSSK',
  '.........HHHHHHHHHH',
  '........HHHHHHHHHHHH',
];

const HEAD_DRINK = [
  '..........KKKKKKKK',
  '.........KKKKKKKKKK',
  '........KKSSSSSSSSKK...CC',
  '.......oKSSSSSSSSSSKo..CC', // can raised
  '.......oKSSWoSSWoSSKo..CC',
  '.......oKSSSSSSSSSSKssCC',  // hand tilting can to mouth
  '.......oKSSSSSSSSooSKs',    // sipping mouth
  '........KSSSSSSSSSSK',
  '.........HHHHHHHHHH',
  '........HHHHHHHHHHHH',
];

const HEAD_STRESS = [
  '..........KKKKKKKK',
  '.........KKKKKKKKKK',
  '......z.KKSSSSSSSSKK',
  '.....zz.oKSSSSSSSSSSKo',
  '.......oKSSRoSSRoSSKo',   // wide stressed eyes
  '.......oKSSSSSSSSSSKo',
  '.......oKSSoooooooSKo',   // gritted mouth
  '........KSSSSSSSSSSK',
  '.........HHHHHHHHHH',
  '........HHHHHHHHHHHH',
];

const HEAD_SLEEP = [
  '..........KKKKKKKK',
  '.........KKKKKKKKKK',
  '........KKSSSSSSSSKK',
  '.......oKSSSSSSSSSSKo..z',
  '.......oKSSssSSssSSKo.z', // closed eyes (--)
  '.......oKSSSSSSSSSSKo.z',
  '.......oKSSSSooSSSSKo',
  '........KSSSSSSSSSSK',
  '.........HHHHHHHHHH',
  '........HHHHHHHHHHHH',
];

const HEAD_BURN = [
  '..........KKKKKKKK',
  '.........KKKKKKKKKK',
  '........KKssssssssKK',
  '.......oKssssssssssKo',
  '.......oKssRossRossKo',   // drained red eyes
  '.......oKssssssssssKo',
  '.......oKssoooooooosKo',  // flat dead mouth
  '........KssssssssssK',
  '.........hhhhhhhhhh',
  '........hhhhhhhhhhhh',
];

const HEAD_SHIP = [
  '..........KKKKKKKK',
  '.........KKKKKKKKKK',
  '........KKSSSSSSSSKK',
  '.......oKSSSSSSSSSSKo',
  '.......oKSS^SS^SSSKo',    // happy eyes
  '.......oKSSSSSSSSSSKo',
  '.......oKSSWWWWWWSSKo',   // big grin
  '........KSSSSSSSSSSK',
  '.........HHHHHHHHHH',
  '........HHHHHHHHHHHH',
];

const DEV_CODE   = build(HEAD_CODE, SCR_CODE);
const DEV_DRINK  = build(HEAD_DRINK, SCR_CODE);
const DEV_STRESS = build(HEAD_STRESS, SCR_ERR);
const DEV_SLEEP  = build(HEAD_SLEEP, SCR_DIM);
const DEV_BURN   = build(HEAD_BURN, SCR_DIM);
const DEV_SHIP   = build(HEAD_SHIP, SCR_SHIP);

// Reuse the '^' char for happy eyes -> map to outline color.
DEV_PALETTE['^'] = '#2b2331';
// Extra colors for the tip-item icons.
DEV_PALETTE.b = '#6b4a2f'; // coffee brown
DEV_PALETTE.n = '#4caf6a'; // cash green
DEV_PALETTE.p = '#c98ff2'; // sponsor purple

// Tip-item icons (a broke dev's survival kit), used in alerts + the tier list.
const ICON_COFFEE = normalizeSprite([
  '..W.W..',
  '.......',
  'ooooooo',
  'obbbbbo.o',
  'obbbbbooo',
  'obbbbbo.o',
  '.ooooo..',
]);
const ICON_REDBULL = normalizeSprite([
  '.oooo.',
  'oYYYYo',
  'oCCCCo',
  'oCWWCo',
  'oCWWCo',
  'oCCCCo',
  'oYYYYo',
  '.oooo.',
]);
const ICON_PIZZA = normalizeSprite([
  'ooooooo',
  'oPPPPPo',
  'oPRPPRo',
  '.oPPPo.',
  '.oPRPo.',
  '..oPo..',
  '...o...',
]);
const ICON_CASH = normalizeSprite([
  'ooooooooo',
  'onnnnnnno',
  'onYnnnYno',
  'onnYnYnno',
  'onYnnnYno',
  'onnnnnnno',
  'ooooooooo',
]);
const ICON_SPONSOR = normalizeSprite([
  '...o...',
  '..oyo..',
  '.opppo.',
  'oppWppo',
  '.opppo.',
  '..opo..',
  '...o...',
]);
DEV_PALETTE.y = '#ffd94a';
const ICON_TIP = normalizeSprite([
  '.ooo.',
  'oYYYo',
  'oYWYo',
  '.oYo.',
  '..o..',
]);

// Draw a sprite matrix at (x,y) in logical px, optionally horizontally flipped.
function drawSprite(ctx, sprite, x, y, flip = false) {
  for (let row = 0; row < sprite.length; row++) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col++) {
      const ch = flip ? line[line.length - 1 - col] : line[col];
      const color = DEV_PALETTE[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + col, y + row, 1, 1);
    }
  }
}

// Render a sprite to a data URL (for DOM icons in the tier list + alerts).
function spriteToDataURL(sprite, scale = 6) {
  const w = sprite[0].length, h = sprite.length;
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const color = DEV_PALETTE[sprite[row][col]];
      if (!color) continue;
      cx.fillStyle = color;
      cx.fillRect(col * scale, row * scale, scale, scale);
    }
  }
  return c.toDataURL();
}

window.DevSprites = {
  DEV_PALETTE,
  DEV_CODE, DEV_DRINK, DEV_STRESS, DEV_SLEEP, DEV_BURN, DEV_SHIP,
  ICON_COFFEE, ICON_REDBULL, ICON_PIZZA, ICON_CASH, ICON_SPONSOR, ICON_TIP,
  drawSprite, spriteToDataURL,
};
