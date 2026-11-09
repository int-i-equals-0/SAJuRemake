'use strict';
// Регрессии по находкам ручного тестирования владельца. Каждая проверка здесь
// соответствует конкретному наблюдённому в игре дефекту, поэтому названия
// сформулированы как «должно быть», а не как «что вызывается».
const { makeGame, suite } = require('./harness');
const t = suite('регрессии ручного теста');

// --- 1. Прыжок: кадр не меняется на протяжении всего полёта ---
for (const [name, act] of [['вверх', 'jump'], ['вбок', 'jumpR'], ['на стопку', 'jumpR']]) {
  const extra = name === 'на стопку' ? 'grid[4][0]=2;' : '';
  const g = makeGame({ setup: `
    ${extra}
    worker.col=3; worker.row=0; worker.tween=null;
    queue.length=0; queue.push('${act}');
  ` });
  g.run('craneTimer=1e9;');
  const seen = new Set();
  for (let i = 0; i < 40; i++) { g.frames(1); if (g.get('worker.air')) seen.add(g.get('workerFrame()')); }
  t.check(`прыжок ${name}: в воздухе один и тот же кадр`, [...seen], [0]);
}

// --- 2. Ходьба и толкание рисуются разными наборами, и оба — видом сбоку ---
let g = makeGame({ setup: `worker.col=5; worker.row=0; worker.tween=null;` });
g.run(`grid[6][0]=2; keys.right = true; tryStep(1);`);
t.check('толкая — кадр из цикла толкания',
  [1, 2, 3].includes(g.get('workerFrame()')), true);
g = makeGame({ setup: `worker.col=5; worker.row=0; worker.tween=null;` });
g.run(`keys.right = true; tryStep(1);`);
t.check('идя налегке — кадр из цикла ходьбы', [7, 8, 9].includes(g.get('workerFrame()')), true);

// --- 3. Прыжок наискось в летящий блок соседней колонки не оставляет внутри него ---
g = makeGame({ setup: `
  worker.col=3; worker.row=0; worker.tween=null; worker.x = 3 * TILE; worker.y = rowTopY(0);
  lives = 2;
  falling.push({ col: 2, row: 2, toRow: 0, color: 2, t: 0 });
  queue.length=0; queue.push('jumpL');
` });
g.run('craneTimer=1e9;');
g.frames(120);
const inside = g.get(`(function () {
  const r = worker.row;
  return isSolid(grid[worker.col][r]) || isSolid(grid[worker.col][r + 1]);
})()`);
t.check('после прыжка в летящий блок грузчик не внутри блока', inside, false);

// --- 4. Каска бьёт только сверху, а не нижней половиной ---
// Блок, успевший опуститься до уровня ног, должен давить, а не разбиваться:
// раньше ломалось любое пересечение с телом, и блок сперва проходил сквозь
// голову, а потом его разбивала нижняя половина грузчика.
g = makeGame({ setup: `
  lives = 2;
  worker.col=3; worker.row=0; worker.tween=null; worker.x = 3 * TILE; worker.y = rowTopY(0);
  falling.push({ col: 3, row: 0.5, toRow: 0, color: 2, t: 0 });
  queue.length=0; queue.push('jump');
` });
g.run('craneTimer=1e9;');
g.frames(3);
t.check('блок на уровне ног давит, а не разбивается каской', g.get('dying > 0'), true);
t.check('  и не превращается во взрыв', g.get('isBoom(grid[3][0]) || isBoom(grid[3][1])'), false);

// --- 5. После очистки ряда грузчик падает не раньше ящиков ---
g = makeGame({ setup: `
  for (let c = 0; c < COLS; c++) grid[c][0] = 2 + (c % 4);
  grid[4][1] = 3;
  worker.col=4; worker.row=2; worker.tween=null; worker.x = 4 * TILE; worker.y = rowTopY(2);
  checkClears();
` });
g.run('craneTimer=1e9;');
t.check('ряд ушёл во взрыв', g.get('isBoom(grid[0][0])'), true);
g.frames(1);
t.check('на догорающей клетке грузчик стоит, а не проваливается',
  g.get('!!worker.tween'), false);

// --- 6. Снесённый вбок блок не режет угол покидаемой стопки ---
g = makeGame({ setup: `
  grid[3][0]=2; grid[4][0]=2; grid[4][1]=2;
  worker.col=3; worker.row=1; worker.tween=null; worker.x = 3 * TILE; worker.y = rowTopY(1);
  falling.push({ col: 4, row: 4, toRow: 2, color: 3, t: 0 });
` });
g.run('craneTimer=1e9;');
g.run(`const p = planMove(1, 1); if (p) applyMove(p, 1, WALK_MS);`);
let below = true;
for (let i = 0; i < 30; i++) {
  g.frames(1);
  const st = g.get(`(function () {
    const f = falling[0];
    if (!f) return null;
    return { off: f.offX || 0, row: fallRow(f), from: f.fromCol };
  })()`);
  if (!st) break;
  // пока идёт снос, блок не должен опуститься ниже верха покидаемой стопки
  if (st.off !== 0 && st.from != null && st.row < 2) below = false;
}
t.check('снос не опускает блок сквозь покидаемую стопку', below, true);

// --- 7. Втолкнутый блок и падающий не занимают одну клетку ---
// Проверяем инвариант на всём протяжении: два летящих в одну колонку блока
// никогда не перекрываются по вертикали, а стопка в итоге складывается ровно.
g = makeGame({ setup: `
  grid[3][0]=2; grid[4][0]=3; grid[4][1]=4;
  worker.col=3; worker.row=1; worker.tween=null; worker.x = 3 * TILE; worker.y = rowTopY(1);
  falling.push({ col: 5, row: 3, toRow: 0, color: 5, t: 0 });
` });
g.run('craneTimer=1e9;');
g.run(`const p = planMove(1, 1); if (p) applyMove(p, 1, WALK_MS);`);
let overlap = false;
for (let i = 0; i < 90; i++) {
  g.frames(1);
  const rows = g.get(`falling.filter(f => f.col === 5 && !f.offX).map(f => fallRow(f))`);
  for (let a = 0; a < rows.length; a++)
    for (let b = a + 1; b < rows.length; b++)
      if (Math.abs(rows[a] - rows[b]) < 0.99) overlap = true;
}
t.check('два блока в одной колонке не наезжают друг на друга', overlap, false);
t.check('  и складываются в ровную стопку', g.col(5).slice(0, 3), [4, 5, 0]);


// --- 8. Гибель проигрывается целиком, а не начинается с расплющенного кадра ---
// Семикадровый лист res12 — это одна анимация: стоит, сплющивается, искры.
// Раньше мы брали из неё только 12..16, и гибель начиналась уже с плоского
// силуэта — со стороны грузчик просто исчезал с холста.
g = makeGame({ setup: `
  lives = 2;
  worker.col=7; worker.row=0; worker.tween=null; worker.x = 7 * TILE; worker.y = rowTopY(0);
  falling.push({ col: 7, row: 0.5, toRow: 0, color: 2, t: 0 });
` });
g.run('craneTimer=1e9;');
const shown = [];
for (let i = 0; i < 90; i++) {
  g.frames(1);
  if (!g.get('dying > 0')) continue;
  const f = g.get('workerFrame()');
  if (shown[shown.length - 1] !== f) shown.push(f);
}
t.check('гибель проходит все семь кадров листа', shown, [10, 11, 12, 13, 14, 15, 16]);

// --- 9. Снос падающего ящика рисуется толканием, а не ходьбой ---
g = makeGame({ setup: `
  worker.col=3; worker.row=0; worker.tween=null; worker.x = 3 * TILE; worker.y = rowTopY(0);
  falling.push({ col: 4, row: 1.5, toRow: 0, color: 2, t: 0 });
  keys.right = true; tryStep(1);
` });
t.check('снося летящий ящик — кадры толчка',
  [1, 2, 3].includes(g.get('workerFrame()')), true);


// --- 10. Прыжки не копятся в буфере ---
// Автоповтор клавиатуры фильтровался только для шагов, поэтому одно удержание
// пробела набивало пять прыжков и после отпускания грузчик скакал сам.
g = makeGame({ setup: `worker.col=5; worker.row=0; worker.tween=null; queue.length=0;` });
g.run('craneTimer=1e9;');
for (let i = 0; i < 12; i++) g.key('keydown', 'Space');
t.check('удержание прыжка даёт один прыжок', g.snap().queue, ['jump']);

g = makeGame({ setup: `worker.col=5; worker.row=0; worker.tween=null; queue.length=0;` });
g.run('craneTimer=1e9;');
for (let i = 0; i < 4; i++) { g.key('keydown', 'Space'); g.key('keyup', 'Space'); g.frames(2); }
t.check('четыре отдельных нажатия прыжка не копятся',
  g.snap().queue.filter(q => q === 'jump').length <= 1, true);

// а шаги копиться должны — так задумано в модели ввода
g = makeGame({ setup: `worker.col=5; worker.row=0; worker.tween=null; queue.length=0;` });
g.run('craneTimer=1e9;');
for (let i = 0; i < 3; i++) { g.key('keydown', 'ArrowLeft'); g.key('keyup', 'ArrowLeft'); }
t.check('шаги по-прежнему копятся', g.snap().queue, ['left', 'left', 'left']);

g = makeGame({ setup: `worker.col=5; worker.row=0; worker.tween=null; queue.length=0;` });
g.run('craneTimer=1e9;');
for (let i = 0; i < 8; i++) g.key('keydown', 'ArrowDown');
t.check('удержание бонуса не сыплет применениями', g.get('keys.use'), true);

// --- 11. Удар каской вычищает накопленные нажатия ---
g = makeGame({ setup: `
  grid[3][2]=2;
  worker.col=3; worker.row=0; worker.tween=null; worker.x = 3 * TILE; worker.y = rowTopY(0);
  queue.length=0; queue.push('left'); queue.push('left');
  headButt();
` });
t.check('после удара каской буфер пуст', g.snap().queue, []);


// --- 12. Вторая фаза прыжка на стопку анимируется как шаг ---
// Прыжок вверх-вбок на более высокую стопку раскладывается на подъём и шаг.
// Подъём — кадр полёта, а шаг вбок должен идти своим циклом: ходьбы, если
// двигать нечего, и толкания, если грузчик что-то везёт перед собой.
// В оригинале это следует из устройства отрисовки: прыжок и шаг — разные
// состояния движения ctx+0x0a, а лист спрайтов выбирается по состоянию.
for (const [name, extra, cycle] of [
  ['налегке',   'grid[4][0]=2;',              [7, 8, 9]],
  ['с толчком', 'grid[4][0]=2; grid[4][1]=3;', [1, 2, 3]],
]) {
  const s = makeGame({ setup: `
    ${extra}
    worker.col=3; worker.row=0; worker.tween=null; worker.x = 3 * TILE; worker.y = rowTopY(0);
    queue.length=0; queue.push('jumpR');
  ` });
  s.run('craneTimer=1e9;');
  const seq = [];
  for (let i = 0; i < 60; i++) {
    s.frames(1);
    const f = s.get('workerFrame()');
    if (seq[seq.length - 1] !== f) seq.push(f);
  }
  t.check(`прыжок на стопку ${name}: подъём идёт кадром полёта`, seq[0], 0);
  // шаг длится 400 мс, кадр меняется раз в 200 мс — значит ровно два кадра
  t.check(`  а шаг вбок — своим циклом, с первого кадра`,
    seq.slice(1).filter(f => cycle.includes(f)), [cycle[0], cycle[1]]);
  t.check(`  и чужой цикл не примешивается`,
    seq.some(f => f !== 0 && f !== 4 && f !== 5 && f !== 6 && !cycle.includes(f)), false);
}


// --- 13. Прыжок вбок не заводит внутрь блока, приземлившегося за время подъёма ---
// Слева стопка высотой 1, справа пусто, грузчик справа, в левую колонку летит
// блок. Прыжок вверх-влево раскладывается на подъём и шаг влево, и за время
// подъёма блок успевает лечь. План шага, составленный в момент прыжка, к этому
// моменту протухает: по нему клетка ещё свободна. Пересчёт плана обязателен.
for (let preT = 0; preT <= 360; preT += 60) {
  // есть куда толкать — блок должен уехать, а грузчик встать на его место
  const a = makeGame({ setup: `
    grid[3][0]=2;
    worker.col=4; worker.row=0; worker.tween=null; worker.x = 4 * TILE; worker.y = rowTopY(0);
    falling.push({ col: 3, row: 2, toRow: 1, color: 3, t: ${preT} });
    queue.length=0; queue.push('jumpL');
  ` });
  a.run('craneTimer=1e9;');
  a.frames(100);
  t.check(`подъём ${preT} мс: грузчик не внутри блока`,
    a.get('isSolid(grid[worker.col][worker.row]) || isSolid(grid[worker.col][worker.row + 1])'),
    false);

  // толкать некуда — шаг отменяется, грузчик остаётся в своей колонке
  const b = makeGame({ setup: `
    grid[3][0]=2; grid[2][0]=6; grid[2][1]=6;
    worker.col=4; worker.row=0; worker.tween=null; worker.x = 4 * TILE; worker.y = rowTopY(0);
    falling.push({ col: 3, row: 2, toRow: 1, color: 3, t: ${preT} });
    queue.length=0; queue.push('jumpL');
  ` });
  b.run('craneTimer=1e9;');
  b.frames(100);
  t.check(`  и при упоре в тёмные блоки шаг отменяется`,
    [b.snap().col, b.snap().row], [4, 0]);
}


// --- 14. Ходьба идёт непрерывным циклом, а не сбрасывается на каждом шаге ---
// В оригинале номер кадра обнуляется только при СМЕНЕ состояния движения
// (ctx+0x61 = 0 в FUN_00532fe3), а не на каждом шаге. У нас доигравший твин
// раньше тратил кадр впустую: между двумя шагами подряд вклинивался кадр без
// твина, рисовалась поза покоя и цикл начинался заново.
g = makeGame({ setup: `worker.col=1; worker.row=0; worker.tween=null; queue.length=0;` });
g.run('craneTimer=1e9;');
g.run('keys.right = true;');
const walked = [];
for (let i = 0; i < 130; i++) {
  g.frames(1);
  const f = g.get('workerFrame()');
  if (walked[walked.length - 1] !== f) walked.push(f);
}
t.check('при ходьбе поза покоя не мелькает', walked.includes(4), false);
t.check('цикл ходьбы идёт подряд', walked.slice(0, 6), [7, 8, 9, 7, 8, 9]);

// --- 15. Темп анимации — кадр на два тика, как в оригинале ---
t.check('кадр анимации держится 200 мс', g.get('ANIM_FRAME_MS'), 200);

t.done();
