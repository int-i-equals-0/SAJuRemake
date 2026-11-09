'use strict';
// Сила толкания: сколько ящиков персонаж двигает горизонтальным шагом.
const { makeGame, suite } = require('./harness');
const t = suite('сила толкания');

// Два ящика подряд справа: осилит только тот, кто двигает два
const pair = `grid[4][0]=2; grid[5][0]=3;
              worker.col=3; worker.row=0; worker.tween=null;
              keys.right = true; tryStep(1);`;
for (const [char, who, moved] of [[0, 'красный', false], [1, 'синий', true], [2, 'зелёный', false]]) {
  const g = makeGame({ char, setup: pair });
  const row = [g.col(4)[0], g.col(5)[0], g.col(6)[0]];
  t.check(`${who}: пара ящиков ${moved ? 'сдвинута' : 'не поддалась'}`,
    row, moved ? [0, 2, 3] : [2, 3, 0]);
}

// Один ящик двигают все
for (const [char, who] of [[0, 'красный'], [1, 'синий'], [2, 'зелёный']]) {
  const g = makeGame({ char, setup: `
    grid[4][0]=2;
    worker.col=3; worker.row=0; worker.tween=null;
    keys.right = true; tryStep(1);
  ` });
  t.check(`${who}: один ящик сдвинут`, [g.col(4)[0], g.col(5)[0]], [0, 2]);
}

// Тёмный блок не двигается ни у кого
for (const [char, who] of [[0, 'красный'], [1, 'синий']]) {
  const g = makeGame({ char, setup: `
    grid[4][0]=6;
    worker.col=3; worker.row=0; worker.tween=null;
    keys.right = true; tryStep(1);
  ` });
  t.check(`${who}: тёмный блок неподвижен`, g.col(4)[0], 6);
}

// Ящик, за которым стена, не двигается
let g = makeGame({ setup: `
  grid[11][0]=2;
  worker.col=10; worker.row=0; worker.tween=null;
  keys.right = true; tryStep(1);
` });
t.check('ящик у края поля не выталкивается', [g.col(11)[0], g.snap().col], [2, 10]);

// Гантеля временно добавляет силу красному
g = makeGame({ setup: `
  grid[4][0]=2; grid[5][0]=3;
  worker.col=3; worker.row=0; worker.tween=null;
  held = 15; useBonus();
  keys.right = true; tryStep(1);
` });
t.check('красный с гантелей двигает пару', [g.col(4)[0], g.col(5)[0], g.col(6)[0]], [0, 2, 3]);

t.done();
