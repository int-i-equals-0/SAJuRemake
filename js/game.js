'use strict';

const COLS = 12;              
const ROWS = 8;               
const COLORS = 4;             
const MATCH_MIN = 3;          
const START_LIVES = 1;   
const MAX_LIVES = 3;     
const SCORE_CAP = 65000;
const BOOM_FRAMES = 4;        
const W = 1010, H = 800;
const TILE = 80;                                 
const FIELD_W = COLS * TILE;                     
const FIELD_X = 30;
const RAIL_H = 90;                               
const FIELD_TOP = 80;                            
const FIELD_BOTTOM = FIELD_TOP + ROWS * TILE;    
const HUD_H = H - FIELD_BOTTOM;                  
const TICK_MS = 100;              
const CELL_MS = TICK_MS * 4;      
const WALK_MS = CELL_MS;      
const CLIMB_MS = CELL_MS;     
const HOP_MS = CELL_MS;       
const FALL_MS_PER_ROW = 95;   
const BOOM_MS = TICK_MS;      
const CRATE_FALL_MS = CELL_MS;  
let slideDur = CELL_MS;       

const CRATE_COLORS = [
  { base: '#d9484a', light: '#ef8586', dark: '#93282a' },
  { base: '#4caf6d', light: '#8ad4a4', dark: '#2c7548' },
  { base: '#f2b134', light: '#f8d488', dark: '#b07a15' },
  { base: '#3f8fd2', light: '#7ab5e6', dark: '#255f95' },
];

const EMPTY = 0, WORKER = 1, CRATE0 = 2, DARK = 6;
const BALL0 = 7, BALL_BLACK = 11;
const HAMMER = 12, MAGNET = 13, FEATHER = 14, DUMBBELL = 15, WARNING = 16, HEART = 17;
const BOOM0 = 18;
const BONUS_TICKS_MS = 5000;   

const CHARACTERS = [
  {
    key: 'red', name: 'КРАСНЫЙ', suit: '#d9484a', push: 1, climb: 1, unlock: 0, bonus: 0,
    hint: 'прыгаю на один ящик и двигаю один ящик',
  },
  {
    key: 'blue', name: 'СИНИЙ', suit: '#3f8fd2', push: 2, climb: 1, unlock: 1000, bonus: FEATHER,
    hint: 'двигаю два ящика',
  },
  {
    key: 'green', name: 'ЗЕЛЁНЫЙ', suit: '#4caf6d', push: 1, climb: 2, unlock: 2500, bonus: DUMBBELL,
    hint: 'прыгаю вдвое выше',
  },
];

const GFX_DIRS = { pixel: 'assets/sprites', modern: 'assets/new_sprites' };
const GFX = { pixel: {}, modern: {} };
let gfxMode = 'pixel';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const MAX_BUFFER_W = W * 2;

function resize() {
  const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 3);
  const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
  const cssW = rect && rect.width ? rect.width : W;
  const bw = Math.max(1, Math.min(MAX_BUFFER_W, Math.round(cssW * dpr)));
  const bh = Math.max(1, Math.round(bw * H / W));
  if (canvas.width === bw && canvas.height === bh) return;
  canvas.width = bw;
  canvas.height = bh;
  ctx.setTransform(bw / W, 0, 0, bw / W, 0, 0);
  ctx.imageSmoothingEnabled = gfxMode === 'modern';   
}
resize();
addEventListener('resize', resize);
addEventListener('orientationchange', resize);
if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(canvas);
const IMG = {};              
const TILE_SPRITES = [
  'crate_red', 'crate_green', 'crate_yellow', 'crate_blue', 'crate_dark',
  'ball_red', 'ball_green', 'ball_yellow', 'ball_blue', 'ball_black',
  'hammer', 'magnet', 'feather', 'dumbbell', 'warning', 'heart',
  'boom0', 'boom1', 'boom2', 'boom3',
];
const WORKER_FRAMES = {
  idle: [4, 5, 6],                     
  walk: [7, 8, 9],                     
  push: [1, 2, 3],                     
  jump: 0,                             
  death: [10, 11, 12, 13, 14, 15, 16], 
};
const DEATH_MS = TICK_MS * 10;
const DEATH_FRAME_MS = DEATH_MS / 7;
const SPRITE_LIST = [
  ...TILE_SPRITES, 'background', 'rail', 'crane0', 'crane1', 'ui_a', 'ui_b', 'ui_c',
  ...Array.from({ length: 7 }, (_, i) => `hourglass${i}`),
];
for (const c of ['red', 'blue', 'green']) {
  for (let i = 0; i < 17; i++) SPRITE_LIST.push(`worker_${c}_${String(i).padStart(2, '0')}`);
}
const SCREENS = { menu: 'main_menu', char1: 'char1', char2: 'char2', char3: 'char3' };

let assetsLeft = 0;
let assetsTotal = 0;
function loadSpriteSet(mode, done) {
  if (typeof Image === 'undefined' || Object.keys(GFX[mode]).length) {
    if (done) done();
    return;
  }
  let left = SPRITE_LIST.length;
  for (const name of SPRITE_LIST) {
    const im = new Image();
    im.onload = im.onerror = () => { if (--left === 0 && done) done(); };
    im.src = `${GFX_DIRS[mode]}/${name}.png`;
    GFX[mode][name] = im;
  }
}

function loadAssets(done) {
  
  if (typeof Image === 'undefined') { done(); return; }
  const screens = Object.entries(SCREENS)
    .map(([k, f]) => [k, `assets/ui_pixel_10x/final/${f}-1010x800.png`]);
  assetsTotal = assetsLeft = screens.length + 1;
  const tick = () => { if (--assetsLeft === 0) done(); };
  for (const [name, path] of screens) {
    const im = new Image();
    im.onload = im.onerror = tick;
    im.src = path;
    IMG[name] = im;
  }
  loadSpriteSet(gfxMode, tick);
}

function sprite(name) {
  const im = GFX[gfxMode][name] || IMG[name];
  return im && im.width ? im : null;
}

function applyGfxMode() {
  
  ctx.imageSmoothingEnabled = gfxMode === 'modern';
  loadSpriteSet(gfxMode);
}

const SOUND_FILES = {
  clear:  'snd26',   
  ball:   'snd28',   
  tool:   'snd27',   
  hurt:   'snd25',   
  record: 'snd23',   
  jump:   'snd24',   
  step:   'snd29',   
  land:   'snd30',   
  push:   'snd32',   
  pickup: 'snd33',   
  smash:  'snd31',   
  music:  'snd34',   
};

const SOUND_PRIORITY = {
  record: 5, hurt: 4,
  clear: 3, ball: 3, tool: 3,
  smash: 2, pickup: 2,
  jump: 1, step: 1, push: 1, land: 1,
};

let soundMode = 'channel';
const SOUND_POOL = 4;
const pools = {};
let channel = null;          
let audioOn = true;
let volume = 0.6;        
let audioReady = false;      

function loadSounds() {
  if (typeof Audio === 'undefined') return;      
  for (const name of Object.keys(SOUND_FILES)) {
    const music = name === 'music';
    const list = [];
    for (let i = 0; i < (music ? 1 : SOUND_POOL); i++) {
      const a = new Audio(`assets/sound/${SOUND_FILES[name]}.ogg`);
      a.preload = 'auto';
      a.volume = baseVolume(name) * volume;
      a.loop = music;
      list.push(a);
    }
    pools[name] = { list, next: 0 };
  }
}

const baseVolume = name => (name === 'music' ? 0.3 : 0.6);

function applyVolume() {
  for (const name of Object.keys(pools)) {
    for (const a of pools[name].list) a.volume = baseVolume(name) * volume;
  }
}

function playing(a) { return a && !a.paused && !a.ended; }

function playSound(name) {
  if (!audioOn || !audioReady) return;
  const p = pools[name];
  if (!p) return;
  const prio = SOUND_PRIORITY[name] || 1;
  if (soundMode === 'channel') {
    
    if (channel && playing(channel.audio) && channel.prio > prio) return;
    if (channel && playing(channel.audio)) {
      channel.audio.pause();
      channel.audio.currentTime = 0;
    }
  }

  const a = p.list[p.next];
  p.next = (p.next + 1) % p.list.length;
  try {
    a.currentTime = 0;
    const r = a.play();
    if (r && r.catch) r.catch(() => {});        
  } catch (e) {  }
  if (soundMode === 'channel') channel = { audio: a, prio };
}

function updateMusic() {
  const m = pools.music && pools.music.list[0];
  if (!m) return;
  const want = audioOn && audioReady &&
    (state === 'menu' || state === 'options' ||
     state === 'select' || state === 'controls');
  if (want && m.paused) {
    const r = m.play();
    if (r && r.catch) r.catch(() => {});
  } else if (!want && !m.paused) {
    m.pause();
  }
}

function toggleSound() {
  audioOn = !audioOn;
  if (!audioOn) {
    for (const p of Object.values(pools)) {
      for (const a of p.list) { a.pause(); a.currentTime = 0; }
    }
    channel = null;
  }
}

let grid;        
let boomTimer;   
let offX;        
let shovedCell;  
let falling;     
let worker;
let cranes;      
let craneTimer;  
let score, lives, level, chain, cleared;
let state;       
let hurtFlash, shakeT;
let held;        
let heldT;       
let freezeT;     
let pauseClock;  
let dying;       
let awaitingRespawn; 
let deathAt;     
let menuIdx = 0;   
let charIdx = 0;
let hero = CHARACTERS[0];

const BEST_KEY = 'stackattack.best';
let best = (() => {
  try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; }
})();
function saveBest(v) {
  if (v <= best) return;
  best = v;
  try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) {  }
}
const unlocked = i => best >= CHARACTERS[i].unlock;
const OPT_KEY = 'stackattack.options';
const OPTIONS = [
  { key: 'gfx',   title: 'ГРАФИКА',      vals: ['pixel', 'modern'],   names: ['пиксельная', 'современная'] },
  { key: 'sound', title: 'ЗВУК',         vals: [true, false],         names: ['включён', 'выключен'] },
  { key: 'smode', title: 'РЕЖИМ ЗВУКА',  vals: ['channel', 'mix'],    names: ['один канал', 'наложение'] },
  { key: 'vol',   title: 'ГРОМКОСТЬ',   vals: [0, 0.2, 0.4, 0.6, 0.8, 1],
    names: ['тихо', '20%', '40%', '60%', '80%', '100%'] },
];
let optIdx = 0;
let optFrom = 'menu';

function optValue(key) {
  if (key === 'gfx') return gfxMode;
  if (key === 'sound') return audioOn;
  if (key === 'vol') return volume;
  return soundMode;
}

function setOption(key, v) {
  if (key === 'gfx') { gfxMode = v; applyGfxMode(); }
  else if (key === 'sound') { if (audioOn !== v) toggleSound(); }
  else if (key === 'vol') { volume = v; applyVolume(); }
  else soundMode = v;
  saveOptions();
}

function loadOptions() {
  try {
    const o = JSON.parse(localStorage.getItem(OPT_KEY) || '{}');
    if (o.gfx === 'pixel' || o.gfx === 'modern') gfxMode = o.gfx;
    if (typeof o.sound === 'boolean') audioOn = o.sound;
    if (o.smode === 'channel' || o.smode === 'mix') soundMode = o.smode;
    if (typeof o.vol === 'number' && o.vol >= 0 && o.vol <= 1) volume = o.vol;
  } catch (e) {  }
}

function saveOptions() {
  try {
    localStorage.setItem(OPT_KEY,
      JSON.stringify({ gfx: gfxMode, sound: audioOn, smode: soundMode, vol: volume }));
  } catch (e) {  }
}

const activePush = () => hero.push + (held === DUMBBELL && heldT > 0 ? 1 : 0);
const activeClimb = () => hero.climb + (held === FEATHER && heldT > 0 ? 1 : 0);
const rnd = n => Math.floor(Math.random() * n);

function rowTopY(row) { return FIELD_BOTTOM - (row + 1) * TILE; }
function colHeight(c) {
  let h = 0;
  while (h < ROWS && isSolid(grid[c][h])) h++;
  return h;
}

const isCrate = v => v >= CRATE0 && v < CRATE0 + COLORS;
const isBonus = v => v >= BALL0 && v <= HEART;
const isSolid = v => v >= CRATE0 && v < BOOM0;
const isBoom = v => v >= BOOM0;
const ballTargetCrate = v => v - 5;
const collectible = v =>
  v === HEART ? lives < MAX_LIVES : (isBonus(v) && !held);

const standable = v => isSolid(v) && !collectible(v);

function walkHeight(c) {
  let h = 0;
  while (h < ROWS && standable(grid[c][h])) h++;
  return h;
}

function collectHere() {
  if (held) return;
  for (const r of [worker.row, worker.row + 1]) {
    if (r >= ROWS) continue;
    const v = grid[worker.col][r];
    if (collectible(v)) {
      pickUp(v);
      grid[worker.col][r] = EMPTY;
      settleColumn(worker.col);
      return;
    }
  }
}

const pushable = v => isCrate(v) || (isBonus(v) && !collectible(v));

function buildStartLayout() {
  grid = Array.from({ length: COLS }, () => new Array(ROWS).fill(EMPTY));
  const cols = [...Array(COLS).keys()];
  for (let i = cols.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [cols[i], cols[j]] = [cols[j], cols[i]];
  }
  const withCrate = cols.slice(0, 8);
  for (const c of withCrate) grid[c][0] = CRATE0 + rnd(COLORS);
  const shuffled = [...withCrate];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (const c of shuffled.slice(0, 4)) grid[c][1] = CRATE0 + rnd(COLORS);
  let startCol = 0;
  for (let c = 0; c < COLS; c++) {
    if (grid[c][1] !== EMPTY) { startCol = c; break; }
  }
  return { col: startCol, row: colHeight(startCol) };
}

function init() {
  hero = CHARACTERS[charIdx];
  const start = buildStartLayout();
  boomTimer = Array.from({ length: COLS }, () => new Array(ROWS).fill(0));
  offX = Array.from({ length: COLS }, () => new Array(ROWS).fill(0));
  shovedCell = Array.from({ length: COLS }, () => new Array(ROWS).fill(false));
  falling = [];
  score = 0;
  lives = START_LIVES;
  level = 1;
  chain = 0;
  cleared = 0;
  hurtFlash = 0;
  shakeT = 0;
  held = 0;
  heldT = 0;
  freezeT = 0;
  pauseClock = 0;
  dying = 0;
  awaitingRespawn = false;
  deathAt = null;
  state = 'playing';
  worker = {
    col: start.col, row: start.row,
    x: start.col * TILE, y: rowTopY(start.row),
    facing: 1, tween: null, pendingDir: 0, air: false,
  };
  cranes = [];
  craneTimer = 700;
}
function scoreMul() { return Math.max(1, cranes.length); }


function maxCranes() { return Math.min(4, 1 + Math.floor((level - 1) / 2)); }
function craneSpeed() { return 170 + (level - 1) * 28; }
function craneCooldown() { return Math.max(420, 1450 - (level - 1) * 130); }

function addScore(points) {
  score = Math.min(SCORE_CAP, score + points);
}

const keys = { left: false, right: false, jump: false, jumpL: false, jumpR: false, use: false };
const queue = [];
const QUEUE_MAX = 5;
const OPPOSITE = {
  left: ['right', 'jumpR'], jumpL: ['right', 'jumpR'],
  right: ['left', 'jumpL'], jumpR: ['left', 'jumpL'],
};
const JUMPS = ['jump', 'jumpL', 'jumpR'];
function action(a) {
  if (state !== 'playing') return;
  
  
  if (a === 'use') { useBonus(); return; }
  
  if (JUMPS.includes(a) && queue.some(q => JUMPS.includes(q))) return;
  const drop = OPPOSITE[a];
  if (drop) {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (drop.includes(queue[i])) queue.splice(i, 1);
    }
    
    if (worker && worker.pendingDir) {
      const wantLeft = a === 'left' || a === 'jumpL';
      if ((worker.pendingDir < 0) !== wantLeft) worker.pendingDir = 0;
    }
  }
  if (queue.length < QUEUE_MAX) queue.push(a);
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; pauseClock = 0; }
  else if (state === 'paused') state = 'playing';
}

addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
  audioReady = true;                       
  if (e.code === 'KeyM') { toggleSound(); return; }
  const left = e.code === 'ArrowLeft' || e.code === 'KeyA';
  const right = e.code === 'ArrowRight' || e.code === 'KeyD';
  const confirm = e.code === 'Enter' || e.code === 'Space';

  if (state === 'loading') return;

  if (state === 'menu') {
    if (left || right) menuIdx = 1 - menuIdx;
    if (confirm) { optFrom = 'menu'; optIdx = 0; state = menuIdx === 0 ? 'select' : 'options'; }
    return;
  }

  if (state === 'options') {
    const up = e.code === 'ArrowUp' || e.code === 'KeyW';
    const down = e.code === 'ArrowDown' || e.code === 'KeyS';
    if (up) optIdx = (optIdx + OPTIONS.length - 1) % OPTIONS.length;
    if (down) optIdx = (optIdx + 1) % OPTIONS.length;
    if (left || right) {
      const o = OPTIONS[optIdx];
      const i = o.vals.indexOf(optValue(o.key));
      setOption(o.key, o.vals[(i + (right ? 1 : o.vals.length - 1)) % o.vals.length]);
    }
    if (confirm || e.code === 'Escape') {
      saveOptions();
      state = optFrom === 'paused' ? 'paused' : 'menu';
    }
    return;
  }
  if (state === 'select') {
    if (left) charIdx = (charIdx + CHARACTERS.length - 1) % CHARACTERS.length;
    if (right) charIdx = (charIdx + 1) % CHARACTERS.length;
    if (confirm && unlocked(charIdx)) state = 'controls';
    return;
  }
  if (state === 'controls') { if (confirm) init(); return; }
  if (state === 'gameover') { if (e.code === 'Enter') state = 'menu'; return; }
  
  
  if (state === 'paused' && (e.code === 'KeyO' || e.code === 'Enter')) {
    optFrom = 'paused';
    optIdx = 0;
    state = 'options';
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }

  
  
  const jumpL = e.code === 'KeyQ';
  const jumpR = e.code === 'KeyE';
  const jump = e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space';
  const use = e.code === 'ArrowDown' || e.code === 'KeyS';
  if (left && !keys.left) { keys.left = true; action('left'); }
  if (right && !keys.right) { keys.right = true; action('right'); }
  if (jumpL && !keys.jumpL) { keys.jumpL = true; action('jumpL'); }
  if (jumpR && !keys.jumpR) { keys.jumpR = true; action('jumpR'); }
  if (jump && !keys.jump) { keys.jump = true; action('jump'); }
  if (use && !keys.use) { keys.use = true; action('use'); }
});
addEventListener('keyup', e => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'KeyQ') keys.jumpL = false;
  if (e.code === 'KeyE') keys.jumpR = false;
  if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keys.jump = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.use = false;
});


function bindTouchControls() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  for (const el of document.querySelectorAll('[data-act]')) {
    const act = el.getAttribute('data-act');
    const down = ev => {
      ev.preventDefault();
      audioReady = true;
      if (act === 'pause') { togglePause(); return; }
      if (state === 'options') {
        if (act === 'left' || act === 'right') {
          const o = OPTIONS[optIdx];
          const i = o.vals.indexOf(optValue(o.key));
          setOption(o.key, o.vals[(i + (act === 'right' ? 1 : o.vals.length - 1)) % o.vals.length]);
        } else if (act === 'jump') {
          optIdx = (optIdx + 1) % OPTIONS.length;
        } else {
          saveOptions();
          state = 'menu';
        }
        return;
      }
      if (state === 'menu' || state === 'select' || state === 'controls' || state === 'gameover') {
        if (state === 'menu') {
          if (act === 'left' || act === 'right') { menuIdx = 1 - menuIdx; return; }
          optFrom = 'menu'; optIdx = 0;
          state = menuIdx === 0 ? 'select' : 'options';
        }
        else if (state === 'select' && unlocked(charIdx)) state = 'controls';
        else if (state === 'controls') init();
        else if (state === 'gameover') state = 'menu';
        return;
      }
      if (act === 'left') keys.left = true;
      if (act === 'right') keys.right = true;
      action(act);
    };
    const up = () => {
      if (act === 'left') keys.left = false;
      if (act === 'right') keys.right = false;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('contextmenu', ev => ev.preventDefault());
  }
}
bindTouchControls();





function startTween(toCol, toRow, dur, arc, ease, next) {
  worker.tween = {
    t: 0, dur, arc: arc || 0, ease: ease || null, next: next || null,
    fromX: worker.x, fromY: worker.y,
    toX: toCol * TILE, toY: rowTopY(toRow),
    toCol, toRow,
  };
}

function easeAt(tw, p) {
  if (tw.ease === 'in') return p * p;
  if (tw.ease === 'out') return 1 - (1 - p) * (1 - p);
  return p;
}

function blocked(c, r) {
  return c < 0 || c >= COLS || r < 0 || r >= ROWS || grid[c][r] !== EMPTY;
}






function planMove(dir, atRow) {
  const tc = worker.col + dir;
  if (tc < 0 || tc >= COLS) return null;

  const moves = [];      
  const pickups = [];
  for (const r of [atRow, atRow + 1]) {
    if (r >= ROWS) continue;
    const v = grid[tc][r];
    if (v === EMPTY) continue;
    
    if (collectible(v)) { pickups.push([tc, r, v]); continue; }
    if (!pushable(v)) return null;         
    
    
    if (offX[tc][r] !== 0) return null;

    let c = tc;
    while (c >= 0 && c < COLS && pushable(grid[c][r]) && offX[c][r] === 0) {
      moves.push([c, r, grid[c][r]]);
      c += dir;
    }
    if (c < 0 || c >= COLS || grid[c][r] !== EMPTY) return null;  
  }
  
  
  const slides = [];
  const catches = [];
  for (const f of falling) {
    if (f.col !== tc) continue;
    const fr = fallRow(f);
    if (fr >= atRow + 2 || fr + 1 <= atRow) continue;
    
    if (collectible(f.color)) { catches.push(f); continue; }
    if (f.shoved) return null;                      
    if (tc + dir < 0 || tc + dir >= COLS) return null;
    if (colHeight(tc + dir) > fr) return null;      
    slides.push(f);
  }

  if (moves.length + slides.length > activePush()) return null;
  return { moves, pickups, slides, catches, toCol: tc };
}


function fallRow(f) {
  const dist = f.row - f.toRow;
  const p = Math.min(1, f.t / (CRATE_FALL_MS * dist || 1));
  return f.row - dist * p;
}

function applyMove(plan, dir, dur) {
  slideDur = dur || WALK_MS;
  for (const [c, r, v] of plan.moves.slice().reverse()) {   
    grid[c + dir][r] = v;
    grid[c][r] = EMPTY;
    offX[c + dir][r] = -dir * TILE;      
    offX[c][r] = 0;
    shovedCell[c + dir][r] = true;
    shovedCell[c][r] = false;
  }
  for (const f of plan.slides || []) {   
    const fr = fallRow(f);
    const from = f.col;
    f.col += dir;
    f.row = fr;
    
    
    
    
    f.fromCol = from;
    f.toRow = Math.min(Math.floor(fr), Math.max(colHeight(f.col), colHeight(from)));
    f.t = 0;
    f.offX = -dir * TILE;               
    f.shoved = true;                    
  }
  for (const [c, r, v] of plan.pickups) {
    pickUp(v);
    grid[c][r] = EMPTY;
  }
  for (const f of plan.catches || []) {   
    pickUp(f.color);
    const i = falling.indexOf(f);
    if (i >= 0) falling.splice(i, 1);
  }
  const cols = new Set([worker.col, plan.toCol]);
  for (const [c] of plan.moves) { cols.add(c); cols.add(c + dir); }
  for (const c of cols) if (c >= 0 && c < COLS) settleColumn(c);
  checkClears();
}

function tryStep(dir) {
  worker.facing = dir;
  const plan = planMove(dir, worker.row);
  if (plan) {
    
    
    const pushing = plan.moves.length > 0 || (plan.slides || []).length > 0;
    playSound(pushing ? 'push' : 'step');
    applyMove(plan, dir, WALK_MS);
    startTween(plan.toCol, worker.row, WALK_MS, 0);
    worker.tween.pushing = pushing;
    return;
  }
  
  
}








function riseHeight() {
  let rise = 0;
  while (rise < activeClimb()
         && worker.row + rise + 2 < ROWS
         && grid[worker.col][worker.row + rise + 2] === EMPTY) {
    rise++;
  }
  return rise;
}




function isRising() {
  const tw = worker.tween;
  if (!tw) return false;
  if (tw.toRow > worker.row) return true;          
  return !!tw.arc && tw.t < tw.dur / 2;            
}

function checkAirborneHits() {
  if (dying > 0 || awaitingRespawn) return;
  const rising = isRising();
  
  
  
  const wr = worker.tween ? (FIELD_BOTTOM - worker.y) / TILE - 1 : worker.row;
  for (let i = falling.length - 1; i >= 0; i--) {
    const f = falling[i];
    
    
    
    const fx = f.col * TILE + (f.offX || 0);
    const wx = worker.tween ? worker.x : worker.col * TILE;
    if (Math.abs(fx - wx) >= TILE / 2) continue;
    const fr = fallRow(f);
    if (fr >= wr + 2 || fr + 1 <= wr) continue;                   

    if (collectible(f.color)) {          
      pickUp(f.color);
      falling.splice(i, 1);
      continue;
    }

    
    
    
    const overHead = fr >= wr + 1;
    if (rising && overHead && f.color !== DARK) {
      falling.splice(i, 1);                
      playSound('smash');
      queue.length = 0;                    
      const r = Math.max(0, Math.min(ROWS - 1, Math.round(fr)));
      if (grid[worker.col][r] === EMPTY) {
        grid[worker.col][r] = BOOM0;
        boomTimer[worker.col][r] = BOOM_MS;
      }
      shakeT = Math.max(shakeT, 120);
      continue;
    }
    if (overHead && f.color === DARK && rising) continue;  

    
    
    
    
    
    loseLife(worker.col, Math.max(0, Math.round(wr)));
    return;
  }
}


function headButt() {
  const rise = riseHeight();
  if (rise >= activeClimb()) return;             
  const r = worker.row + rise + 2;
  if (r >= ROWS) return;
  const c = worker.col;
  const v = grid[c][r];
  if (v === EMPTY || v === DARK || isBoom(v)) return;
  if (collectible(v)) {
    pickUp(v);
    grid[c][r] = EMPTY;
  } else {
    playSound('smash');
    explode(c, r);
    
    
    
    queue.length = 0;
  }
  settleColumn(c);
}

function tryJump(forced) {
  const dir = forced || (keys.left ? -1 : keys.right ? 1 : 0);
  playSound('jump');
  worker.air = true;
  headButt();
  const rise = riseHeight();

  if (dir !== 0) {
    worker.facing = dir;
    const tc = worker.col + dir;
    
    
    const higher = tc >= 0 && tc < COLS && walkHeight(tc) > worker.row;

    
    for (let h = rise; h >= 0; h--) {
      const toRow = worker.row + h;
      const plan = planMove(dir, toRow);
      if (!plan) continue;
      if (h > 0 && higher) {
        
        
        
        
        startTween(worker.col, toRow, CLIMB_MS, 0, 'out',
                   { row: toRow, dur: HOP_MS, dir });
      } else {
        applyMove(plan, dir, CLIMB_MS);
        startTween(plan.toCol, toRow, CLIMB_MS, TILE * 0.5);
      }
      return;
    }
  }

  
  
  
  if (rise > 0) {
    startTween(worker.col, worker.row + rise, CLIMB_MS, 0, 'out');
    worker.tween.rise = true;
  } else {
    startTween(worker.col, worker.row, CLIMB_MS, TILE * 0.4);
  }
}


function pickUp(value) {
  playSound('pickup');
  if (value === HEART) {                       
    lives = Math.min(MAX_LIVES, lives + 1);
    return;
  }
  held = value;
  heldT = 0;
}



function visualRow() {
  if (!worker.tween) return worker.row;        
  const r = Math.round((FIELD_BOTTOM - worker.y) / TILE - 1);
  return Math.max(0, Math.min(ROWS - 1, r));
}

function useBonus() {
  if (!held || heldT > 0) return;
  const row = visualRow();

  
  if (held >= BALL0 && held < BALL_BLACK) {
    playSound('ball');
    const target = ballTargetCrate(held);
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++)
        if (grid[c][r] === target) explode(c, r);
    held = 0;
    shakeT = 200;
    return;
  }

  
  if (held === BALL_BLACK) {
    playSound('tool');
    const c1 = Math.max(0, worker.col - 1), c2 = Math.min(COLS - 1, worker.col + 1);
    const r1 = Math.max(0, row - 1), r2 = Math.min(ROWS - 1, row + 2);
    for (let c = c1; c <= c2; c++)
      for (let r = r1; r <= r2; r++)
        if (grid[c][r] !== WORKER && grid[c][r] !== EMPTY && !isBoom(grid[c][r])) explode(c, r);
    held = 0;
    shakeT = 260;
    return;
  }

  const front = worker.col + worker.facing;

  
  if (held === HAMMER) {
    if (front >= 0 && front < COLS) {
      const v = grid[front][row];
      if (v > WORKER && v !== DARK && !isBoom(v)) {
        playSound('tool');
        explode(front, row);
        held = 0;
      }
    }
    return;
  }

  
  if (held === MAGNET) {
    const back = worker.col - worker.facing;
    if (front >= 0 && front < COLS && back >= 0 && back < COLS) {
      const v = grid[front][row];
      if (v > WORKER && v !== DARK && !isBoom(v) && grid[back][row] === EMPTY) {
        grid[worker.col][row] = v;
        grid[front][row] = EMPTY;
        offX[front][row] = 0;
        
        offX[worker.col][row] = worker.facing * TILE;
        playSound('tool');
        slideDur = WALK_MS;
        held = 0;
        
        
        worker.row = row;
        worker.y = rowTopY(row);
        worker.tween = null;
        worker.pendingDir = 0;
        startTween(back, row, WALK_MS, 0);
        settleColumn(front);
        checkClears();
      }
    }
    return;
  }

  
  if (held === FEATHER || held === DUMBBELL || held === WARNING) {
    heldT = BONUS_TICKS_MS;
    if (held === WARNING) freezeT = BONUS_TICKS_MS;
  }
}


function updateSlides(dt) {
  const step = TILE * (dt / slideDur);
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (grid[c][r] === EMPTY) { offX[c][r] = 0; shovedCell[c][r] = false; continue; }
      const v = offX[c][r];
      if (v === 0) continue;
      const nv = v > 0 ? Math.max(0, v - step) : Math.min(0, v + step);
      offX[c][r] = nv;
      if (nv === 0) { settleColumn(c); checkClears(); }
    }
  }
}

function updateBonus(dt) {
  if (heldT > 0) {
    heldT -= dt;
    if (heldT <= 0) { heldT = 0; held = 0; }
  }
  if (freezeT > 0) freezeT -= dt;
}

function workerSupported() {
  if (worker.row === 0) return true;
  const v = grid[worker.col][worker.row - 1];
  
  
  
  return standable(v) || isBoom(v);
}

function gameOver() {
  state = 'gameover';
  playSound(score > best ? 'record' : 'hurt');
  saveBest(score);
}




function respawnWorker(atCol, atRow) {
  let col, row;
  if (atCol !== undefined && atRow + 1 < ROWS && grid[atCol][atRow + 1] === EMPTY) {
    col = atCol;
    row = atRow + 1;
  } else {
    col = 0;
    for (let k = 0; k < COLS; k++) if (walkHeight(k) < walkHeight(col)) col = k;
    row = walkHeight(col);
  }
  worker.col = col;
  worker.row = row;
  worker.x = col * TILE;
  worker.y = rowTopY(row);
  worker.tween = null;
  worker.pendingDir = 0;
}



function loseLife(atCol, atRow) {
  lives--;
  playSound('hurt');
  hurtFlash = 420;
  shakeT = 260;
  dying = DEATH_MS;
  deathAt = { col: atCol, row: atRow };
  worker.tween = null;
  worker.pendingDir = 0;
  queue.length = 0;
}

function updateWorker(dt) {
  if (dying > 0 || awaitingRespawn) {   
    if (dying > 0) dying -= dt;
    if (dying <= 0) {
      
      
      const col = deathAt && deathAt.col;
      if (falling.some(f => f.col === col)) {
        
        
        
        awaitingRespawn = true;
        dying = 0;
        return;
      }
      awaitingRespawn = false;
      dying = 0;
      if (lives <= 0) gameOver();
      else respawnWorker(col, deathAt && deathAt.row);
    }
    return;
  }
  const tw = worker.tween;
  if (tw) {
    tw.t += dt;
    const p = Math.min(1, tw.t / tw.dur);
    const e = easeAt(tw, p);
    worker.x = tw.fromX + (tw.toX - tw.fromX) * e;
    worker.y = tw.fromY + (tw.toY - tw.fromY) * e - tw.arc * Math.sin(p * Math.PI);

    
    if (tw.rise) {
      const q = queue[0];
      if (q === 'left' || q === 'right') {
        queue.shift();
        worker.pendingDir = q === 'left' ? -1 : 1;
      }
    }
    if (p >= 1) {
      worker.col = tw.toCol; worker.row = tw.toRow;
      worker.x = tw.toX; worker.y = tw.toY;
      worker.tween = null;
      if (tw.next) {                      
        const n = tw.next;
        
        
        
        
        const fresh = planMove(n.dir, n.row);
        if (!fresh) return;               
        applyMove(fresh, n.dir, n.dur);
        startTween(fresh.toCol, n.row, n.dur, 0);
        
        
        
        
        
        worker.air = false;
        worker.tween.pushing =
          fresh.moves.length > 0 || (fresh.slides || []).length > 0;
        return;
      }
      
      
      
      
    } else {
      return;
    }
  }

  
  
  if (worker.pendingDir) {
    const d = worker.pendingDir;
    worker.pendingDir = 0;
    tryStep(d);
    
    if (worker.tween) { worker.air = false; return; }
  }
  collectHere();
  if (!workerSupported()) {
    const toRow = walkHeight(worker.col);
    const dist = worker.row - toRow;
    if (dist > 1) playSound('land');
    worker.air = true;
    startTween(worker.col, toRow, CRATE_FALL_MS * dist, 0);
    return;
  }
  worker.air = false;                  
  const next = queue.shift();
  if (next === 'use') useBonus();
  else if (next === 'jump') tryJump(0);
  else if (next === 'jumpL') tryJump(-1);
  else if (next === 'jumpR') tryJump(1);
  
  else if (next === 'left' || keys.left) tryStep(-1);
  else if (next === 'right' || keys.right) tryStep(1);
}







function retargetFalling(c) {
  const list = falling
    .filter(f => f.col === c && f.fromCol == null)   
    .sort((a, b) => fallRow(a) - fallRow(b));
  let dest = colHeight(c);
  for (const f of list) {
    if (f.toRow !== dest) {
      const cur = fallRow(f);
      f.row = cur;
      f.toRow = Math.min(Math.floor(cur), dest);
      f.t = 0;
    }
    dest = Math.max(dest, f.toRow) + 1;
  }
}

function settleColumn(c) {
  
  
  let dest = 0;
  for (let r = 0; r < ROWS; r++) {
    const v = grid[c][r];
    if (isBoom(v)) { dest = r + 1; continue; }   
    if (!isSolid(v)) continue;
    
    
    if (offX[c][r] !== 0) { dest = r + 1; continue; }
    if (r !== dest) {
      
      
      falling.push({ col: c, row: r, toRow: dest, color: v, t: 0,
                     shoved: shovedCell[c][r] });
      grid[c][r] = EMPTY;
      shovedCell[c][r] = false;
    }
    dest++;
  }
  retargetFalling(c);
}

function settleAll() {
  for (let c = 0; c < COLS; c++) settleColumn(c);
}

function updateFalling(dt) {
  for (let i = falling.length - 1; i >= 0; i--) {
    const f = falling[i];
    if (f.offX) {                        
      const step = TILE * (dt / slideDur);
      f.offX = f.offX > 0 ? Math.max(0, f.offX - step) : Math.min(0, f.offX + step);
      if (f.offX === 0 && f.fromCol != null) {   
        f.row = fallRow(f);
        f.toRow = Math.min(Math.floor(f.row), colHeight(f.col));
        f.t = 0;
        f.fromCol = null;
      }
    }
    f.t += dt;
    const dist = f.row - f.toRow;
    if (f.t >= CRATE_FALL_MS * dist && f.offX) {
      f.t = CRATE_FALL_MS * dist;      
      continue;
    }
    if (f.t >= CRATE_FALL_MS * dist) {
      falling.splice(i, 1);
      let target = f.toRow;
      while (target < ROWS - 1 && grid[f.col][target] !== EMPTY) target++;
      if (grid[f.col][target] !== EMPTY) continue;
      const onHead = worker.col === f.col && worker.row === target;
      
      
      if (onHead && collectible(f.color)) { pickUp(f.color); continue; }
      grid[f.col][target] = f.color;
      
      offX[f.col][target] = f.offX || 0;
      shovedCell[f.col][target] = false;
      if (onHead && dying <= 0 && !awaitingRespawn) {
        loseLife(f.col, target);
        if (state === 'gameover') return;
      }
      
      
      
      
      if (target >= ROWS - 1 && dying <= 0) { gameOver(); return; }
      retargetFalling(f.col);
      checkClears();
    }
  }
}




function isSettled(c, r) {
  if (!isCrate(grid[c][r])) return false;
  if (offX[c][r] !== 0) return false;            
  if (falling.some(f => f.col === c)) return false;
  return r === 0 || grid[c][r - 1] !== EMPTY;
}

function checkClears() {
  let any = false;

  
  
  let full = true;
  for (let c = 0; c < COLS; c++)
    if (!isSolid(grid[c][0]) || offX[c][0] !== 0) { full = false; break; }
  if (full) {
    for (let c = 0; c < COLS; c++) explode(c, 0);
    addScore(10 * scoreMul());
    cleared += COLS;
    any = true;
  }

  
  const seen = Array.from({ length: COLS }, () => new Array(ROWS).fill(false));
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (seen[c][r] || !isSettled(c, r)) continue;
      const color = grid[c][r];
      const group = [];
      const stack = [[c, r]];
      seen[c][r] = true;
      while (stack.length) {
        const [cc, rr] = stack.pop();
        group.push([cc, rr]);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = cc + dc, nr = rr + dr;
          if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
          if (seen[nc][nr] || grid[nc][nr] !== color || !isSettled(nc, nr)) continue;
          seen[nc][nr] = true;
          stack.push([nc, nr]);
        }
      }
      if (group.length >= MATCH_MIN) {
        for (const [gc, gr] of group) explode(gc, gr);
        const n = group.length;
        addScore((n - 1) * (n - 1) * scoreMul());
        cleared += n;
        any = true;
      }
    }
  }

  if (any) {
    playSound('clear');
    chain++;
    level = 1 + Math.floor(cleared / 24);
    shakeT = Math.max(shakeT, 120);
  }
}

function explode(c, r) {
  grid[c][r] = BOOM0;
  boomTimer[c][r] = BOOM_MS;
}

function updateBooms(dt) {
  let finished = false;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (!isBoom(grid[c][r])) continue;
      boomTimer[c][r] -= dt;
      if (boomTimer[c][r] > 0) continue;
      grid[c][r]++;
      boomTimer[c][r] = BOOM_MS;
      if (grid[c][r] >= BOOM0 + BOOM_FRAMES) { grid[c][r] = EMPTY; finished = true; }
    }
  }
  if (finished) { settleAll(); checkClears(); }
  if (falling.length === 0 && !gridHasBooms()) chain = 0;
}

function gridHasBooms() {
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) if (isBoom(grid[c][r])) return true;
  return false;
}


function pickTargetCol() {
  const taken = cranes.filter(cr => cr.cargo).map(cr => cr.targetCol);
  const open = [];
  for (let c = 0; c < COLS; c++) {
    if (colHeight(c) < ROWS - 1 && !taken.includes(c)) open.push(c);
  }
  if (open.length === 0) return -1;
  return open[rnd(open.length)];
}


function fieldIsFull() {
  for (let c = 0; c < COLS; c++) if (colHeight(c) < ROWS - 1) return false;
  return true;
}




function pickCargo() {
  if (Math.random() > 0.14) return CRATE0 + rnd(COLORS);
  if (Math.random() < 0.12) return DARK;
  const pool = [BALL0, BALL0 + 1, BALL0 + 2, BALL0 + 3, BALL_BLACK,
                HAMMER, MAGNET, WARNING, HEART];
  if (hero.bonus) pool.push(hero.bonus);
  return pool[rnd(pool.length)];
}

function updateCranes(dt) {
  
  if (freezeT > 0) return;

  craneTimer -= dt;
  if (craneTimer <= 0) {
    craneTimer = craneCooldown();
    if (cranes.length < maxCranes()) {
      const col = pickTargetCol();
      if (col >= 0) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        cranes.push({
          dir,
          x: dir === 1 ? -TILE * 2 : FIELD_W,
          targetCol: col,
          cargo: pickCargo(),
        });
      } else if (fieldIsFull()) {
        gameOver();
        return;
      }
    }
  }

  for (let i = cranes.length - 1; i >= 0; i--) {
    const cr = cranes[i];
    const prev = cr.x;
    cr.x += cr.dir * craneSpeed() * (dt / 1000);

    
    if (cr.cargo) {
      const tx = cr.targetCol * TILE;
      const passed = cr.dir === 1 ? (prev < tx && cr.x >= tx)
                                  : (prev > tx && cr.x <= tx);
      if (passed) {
        falling.push({
          col: cr.targetCol, row: ROWS - 1,
          toRow: colHeight(cr.targetCol)
                 + falling.filter(f => f.col === cr.targetCol).length,
          color: cr.cargo, t: 0,
        });
        cr.cargo = 0;
      }
    }

    if (cr.x < -TILE * 2 || cr.x > FIELD_W) cranes.splice(i, 1);
  }
}


function drawCrate(x, y, value) {
  const im = sprite(TILE_SPRITES[value - CRATE0]);
  if (im) { ctx.drawImage(im, x, y, TILE, TILE); return; }
  
  ctx.fillStyle = isBoom(value) ? '#f2c14e' : (CRATE_COLORS[(value - CRATE0) % 4] || {}).base || '#888';
  ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
}


function drawBonus(x, y, value, size) {
  const im = sprite(TILE_SPRITES[value - CRATE0]);
  if (im) ctx.drawImage(im, x, y, size, size);
}





const ANIM_FRAME_MS = TICK_MS * 2;
let walkClock = 0;      
let animState = '';     
let animFrom = 0;       




function animFrame(state, seq) {
  if (state !== animState) { animState = state; animFrom = walkClock; }
  return seq[Math.floor((walkClock - animFrom) / ANIM_FRAME_MS) % seq.length];
}

function workerFrame() {
  if (dying > 0) {
    animState = 'death';
    const seq = WORKER_FRAMES.death;
    const i = Math.floor((DEATH_MS - dying) / DEATH_FRAME_MS);
    return seq[Math.max(0, Math.min(seq.length - 1, i))];
  }
  
  
  
  if (worker.air) { animState = 'air'; return WORKER_FRAMES.jump; }
  const tw = worker.tween;
  if (tw) {
    return tw.pushing
      ? animFrame('push', WORKER_FRAMES.push)
      : animFrame('walk', WORKER_FRAMES.walk);
  }
  return animFrame('idle', WORKER_FRAMES.idle);
}

function drawWorker() {
  const frame = String(workerFrame()).padStart(2, '0');
  const im = sprite(`worker_${hero.key}_${frame}`);
  const x = worker.x;
  const y = worker.y - TILE;            
  if (!im) {
    ctx.fillStyle = hero.suit;
    ctx.fillRect(x + 10, y + 20, TILE - 20, TILE * 2 - 30);
    return;
  }
  ctx.save();
  if (worker.facing < 0) {              
    ctx.translate(x + TILE, y);
    ctx.scale(-1, 1);
    ctx.drawImage(im, 0, 0, TILE, TILE * 2);
  } else {
    ctx.drawImage(im, x, y, TILE, TILE * 2);
  }
  ctx.restore();
}


function drawCranes() {
  
  for (const cr of cranes) {
    const im = sprite(cr.cargo ? 'crane0' : 'crane1') || sprite('crane0');
    if (im) ctx.drawImage(im, cr.x - TILE / 2, 0, TILE * 2, TILE * 2);
    
    if (cr.cargo !== 0) drawCrate(cr.x, FIELD_TOP, cr.cargo);
  }
  const rail = sprite('rail');
  if (rail) ctx.drawImage(rail, -FIELD_X, 0, W, RAIL_H);
  else { ctx.fillStyle = '#3a3f4b'; ctx.fillRect(0, RAIL_H - 14, FIELD_W, 10); }
}

function drawScreen(name) {
  const im = sprite(name);
  if (im) { ctx.drawImage(im, 0, 0, W, H); return false; }
  ctx.fillStyle = '#1c2030';
  ctx.fillRect(0, 0, W, H);
  return true;                       
}


const MENU_BUTTONS = [
  { x: 10, y: 680, w: 450, h: 110 },    
  { x: 550, y: 680, w: 450, h: 110 },   
];

function drawMenu() {
  const plain = drawScreen('menu');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (plain) {
    ctx.fillStyle = '#f2c14e';
    ctx.font = 'bold 56px monospace';
    ctx.fillText('STACK ATTACK', W / 2, H / 2);
    ctx.font = 'bold 30px monospace';
    ctx.fillText(menuIdx === 0 ? 'НАЧАТЬ' : 'НАСТРОЙКИ', W / 2, H - 90);
  }
  
  const b = MENU_BUTTONS[menuIdx];
  ctx.strokeStyle = '#f2c14e';
  ctx.lineWidth = 6;
  ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
  
  
  ctx.fillStyle = plain ? '#cfd3dc' : '#f2f0d8';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('рекорд ' + best, W - 20, 28);
}

function drawOptions() {
  ctx.fillStyle = '#1c2030';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#2b3350';
  ctx.fillRect(0, 40, W, 80);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2f0d8';
  ctx.font = 'bold 44px monospace';
  ctx.fillText('НАСТРОЙКИ', W / 2, 80);

  OPTIONS.forEach((o, i) => {
    const y = 230 + i * 110;
    const on = i === optIdx;
    if (on) {
      ctx.fillStyle = 'rgba(242,193,78,0.14)';
      ctx.fillRect(60, y - 42, W - 120, 84);
      ctx.strokeStyle = '#f2c14e';
      ctx.lineWidth = 4;
      ctx.strokeRect(60, y - 42, W - 120, 84);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = on ? '#f2c14e' : '#9aa2b1';
    ctx.font = 'bold 32px monospace';
    ctx.fillText(o.title, 100, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = on ? '#f2f0d8' : '#cfd3dc';
    const v = o.names[o.vals.indexOf(optValue(o.key))];
    ctx.fillText(on ? `\u25c0 ${v} \u25b6` : v, W - 100, y);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#7b8291';
  ctx.font = '24px monospace';
  ctx.fillText('\u2191\u2193 — пункт   \u2190\u2192 — значение   Enter или Esc — назад',
    W / 2, H - 60);
}

function drawSelect() {
  const ch = CHARACTERS[charIdx];
  const open = unlocked(charIdx);
  const plain = drawScreen('char' + (charIdx + 1));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (plain) {
    ctx.fillStyle = open ? ch.suit : '#6b7280';
    ctx.font = 'bold 44px monospace';
    ctx.fillText(ch.name, W / 2, H / 2);
  }

  if (!open) {                       
    ctx.fillStyle = 'rgba(16,18,24,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(W / 2 - 34, H / 2 - 20, 68, 54);
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2 - 20, 24, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#f2c14e';
    ctx.font = 'bold 34px monospace';
    ctx.fillText('нужен рекорд ' + ch.unlock, W / 2, H / 2 + 120);
    ctx.fillStyle = '#cfd3dc';
    ctx.font = '26px monospace';
    ctx.fillText('осталось набрать ' + (ch.unlock - best), W / 2, H / 2 + 165);
  }

  
  if (plain && open) {
    ctx.fillStyle = '#cfd3dc';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('← → — выбрать · Enter — начать', W / 2, H - 22);
  }
}



const KEYCAPS = [
  ['Q', 'прыжок\nвлево', 0, 0], ['W', 'прыжок', 1, 0], ['E', 'прыжок\nвправо', 2, 0],
  ['A', 'шаг влево', 0, 1], ['S', 'бонус', 1, 1], ['D', 'шаг вправо', 2, 1],
];

function drawControls() {
  ctx.fillStyle = '#1c2030';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#2b3350';
  ctx.fillRect(0, 24, W, 34);
  ctx.fillStyle = '#f2f0d8';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('УПРАВЛЕНИЕ', W / 2, 42);

  const cap = 74, gap = 12;
  const gw = cap * 3 + gap * 2;
  const x0 = (W - gw) / 2, y0 = 96;
  for (const [key, label, cx, cy] of KEYCAPS) {
    const x = x0 + cx * (cap + gap), y = y0 + cy * (cap + gap);
    ctx.fillStyle = '#2b3040';
    ctx.fillRect(x, y, cap, cap);
    ctx.fillStyle = '#454b5c';
    ctx.fillRect(x, y, cap, 5);
    ctx.fillStyle = '#f2c14e';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(key, x + cap / 2, y + 26);
    ctx.fillStyle = '#9aa2b1';
    ctx.font = '11px monospace';
    label.split('\n').forEach((line, i) => {
      ctx.fillText(line, x + cap / 2, y + 48 + i * 13);
    });
  }

  ctx.fillStyle = '#cfd3dc';
  ctx.font = '15px monospace';
  ctx.fillText('стрелки тоже работают · P или Esc — пауза', W / 2, y0 + cap * 2 + gap + 34);
  ctx.fillStyle = '#7b8291';
  ctx.font = '14px monospace';
  ctx.fillText('Enter — в игру', W / 2, H - 26);
}



const HOURGLASS_FRAMES = 7;
const HOURGLASS_MS = 150;

function hourglassFrame() {
  return Math.floor(pauseClock / HOURGLASS_MS) % HOURGLASS_FRAMES;
}

function drawPause() {
  ctx.fillStyle = 'rgba(18,20,26,0.82)';
  ctx.fillRect(0, 0, W, H);

  const size = TILE * 2;                       
  const im = sprite('hourglass' + hourglassFrame());
  if (im) ctx.drawImage(im, (W - size) / 2, H / 2 - size - 20, size, size);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2c14e';
  ctx.font = 'bold 44px monospace';
  ctx.fillText('ПАУЗА', W / 2, H / 2 + 40);
  ctx.fillStyle = '#cfd3dc';
  ctx.font = '24px monospace';
  ctx.fillText('P или Esc — продолжить', W / 2, H / 2 + 90);
  ctx.fillStyle = '#8d94a4';
  ctx.font = '20px monospace';
  ctx.fillText('O или Enter — настройки', W / 2, H / 2 + 124);
}

function draw() {
  if (state === 'loading') {
    ctx.fillStyle = '#161922';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f2c14e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 30px monospace';
    const p = assetsTotal ? 1 - assetsLeft / assetsTotal : 1;
    ctx.fillText('загрузка ' + Math.round(p * 100) + '%', W / 2, H / 2);
    return;
  }
  if (state === 'menu') { drawMenu(); return; }
  if (state === 'options') { drawOptions(); return; }
  if (state === 'select') { drawSelect(); return; }
  if (state === 'controls') { drawControls(); return; }
  ctx.save();
  if (shakeT > 0) {
    const m = (shakeT / 260) * 3;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  ctx.fillStyle = '#161922';
  ctx.fillRect(0, 0, W, H);

  
  ctx.save();
  ctx.translate(FIELD_X, 0);

  
  const bg = sprite('background');
  if (bg) {
    for (let x = 0; x < FIELD_W; x += bg.width) {
      ctx.drawImage(bg, x, FIELD_BOTTOM - bg.height);
    }
  } else {
    ctx.fillStyle = '#1c2030';
    ctx.fillRect(0, 0, FIELD_W, FIELD_BOTTOM);
  }


  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++)
      if (grid[c][r] !== EMPTY && grid[c][r] !== WORKER)
        drawCrate(c * TILE + offX[c][r], rowTopY(r), grid[c][r]);

  for (const f of falling) {
    const dist = f.row - f.toRow;
    const p = Math.min(1, f.t / (CRATE_FALL_MS * dist || 1));
    const r = f.row - dist * p;
    drawCrate(f.col * TILE + (f.offX || 0), rowTopY(r), f.color);
  }

  drawCranes();
  
  
  
  
  if (!awaitingRespawn && (lives > 0 || dying > 0)) drawWorker();
  ctx.restore();

  
  const railL = sprite('ui_a');
  const railR = sprite('ui_c');
  const floor = sprite('ui_b');
  ctx.fillStyle = '#31353f';
  ctx.fillRect(0, FIELD_BOTTOM, W, H - FIELD_BOTTOM);
  if (railL) {
    for (let y = FIELD_TOP; y < FIELD_BOTTOM; y += railL.height) ctx.drawImage(railL, 0, y);
  }
  if (railR) {
    for (let y = FIELD_TOP; y < FIELD_BOTTOM; y += railR.height) {
      ctx.drawImage(railR, W - railR.width, y);
    }
  }
  if (floor) {
    for (let x = 0; x < W; x += floor.width) ctx.drawImage(floor, x, FIELD_BOTTOM);
  } else {
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(0, FIELD_BOTTOM, W, 3);
  }
  
  
  
  
  const heart = sprite('heart');
  for (let i = 0; i < lives; i++) {
    if (heart) ctx.drawImage(heart, 18 + i * 56, 2, TILE, TILE);
  }
  if (held) {
    drawBonus(920, 0, held, TILE);          
    if (heldT > 0) {
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(920, TILE - 8, TILE * (heldT / BONUS_TICKS_MS), 8);
    }
  }
  if (freezeT > 0) {
    ctx.fillStyle = '#7ab5e6';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('КРАНЫ СТОЯТ', W / 2, RAIL_H + 40);
  }

  ctx.fillStyle = '#f2f0d8';
  ctx.font = 'bold 34px monospace';
  ctx.textBaseline = 'middle';
  const hy = FIELD_BOTTOM + HUD_H / 2;
  ctx.textAlign = 'left';
  ctx.fillText('ОЧКИ ' + String(score).padStart(5, '0'), 20, hy);
  ctx.textAlign = 'right';
  ctx.fillText("УРОВЕНЬ " + level, W - 40, hy);


  if (hurtFlash > 0) {
    ctx.fillStyle = `rgba(217,72,74,${0.32 * (hurtFlash / 420)})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  if (state === 'paused') drawPause();

  if (state === 'gameover') {
    ctx.fillStyle = 'rgba(18,20,26,0.85)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f2c14e';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ИГРА ОКОНЧЕНА', W / 2, H / 2 - 26);
    ctx.fillStyle = '#cfd3dc';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('очки: ' + score, W / 2, H / 2 + 10);
    ctx.font = '15px monospace';
    ctx.fillStyle = score >= best && score > 0 ? '#f2c14e' : '#7b8291';
    ctx.fillText(score >= best && score > 0 ? 'новый рекорд!' : 'рекорд: ' + best,
                 W / 2, H / 2 + 38);
    ctx.fillStyle = '#7b8291';
    ctx.fillText('Enter — сыграть ещё раз', W / 2, H / 2 + 66);
  }
}


let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;
  if (state === 'playing') {
    updateCranes(dt);
    updateFalling(dt);
    updateBooms(dt);
    updateSlides(dt);
    updateBonus(dt);
    checkAirborneHits();
    updateWorker(dt);
  }
  walkClock += dt;
  if (state === 'paused') pauseClock += dt;
  if (hurtFlash > 0) hurtFlash -= dt;
  if (shakeT > 0) shakeT -= dt;
  updateMusic();
  draw();
  requestAnimationFrame(frame);
}

init();
state = 'loading';
loadOptions();
loadSounds();
loadAssets(() => { state = 'menu'; applyGfxMode(); });
requestAnimationFrame(frame);
