// Pixel sprite data + renderer. Sprites are string matrices, one char per pixel.
// Palette chars: . = transparent
const PALETTE = {
  K: '#3b2d3f', // outline
  B: '#ffd9a8', // body cream
  D: '#f2b378', // body shade
  W: '#ffffff', // white
  P: '#ff9fb8', // pink cheek
  R: '#e2607e', // mouth
  G: '#8fd97a', // green
  Y: '#ffd94a', // gold
  O: '#f79c42', // orange
  S: '#9aa3b2', // stone
  T: '#6f7784', // stone shade
  L: '#7fc8f0', // light blue
  M: '#c98ff2', // magic purple
};

const CAT_IDLE = [
  '................',
  '..K..........K..',
  '.KBK........KBK.',
  '.KBDK......KDBK.',
  '.KBBKKKKKKKKBBK.',
  '.KBBBBBBBBBBBBK.',
  'KBBBBBBBBBBBBBBK',
  'KBKKBBBBBBBKKBBK',
  'KBKKBBBBBBBKKBBK',
  'KBBBBBKRRKBBBBBK',
  'KPPBBBBRRBBBBPPK',
  'KBBBBBBBBBBBBBBK',
  '.KBBBBBBBBBBBBK.',
  '.KBBKBBBBBBKBBK.',
  '..KKK..KK..KKK..',
  '................',
];

const CAT_BLINK = [
  '................',
  '..K..........K..',
  '.KBK........KBK.',
  '.KBDK......KDBK.',
  '.KBBKKKKKKKKBBK.',
  '.KBBBBBBBBBBBBK.',
  'KBBBBBBBBBBBBBBK',
  'KBBBBBBBBBBBBBBK',
  'KBKKBBBBBBBKKBBK',
  'KBBBBBKRRKBBBBBK',
  'KPPBBBBRRBBBBPPK',
  'KBBBBBBBBBBBBBBK',
  '.KBBBBBBBBBBBBK.',
  '.KBBKBBBBBBKBBK.',
  '..KKK..KK..KKK..',
  '................',
];

const CAT_HAPPY = [
  '................',
  '..K..........K..',
  '.KBK........KBK.',
  '.KBDK......KDBK.',
  '.KBBKKKKKKKKBBK.',
  '.KBBBBBBBBBBBBK.',
  'KBBKBBBBBBBBKBBK',
  'KBKBKBBBBBBKBKBK',
  'KBBBBBBBBBBBBBBK',
  'KBBBBKRRRRKBBBBK',
  'KPPBBBKRRKBBBPPK',
  'KBBBBBBKKBBBBBBK',
  '.KBBBBBBBBBBBBK.',
  '.KBBKBBBBBBKBBK.',
  '..KKK..KK..KKK..',
  '................',
];

const CAT_EAT = [
  '................',
  '..K..........K..',
  '.KBK........KBK.',
  '.KBDK......KDBK.',
  '.KBBKKKKKKKKBBK.',
  '.KBBBBBBBBBBBBK.',
  'KBBBBBBBBBBBBBBK',
  'KBKKBBBBBBBKKBBK',
  'KBKKBBBBBBBKKBBK',
  'KBBBBKRRRRKBBBBK',
  'KPPBBKRRRRKBBPPK',
  'KBBBBBKKKKBBBBBK',
  '.KBBBBBBBBBBBBK.',
  '.KBBKBBBBBBKBBK.',
  '..KKK..KK..KKK..',
  '................',
];

const CAT_SLEEP = [
  '................',
  '................',
  '..K..........K..',
  '.KBK........KBK.',
  '.KBDK......KDBK.',
  '.KBBKKKKKKKKBBK.',
  '.KBBBBBBBBBBBBK.',
  'KBBBBBBBBBBBBBBK',
  'KBBKKBBBBBBKKBBK',
  'KBBBBBBKKBBBBBBK',
  'KPPBBBBBBBBBBPPK',
  'KBBBBBBBBBBBBBBK',
  '.KBBBBBBBBBBBBK.',
  '.KBBBBBBBBBBBBK.',
  '..KKKKKKKKKKKK..',
  '................',
];

const CAT_DEAD = [
  '................',
  '..K..........K..',
  '.KBK........KBK.',
  '.KBDK......KDBK.',
  '.KBBKKKKKKKKBBK.',
  '.KBBBBBBBBBBBBK.',
  'KBBBBBBBBBBBBBBK',
  'KBKBKBBBBBKBKBBK',
  'KBBKBBBBBBBKBBBK',
  'KBKBKBBBBBKBKBBK',
  'KBBBBBKKKKBBBBBK',
  'KBBBBBBBBBBBBBBK',
  '.KBBBBBBBBBBBBK.',
  '.KBBBBBBBBBBBBK.',
  '..KKKKKKKKKKKK..',
  '................',
];

const GRAVE = [
  '................',
  '.....KKKKKK.....',
  '....KSSSSSSK....',
  '...KSSSSSSSSK...',
  '...KSSTSSTSSK...',
  '...KSSSSSSSSK...',
  '...KSTSSSSTSK...',
  '...KSSSSSSSSK...',
  '...KSSTSSTSSK...',
  '...KSSSSSSSSK...',
  '...KSSSSSSSSK...',
  '..KSSSSSSSSSSK..',
  '.KSSSSSSSSSSSSK.',
  'KGGGGGGGGGGGGGGK',
  '.KGGGGGGGGGGGG..',
  '................',
];

const BALL = [
  '..KKKK..',
  '.KWWLLK.',
  'KWWLLLLK',
  'KWLLLLLK',
  'KLLLLRLK',
  'KLLLRRLK',
  '.KLLLLK.',
  '..KKKK..',
];

const HEART = [
  '.KK..KK.',
  'KPPKKPPK',
  'KPPPPPPK',
  'KPPPPPPK',
  '.KPPPPK.',
  '..KPPK..',
  '...KK...',
  '........',
];

const APPLE = [
  '...KK...',
  '..KGK...',
  '.KRRRK..',
  'KRRRRRK.',
  'KRRRRRK.',
  'KRRRRRK.',
  '.KRRRK..',
  '..KKK...',
];

const BOWL = [
  '..KKKKKK..',
  '.KOOOOOOK.',
  'KOOYYYYOOK',
  'KWWWWWWWWK',
  '.KWWWWWWK.',
  '..KKKKKK..',
];

const CAKE = [
  '....K..K....',
  '....Y..Y....',
  '...KKKKKK...',
  '..KPPPPPPK..',
  '.KWWWWWWWWK.',
  '.KPPPPPPPPK.',
  'KWWWWWWWWWWK',
  'KPPPPPPPPPPK',
  '.KKKKKKKKKK.',
];

const CROWN = [
  'K...K...K.',
  'KY..KY..KY',
  'KYYKYYKYYK',
  'KYYYYYYYYK',
  '.KKKKKKKK.',
];

const SPARKLE = [
  '...M...',
  '...M...',
  '.MMMMM.',
  '...M...',
  '...M...',
];

// Draws a sprite matrix onto ctx at (x, y) in logical pixels, optionally mirrored.
function drawSprite(ctx, sprite, x, y, flip = false) {
  for (let row = 0; row < sprite.length; row++) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col++) {
      const ch = flip ? line[line.length - 1 - col] : line[col];
      const color = PALETTE[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + col, y + row, 1, 1);
    }
  }
}

// Renders a sprite to a data URL for use in DOM alerts.
function spriteToDataURL(sprite, scale = 6) {
  const w = sprite[0].length;
  const h = sprite.length;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const color = PALETTE[sprite[row][col]];
      if (!color) continue;
      cx.fillStyle = color;
      cx.fillRect(col * scale, row * scale, scale, scale);
    }
  }
  return c.toDataURL();
}

window.Sprites = {
  PALETTE, CAT_IDLE, CAT_BLINK, CAT_HAPPY, CAT_EAT, CAT_SLEEP, CAT_DEAD,
  GRAVE, BALL, HEART, APPLE, BOWL, CAKE, CROWN, SPARKLE,
  drawSprite, spriteToDataURL,
};
