'use strict';
// Очистка поля: связные группы одного цвета и полный нижний ряд.
const { makeGame, suite } = require('./harness');
const t = suite('очистка и очки');

// Связная группа из 4 красных ящиков (значение 2) — сносится, одиночки целы
let g = makeGame({ setup: `
  grid[3][0]=2; grid[4][0]=2; grid[5][0]=2; grid[3][1]=2;
  grid[8][0]=3; grid[9][0]=4;
  worker.col=0; worker.row=0; worker.tween=null;
  score = 0; cleared = 0;
  checkClears();
` });
t.check('группа из 4 даёт (n−1)² = 9 очков', g.get('score'), 9);
t.check('счётчик убранных вырос на 4', g.get('cleared'), 4);
g.frames(60);
t.check('группа исчезла с поля', [g.col(3)[0], g.col(4)[0], g.col(5)[0], g.col(3)[1]], [0, 0, 0, 0]);
t.check('одиночки других цветов остались', [g.col(8)[0], g.col(9)[0]], [3, 4]);

// Группа из 3 — минимальная, из 2 — не считается
g = makeGame({ setup: `
  grid[2][0]=2; grid[3][0]=2; grid[4][0]=2;
  grid[8][0]=5; grid[9][0]=5;
  score=0; cleared=0; worker.col=0; worker.row=0; worker.tween=null;
  checkClears();
` });
t.check('группа из 3 даёт 4 очка', g.get('score'), 4);
t.check('пара не сносится', [g.col(8)[0], g.col(9)[0]], [5, 5]);

// Полный нижний ряд — цвета не важны
g = makeGame({ setup: `
  for (let c = 0; c < COLS; c++) grid[c][0] = 2 + (c % 4);
  worker.col=0; worker.row=1; worker.tween=null;
  score=0; cleared=0;
  checkClears();
` });
t.check('полный ряд даёт 10 очков', g.get('score'), 10);
t.check('убрано 12 клеток', g.get('cleared'), 12);

// Неполный ряд не считается, даже если не хватает одной клетки
g = makeGame({ setup: `
  for (let c = 0; c < COLS - 1; c++) grid[c][0] = 2 + (c % 4);   // без одноцветных троек
  worker.col=11; worker.row=0; worker.tween=null;
  score=0; cleared=0;
  checkClears();
` });
t.check('ряд без одной клетки не убирается', g.get('cleared'), 0);

// Ящик, ещё едущий вбок, не считается улёгшимся и в группу не входит
g = makeGame({ setup: `
  grid[2][0]=2; grid[3][0]=2; grid[4][0]=2;
  offX[4][0] = -40;
  score=0; cleared=0; worker.col=8; worker.row=0; worker.tween=null;
  checkClears();
` });
t.check('едущий вбок ящик в группу не входит', g.get('cleared'), 0);

t.done();
