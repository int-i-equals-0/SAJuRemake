'use strict';
// Бонусы и открытие персонажей — по логике оригинала (FUN_0053fe59).
const { makeGame, suite } = require('./harness');
const t = suite('бонусы');

// Цветной шар сносит все ящики своего цвета: шар N убирает ящики N−5
let g = makeGame({ setup: `
  grid[0][0]=4; grid[1][0]=2; grid[2][0]=4; grid[3][0]=5; grid[4][0]=4;
  worker.col=7; worker.row=0; worker.tween=null;
  held = 9; useBonus();
` });
t.check('жёлтый шар помечает только жёлтые', g.get('[0,1,2,3,4].map(c => grid[c][0])'),
  [18, 2, 18, 5, 18]);
t.check('шар потрачен', g.get('held'), 0);

// Чёрный шар: 3 клетки в ширину, 4 в высоту вокруг грузчика
g = makeGame({ setup: `
  for (let c=0;c<COLS;c++) for (let r=0;r<6;r++) grid[c][r]=2;
  worker.col=5; worker.row=3; worker.tween=null; grid[5][3]=EMPTY;
  held = 11; useBonus();
` });
const boomed = g.get(`(() => {
  const out = [];
  for (let c=0;c<COLS;c++) for (let r=0;r<6;r++) if (grid[c][r] === 18) out.push([c, r]);
  return out;
})()`);
t.check('чёрный шар: три колонки', [...new Set(boomed.map(b => b[0]))].sort((a, b) => a - b), [4, 5, 6]);
t.check('чёрный шар: четыре ряда', [...new Set(boomed.map(b => b[1]))].sort((a, b) => a - b), [2, 3, 4, 5]);

// Молоток: бьёт блок перед грузчиком, тёмный не берёт
g = makeGame({ setup: `
  grid[4][0]=3; worker.col=3; worker.row=0; worker.facing=1; worker.tween=null;
  held = 12; useBonus();
` });
t.check('молоток разбил ящик перед собой', g.col(4)[0], 18);
g = makeGame({ setup: `
  grid[4][0]=6; worker.col=3; worker.row=0; worker.facing=1; worker.tween=null;
  held = 12; useBonus();
` });
t.check('молоток не берёт тёмный ящик', g.col(4)[0], 6);
t.check('молоток остался в руках', g.get('held'), 12);

// Магнит: тянет блок и отступает сам, оба плавно
g = makeGame({ setup: `
  grid[4][0]=3; worker.col=3; worker.row=0; worker.facing=1; worker.tween=null;
  held = 13; useBonus();
` });
t.check('магнит: блок встал на место грузчика', g.get('[3,4].map(c => grid[c][0])'), [3, 0]);
t.check('магнит: блок едет плавно', g.snap().offX[3][0] !== 0, true);
t.check('магнит: грузчик ещё в пути', g.snap().col, 3);
g.frames(40);
t.check('магнит: доехали', [g.snap().col, g.snap().offX[3][0]], [2, 0]);

g = makeGame({ setup: `
  grid[4][0]=6; worker.col=3; worker.row=0; worker.facing=1; worker.tween=null;
  held = 13; useBonus();
` });
t.check('магнит не тянет тёмный ящик', g.col(4)[0], 6);

// Перо и гантеля — временные способности
g = makeGame({ setup: `worker.tween=null; held=14; useBonus();` });
t.check('перо: прыжок стал 2, сила прежняя', [g.get('activeClimb()'), g.get('activePush()')], [2, 1]);
g = makeGame({ setup: `worker.tween=null; held=15; useBonus();` });
t.check('гантеля: сила стала 2', g.get('activePush()'), 2);

// Знак опасности морозит краны
g = makeGame({ setup: `worker.tween=null; held=16; useBonus();` });
t.check('знак опасности включил заморозку', g.snap().freezeT > 0, true);

// Сердце: мгновенная жизнь, слот не занимает, потолок три
g = makeGame({ setup: `lives = 1; worker.tween=null; pickUp(17);` });
t.check('сердце даёт жизнь сразу', g.get('lives'), 2);
t.check('сердце не занимает слот', g.get('held'), 0);
g = makeGame({ setup: `lives = 3; worker.tween=null; pickUp(17);` });
t.check('больше трёх жизней не бывает', g.get('lives'), 3);

// Кому какой бонус выпадает
for (const [char, who, feather, dumbbell] of [
  [0, 'красный', false, false], [1, 'синий', true, false], [2, 'зелёный', false, true],
]) {
  const s = makeGame({ char, setup: `
    globalThis.__seen = (() => { const s = new Set();
      for (let i = 0; i < 40000; i++) s.add(pickCargo()); return [...s]; })();
  ` });
  const seen = s.get('__seen');
  t.check(`${who}: перо ${feather ? 'выпадает' : 'не выпадает'}`, seen.includes(14), feather);
  t.check(`${who}: гантеля ${dumbbell ? 'выпадает' : 'не выпадает'}`, seen.includes(15), dumbbell);
}

// Пороги открытия персонажей
for (const [best, want] of [[0, [true, false, false]], [999, [true, false, false]],
                           [1000, [true, true, false]], [2499, [true, true, false]],
                           [2500, [true, true, true]]]) {
  const s = makeGame({ setup: `best = ${best};` });
  t.check(`рекорд ${best}: открыты ${JSON.stringify(want)}`,
    s.get('[unlocked(0), unlocked(1), unlocked(2)]'), want);
}

t.done();
