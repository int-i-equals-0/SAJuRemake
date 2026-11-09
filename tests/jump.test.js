'use strict';
// Прыжок вверх-вбок: подъём в своей колонке, затем шаг с толканием.
// Сценарии столбов — дословно примеры владельца из обсуждения механики.
const { makeGame, suite } = require('./harness');
const t = suite('прыжки');

const jumpL = `worker.col=3; worker.row=0; worker.tween=null;
               queue.length=0; queue.push('jumpL');`;

// Базовое поведение
let g = makeGame({ setup: `
  grid[3][0]=2; grid[4][0]=2;
  worker.col=3; worker.row=1; worker.tween=null;
  queue.length=0; queue.push('jumpR');
` }).settle();
t.check('прыжок вбок: залезает на соседний ящик', [g.snap().col, g.snap().row], [4, 1]);

g = makeGame({ setup: `
  grid[3][0]=2;
  worker.col=3; worker.row=1; worker.tween=null;
  queue.length=0; queue.push('jumpR');
` }).settle();
t.check('прыжок в пустоту: перелетает и падает', [g.snap().col, g.snap().row], [4, 0]);

// Высота прыжка у персонажей
for (const [char, who, lands] of [[0, 'красный', 3], [2, 'зелёный', 4]]) {
  const s = makeGame({ char, setup: `
    grid[4][0]=6; grid[4][1]=6;
    worker.col=3; worker.row=0; worker.tween=null;
    queue.length=0; queue.push('jumpR');
  ` }).settle().snap();
  t.check(`${who}: стопка в два тёмных блока ${lands === 4 ? 'взята' : 'не взята'}`,
    s.col, lands);
}

// --- примеры владельца ---
// Сдвинутый вбок блок падает, если под ним пусто: проверяем итог после обвала.

g = makeGame({ setup: `grid[2][0]=2; grid[2][1]=3; ${jumpL}` }).settle();
t.check('красный + столб 2: у столба остался нижний', g.col(2).slice(0, 2), [2, 0]);
t.check('красный + столб 2: второй блок ушёл влево', g.col(1).slice(0, 2), [3, 0]);
t.check('красный + столб 2: грузчик поднялся на клетку', [g.snap().col, g.snap().row], [2, 1]);

g = makeGame({ char: 1, setup: `grid[2][0]=2; grid[2][1]=3; grid[2][2]=4; ${jumpL}` }).settle();
t.check('синий + столб 3: у столба остался нижний', g.col(2).slice(0, 3), [2, 0, 0]);
t.check('синий + столб 3: два верхних ушли влево', g.col(1).slice(0, 3), [3, 4, 0]);
t.check('синий + столб 3: грузчик на высоте 1', [g.snap().col, g.snap().row], [2, 1]);

g = makeGame({ char: 1, setup: `
  grid[2][0]=2; grid[2][1]=3; grid[1][0]=4; grid[1][1]=5; ${jumpL}
` }).settle();
t.check('синий + квадрат 2×2: верхние два блока уехали на колонку',
  [g.col(2).slice(0, 2), g.col(1).slice(0, 2), g.col(0).slice(0, 2)],
  [[2, 0], [4, 3], [5, 0]]);

g = makeGame({ char: 2, setup: `grid[2][0]=2; grid[2][1]=3; grid[2][2]=4; ${jumpL}` }).settle();
t.check('зелёный + столб 3: снят только верхний', g.col(2).slice(0, 3), [2, 3, 0]);
t.check('зелёный + столб 3: верхний ушёл влево', g.col(1).slice(0, 2), [4, 0]);
t.check('зелёный + столб 3: грузчик на высоте 2', [g.snap().col, g.snap().row], [2, 2]);

const col4 = 'grid[2][0]=2; grid[2][1]=3; grid[2][2]=4; grid[2][3]=5;';
g = makeGame({ char: 2, setup: `${col4} held=15; useBonus(); ${jumpL}` }).settle();
t.check('зелёный с гантелей + столб 4: остались два нижних', g.col(2).slice(0, 4), [2, 3, 0, 0]);
t.check('зелёный с гантелей + столб 4: два верхних ушли', g.col(1).slice(0, 3), [4, 5, 0]);

g = makeGame({ char: 1, setup: `${col4} held=14; useBonus(); ${jumpL}` }).settle();
t.check('синий с пером + столб 4: остались два нижних', g.col(2).slice(0, 4), [2, 3, 0, 0]);
t.check('синий с пером + столб 4: два верхних ушли', g.col(1).slice(0, 3), [4, 5, 0]);

g = makeGame({ setup: `${col4} ${jumpL}` }).settle();
t.check('красный + столб 4: ничего не сдвинулось', g.col(2).slice(0, 4), [2, 3, 4, 5]);
t.check('красный + столб 4: остался на месте', [g.snap().col, g.snap().row], [3, 0]);

t.done();
