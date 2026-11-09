'use strict';
// Краны: сколько работает одновременно, как сбрасывают груз, множитель очков.
const { makeGame, suite } = require('./harness');
const t = suite('краны');

// Число одновременных кранов растёт с уровнем и упирается в потолок
for (const [level, want] of [[1, 1], [2, 1], [3, 2], [5, 3], [7, 4], [20, 4]]) {
  const g = makeGame({ setup: `level = ${level};` });
  t.check(`уровень ${level}: кранов одновременно ${want}`, g.get('maxCranes()'), want);
}

// Кран запускается по таймеру, но не больше разрешённого числа
let g = makeGame({ setup: `level = 1; craneTimer = 0;` }).frames(1);
t.check('первый кран выехал', g.snap().cranes.length, 1);
g.run('craneTimer = 0;').frames(1);
t.check('на первом уровне второй не выезжает', g.snap().cranes.length, 1);

g = makeGame({ setup: `level = 7; craneTimer = 0;` });
for (let i = 0; i < 6; i++) g.run('craneTimer = 0;').frames(1);
t.check('на седьмом уровне выезжает четыре', g.snap().cranes.length, 4);

// Два крана не целятся в одну колонку
g = makeGame({ setup: `
  level = 7;
  for (let c = 0; c < COLS - 2; c++) for (let r = 0; r < ROWS - 1; r++) grid[c][r] = 6;
  craneTimer = 0;
` });
for (let i = 0; i < 4; i++) g.run('craneTimer = 0;').frames(1);
const targets = g.snap().cranes.map(c => c.col);
t.check('цели кранов не повторяются', targets.length, new Set(targets).size);
t.check('свободных колонок хватило только на две', targets.length, 2);

// Груз падает на ходу, кран не останавливается
g = makeGame({ setup: `
  level = 1; craneTimer = 1e9;
  cranes.push({ dir: 1, x: 0, targetCol: 3, cargo: 2 });
` }).frames(100);   // на первом уровне 170 px/с, до цели 240 px
const s = g.snap();
t.check('груз сброшен на ходу', [s.cranes[0].cargo, s.falling.length], [0, 1]);
t.check('кран продолжил движение', g.get('cranes[0].x') > 3 * 80, true);

// Уехавший за край кран убирается
g = makeGame({ setup: `
  level = 1; craneTimer = 1e9;
  cranes.push({ dir: 1, x: FIELD_W - 10, targetCol: 0, cargo: 0 });
` }).frames(40);
t.check('уехавший кран снят с рельса', g.snap().cranes.length, 0);

// Знак опасности останавливает и движение, и запуск
g = makeGame({ setup: `
  level = 7; craneTimer = 0;
  cranes.push({ dir: 1, x: 100, targetCol: 5, cargo: 2 });
  freezeT = 5000;
` }).frames(30);
t.check('замороженный кран стоит', g.get('cranes[0].x'), 100);
t.check('новые краны не выезжают', g.snap().cranes.length, 1);

// Множитель очков равен числу работающих кранов
g = makeGame({ setup: `craneTimer = 1e9;` });
t.check('без кранов множитель равен единице', g.get('scoreMul()'), 1);
g.run(`cranes.push({dir:1,x:0,targetCol:1,cargo:2}); cranes.push({dir:1,x:0,targetCol:2,cargo:2});`);
t.check('два крана — множитель два', g.get('scoreMul()'), 2);

// Множитель попадает в начисление: группа из 3 при двух кранах даёт вдвое больше
for (const [n, want] of [[1, 4], [2, 8]]) {
  const s2 = makeGame({ setup: `
    craneTimer = 1e9;
    for (let i = 0; i < ${n}; i++) cranes.push({dir:1,x:0,targetCol:i,cargo:2});
    grid[6][0]=2; grid[7][0]=2; grid[8][0]=2;
    worker.col=0; worker.row=0; worker.tween=null;
    score = 0; checkClears();
  ` });
  t.check(`группа из 3 при ${n} кранах даёт ${want} очков`, s2.get('score'), want);
}

// Забитый склад заканчивает партию
g = makeGame({ setup: `
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS - 1; r++) grid[c][r] = 6;
  craneTimer = 0;
` }).frames(1);
t.check('забитый склад — конец партии', g.snap().state, 'gameover');

t.done();
