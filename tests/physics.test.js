'use strict';
// Физика поля, столкновения и модель ввода — накопленное ручным тестированием.
const { makeGame, suite } = require('./harness');
const t = suite('физика и ввод');
const WORKER_WALK = [7, 8, 9];
const WORKER_PUSH = [1, 2, 3];

// --- шаг и падение ---
let g = makeGame({ setup: `
  grid[4][0]=2; grid[4][1]=3;
  worker.col=3; worker.row=0; worker.tween=null;
  queue.length=0; queue.push('right');
` }).frames(60);
t.check('шаг в непреодолимый столб не поднимает наверх', [g.snap().col, g.snap().row], [3, 0]);

g = makeGame({ setup: `
  for (let r = 0; r < 3; r++) grid[4][r] = 2;
  worker.col=4; worker.row=3; worker.tween=null; worker.y = rowTopY(3);
  for (let r = 0; r < 3; r++) grid[4][r] = EMPTY;
  settleColumn(4);
` }).frames(1);
t.check('грузчик падает со скоростью ящиков', g.snap().dur, g.get('CRATE_FALL_MS') * 3);

g = makeGame({ setup: `
  grid[4][2]=2; grid[4][1]=3;
  worker.col=8; worker.row=0; worker.tween=null;
  grid[4][0]=EMPTY; settleColumn(4);
` });
t.check('у каждого падающего своя цель',
  g.get('falling.map(f => ({row: f.row, to: f.toRow})).sort((a,b) => a.row - b.row)'),
  [{ row: 1, to: 0 }, { row: 2, to: 1 }]);

// --- жизни и возрождение ---
t.check('партия начинается с одной жизни', makeGame().get('lives'), 1);

g = makeGame({ setup: `
  lives = 2; worker.col=7; worker.row=0; worker.tween=null;
  falling.push({ col: 7, row: 5, toRow: 0, color: 2, t: 0 });
` }).settle().frames(120);
t.check('возрождение над убившим блоком', [g.snap().col, g.snap().row], [7, 1]);
t.check('  жизнь снялась', g.snap().lives, 1);

// --- бонусы в воздухе и на голове ---
g = makeGame({ setup: `
  lives = 1; worker.col=3; worker.row=0; worker.tween=null;
  falling.push({ col: 3, row: 5, toRow: 0, color: 12, t: 0 });
` }).settle().frames(120);
t.check('бонус в пустой слот, жизнь цела', [g.snap().held, g.snap().lives], [12, 1]);

g = makeGame({ setup: `
  lives = 2; held = 13; worker.col=3; worker.row=0; worker.tween=null;
  falling.push({ col: 3, row: 5, toRow: 0, color: 12, t: 0 });
` }).settle().frames(120);
t.check('при занятом слоте бонус бьёт по голове', g.snap().lives, 1);

// --- удар каской ---
g = makeGame({ setup: `
  grid[3][2]=2; worker.col=3; worker.row=0; worker.tween=null;
  queue.length=0; queue.push('jump');
` }).frames(4);
t.check('каска разбила лежащий блок над головой', g.col(3)[2] >= 18, true);

g = makeGame({ setup: `
  grid[3][2]=6; worker.col=3; worker.row=0; worker.tween=null;
  queue.length=0; queue.push('jump');
` }).frames(4);
t.check('тёмный блок каской не берётся', g.col(3)[2], 6);

// поле чистим и краны морозим: стартовая раскладка иногда закрывала подъём,
// и проверка плавала от прогона к прогону
g = makeGame({ setup: `
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) grid[c][r] = EMPTY;
  craneTimer = 1e9;
  worker.col=3; worker.row=0; worker.tween=null; worker.x = 3 * TILE; worker.y = rowTopY(0);
  falling.push({ col: 3, row: 3, toRow: 0, color: 2, t: 0 });
  queue.length=0; queue.push('jump');
` }).frames(30);                                // падение клетки — 400 мс
t.check('каска разбила падающий блок', g.snap().falling.length, 0);

g = makeGame({ setup: `
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) grid[c][r] = EMPTY;
  craneTimer = 1e9;
  worker.col=3; worker.row=0; worker.tween=null; worker.x = 3 * TILE; worker.y = rowTopY(0);
  falling.push({ col: 3, row: 3, toRow: 0, color: 6, t: 0 });
  queue.length=0; queue.push('jump');
` }).frames(30);
t.check('тёмный падающий блок уцелел', g.snap().falling.length, 1);

g = makeGame({ setup: `
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) grid[c][r] = EMPTY;
  craneTimer = 1e9;
  worker.col=3; worker.row=0; worker.tween=null; worker.x = 3 * TILE; worker.y = rowTopY(0);
  falling.push({ col: 3, row: 3, toRow: 0, color: 12, t: 0 });
  queue.length=0; queue.push('jump');
` }).frames(30);
t.check('бонус пойман в воздухе', [g.snap().held, g.snap().falling.length], [12, 0]);

// --- бонус как поверхность ---
for (const [char, who] of [[0, 'красный'], [2, 'зелёный']]) {
  const s = makeGame({ char, setup: `
    grid[2][0]=2; grid[2][1]=12;
    worker.col=3; worker.row=0; worker.tween=null;
    queue.length=0; queue.push('jumpL');
  ` }).settle();
  t.check(`${who}: бонус на вершине стопки подобран прыжком`,
    [s.snap().held, s.col(2).slice(0, 2)], [12, [2, 0]]);
}

g = makeGame({ char: 2, setup: `
  grid[2][0]=2; grid[2][1]=12; held = 13;
  worker.col=3; worker.row=0; worker.tween=null;
  queue.length=0; queue.push('jumpL');
` }).settle();
t.check('при занятом слоте на бонус встают', [g.snap().col, g.snap().row], [2, 2]);

g = makeGame({ setup: `
  lives = 1; held = 13; grid[2][0]=2; grid[2][1]=17;
  worker.col=3; worker.row=0; worker.tween=null;
  queue.length=0; queue.push('jumpL');
` }).settle();
t.check('сердце подбирается и при занятом слоте', [g.snap().lives, g.col(2).slice(0, 2)], [2, [2, 0]]);

g = makeGame({ char: 2, setup: `
  lives = 3; held = 13; grid[2][0]=2; grid[2][1]=17;
  worker.col=3; worker.row=0; worker.tween=null;
  queue.length=0; queue.push('jumpL');
` }).settle();
t.check('при полных жизнях сердце — поверхность', [g.snap().lives, g.col(2)[1]], [3, 17]);

// --- сдвиг блоков ---
g = makeGame({ setup: `
  grid[3][0]=3; grid[4][0]=5; grid[4][1]=2;
  worker.col=3; worker.row=1; worker.tween=null;
  queue.length=0; queue.push('right');
` }).frames(3);
t.check('сдвинутый ящик едет вбок и пока не падает',
  [g.col(5)[1], g.snap().falling.length], [2, 0]);
g.settle();
t.check('доехав, ящик упал на пол', [g.col(5)[0], g.col(5)[1]], [2, 0]);

g = makeGame({ setup: `
  grid[5][0]=2; offX[5][0] = -40;
  worker.col=4; worker.row=0; worker.tween=null;
` });
t.check('едущий вбок ящик повторно не толкается', g.get('planMove(1, 0)'), null);

g = makeGame({ setup: `
  grid[4][2]=2; shovedCell[4][2] = true;
  worker.col=8; worker.row=0; worker.tween=null;
  settleColumn(4);
` });
t.check('метка толчка переезжает в полёт', g.get('falling.map(f => !!f.shoved)'), [true]);

g = makeGame({ setup: `
  worker.col=3; worker.row=0; worker.tween=null;
  falling.push({ col: 4, row: 1.5, toRow: 0, color: 2, t: 0 });
  const p = planMove(1, 0); applyMove(p, 1, 400);
` });
t.check('снос падающего блока помечает его', g.snap().falling, [{ col: 5, shoved: true, offX: -80 }]);

g = makeGame({ setup: `
  worker.col=4; worker.row=0; worker.tween=null;
  falling.push({ col: 5, row: 1.5, toRow: 0, color: 2, t: 0, shoved: true });
` });
t.check('снесённый падающий блок повторно не двигается', g.get('planMove(1, 0)'), null);

g = makeGame({ setup: `
  worker.col=3; worker.row=0; worker.tween=null;
  falling.push({ col: 4, row: 1.5, toRow: 0, color: 12, t: 0 });
  const p = planMove(1, 0);
  globalThis.__p = { catches: p.catches.length, slides: p.slides.length };
  applyMove(p, 1, 400);
` });
t.check('летящий бонус пойман, а не снесён', g.get('__p'), { catches: 1, slides: 0 });
t.check('  бонус в слоте, полёт пуст', [g.snap().held, g.snap().falling.length], [12, 0]);

// --- применение бонуса мимо очереди ---
g = makeGame({ setup: `
  grid[2][0]=2; grid[2][1]=3;
  worker.col=3; worker.row=0; worker.facing=-1; worker.tween=null;
  held = 13; queue.length=0; queue.push('jump');
` }).frames(12);
g.run(`action('use');`);
t.check('магнит сработал в середине прыжка', g.snap().held, 0);
t.check('магнит вытянул верхний блок стопки', g.col(2).slice(0, 2), [2, 0]);

g = makeGame({ setup: `
  worker.col=3; worker.row=0; worker.tween=null; held = 12;
  queue.length=0; action('use');
` });
t.check('нажатие бонуса не попадает в очередь', g.snap().queue, []);

// --- модель ввода ---
g = makeGame({ setup: `
  worker.col=6; worker.row=0; worker.tween=null;
  queue.length=0; keys.right = true; action('right'); keys.right = false;
` }).frames(40);
t.check('одно нажатие — один шаг', g.snap().col, 7);

g = makeGame({ setup: `
  worker.col=4; worker.row=0; worker.tween=null; queue.length=0;
  for (let i = 0; i < 3; i++) { keys.right = true; action('right'); keys.right = false; }
` }).frames(100);
t.check('три нажатия — три шага', g.snap().col, 7);

g = makeGame({ setup: `
  worker.col=2; worker.row=0; worker.tween=null;
  queue.length=0; keys.right = true; action('right');
` }).frames(55);
t.check('зажатие не набивает очередь', g.snap().queue, []);
const held = g.snap().col;
g.run('keys.right = false;');
g.frames(60);
t.check('после отпускания добавился максимум один шаг', g.snap().col - held <= 1, true);

g = makeGame({ setup: `
  worker.col=1; worker.row=0; worker.tween=null;
  queue.length=0; keys.right = true; action('right');
` }).frames(80);
t.check('удержание идёт непрерывно', g.snap().col >= 3, true);

g = makeGame({ setup: `
  worker.col=6; worker.row=0; worker.tween=null;
  queue.length=0; keys.right = true; action('right');
` }).frames(10);
g.run(`action('left');`);
g.frames(20);
t.check('нажатие вбок перебивает зажатую клавишу', g.snap().goingTo, 6);

g = makeGame({ setup: `
  worker.col=5; worker.row=0; worker.tween=null;
  queue.length=0; action('left'); action('jumpL'); action('right');
` });
t.check('противоположные команды вычищаются', g.snap().queue, ['right']);

// Автоповтор браузера шлёт keydown снова и снова без keyup — в очередь
// должно попасть ровно одно действие.
g = makeGame({ setup: `worker.col=5; worker.row=0; worker.tween=null; queue.length=0;` });
for (let i = 0; i < 6; i++) g.key('keydown', 'KeyD');
t.check('автоповтор клавиши не копит команды', g.snap().queue.length, 1);
g.key('keyup', 'KeyD').key('keydown', 'KeyD');
t.check('после отпускания новое нажатие считается', g.snap().queue.length, 2);

// --- прыжок с последующим шагом ---
g = makeGame({ setup: `
  worker.col=3; worker.row=0; worker.tween=null;
  queue.length=0; queue.push('jump');
` }).frames(6);
g.run(`action('right');`);
g.frames(4);
t.check('шаг принят прямо на подъёме', g.snap().pendingDir, 1);

g = makeGame({ char: 1, setup: `
  grid[4][0]=2; grid[4][1]=3; grid[4][2]=4;
  worker.col=3; worker.row=0; worker.tween=null;
  queue.length=0; queue.push('jump');
` }).frames(6);
g.run(`action('right');`);
g.settle();
t.check('прыжок + шаг на подъёме = диагональный прыжок',
  [g.col(4).slice(0, 3), g.col(5).slice(0, 3)], [[2, 0, 0], [3, 4, 0]]);

// --- гибель ---
g = makeGame({ setup: `
  lives = 2; worker.col=7; worker.row=0; worker.tween=null;
  falling.push({ col: 7, row: 1, toRow: 0, color: 2, t: 0 });
` }).frames(2);                                 // блок уже в клетке головы — давит сразу
t.check('после удара идёт анимация гибели', g.get('dying') > 0, true);
t.check('первый кадр гибели', g.get('workerFrame()'), 10);
t.check('во время гибели ввод не действует', g.snap().queue, []);
const deathCol = g.snap().col;
g.frames(20);                                   // ~320 мс — уже другой кадр
t.check('кадры гибели сменяются', g.get('workerFrame()') > 10, true);
t.check('грузчик не двигается во время гибели', g.snap().col, deathCol);
g.frames(80);                                   // анимация 1000 мс — закончилась
t.check('после анимации возрождение над блоком', [g.snap().col, g.snap().row], [7, 1]);
t.check('  жизнь снялась', g.snap().lives, 1);

g = makeGame({ setup: `
  lives = 1; worker.col=7; worker.row=0; worker.tween=null;
  falling.push({ col: 7, row: 1, toRow: 0, color: 2, t: 0 });
` }).frames(2);                                 // блок уже в клетке головы — давит сразу
t.check('на последней жизни партия ещё идёт', g.snap().state, 'playing');
g.frames(90);
t.check('после анимации гибели — конец партии', g.snap().state, 'gameover');

// --- выбор кадров ---
g = makeGame({ setup: `worker.col=5; worker.row=0; worker.tween=null;` });
t.check('стоя — кадр анфас', [4, 5, 6].includes(g.get('workerFrame()')), true);
g.run(`grid[6][0]=2; keys.right = true; tryStep(1);`);
t.check('толкая ящик — кадры толчка', WORKER_PUSH.includes(g.get('workerFrame()')), true);
g = makeGame({ setup: `worker.col=5; worker.row=0; worker.tween=null; tryStep(1);` });
t.check('идя без ящика — кадры ходьбы', WORKER_WALK.includes(g.get('workerFrame()')), true);
g = makeGame({ setup: `worker.col=5; worker.row=0; worker.tween=null; tryJump(0);` });
t.check('в прыжке — кадр полёта', g.get('workerFrame()'), 0);

// --- пауза ---
g = makeGame({ setup: `worker.col=3; worker.row=0; worker.tween=null;` });
g.run(`togglePause();`);
t.check('пауза включается', g.snap().state, 'paused');
t.check('часы начинаются с первого кадра', g.get('hourglassFrame()'), 0);
g.frames(12);                                    // ~192 мс
t.check('кадр часов сменился', g.get('hourglassFrame()'), 1);
g.frames(70);                                    // всего ~1.3 с — цикл прошёл
t.check('анимация зациклена', g.get('hourglassFrame()') < 7, true);
g.run(`togglePause();`);
t.check('пауза снимается', g.snap().state, 'playing');
g.run(`togglePause();`);
t.check('счётчик часов сбрасывается при новой паузе', g.get('hourglassFrame()'), 0);

t.done();
