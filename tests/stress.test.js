'use strict';
// Долгий прогон со случайным вводом. Проверяет не конкретный сценарий, а то,
// что игра не приходит в невозможное состояние: именно так были пойманы
// потерянная функция gameOver и расхождение скоростей падения.
const { makeGame, suite } = require('./harness');
const t = suite('стресс-прогон');

const FRAMES = 7500;          // около двух минут игры
const RUNS = 4;

function play(seed) {
  const g = makeGame({ char: seed % 3, raw: true });
  g.run(`state = 'playing';`);
  const seen = new Set();
  let maxScore = 0;

  for (let i = 0; i < FRAMES; i++) {
    if (i % 20 === 0) {
      g.key('keyup', 'ArrowLeft');
      g.key('keyup', 'ArrowRight');
      const r = Math.random();
      if (r < 0.4) g.key('keydown', 'ArrowLeft');
      else if (r < 0.8) g.key('keydown', 'ArrowRight');
      if (Math.random() < 0.4) g.key('keydown', 'Space');
      if (Math.random() < 0.3) g.key('keydown', 'KeyS');
    }
    g.run(`if (state === 'menu' || state === 'select' || state === 'controls') {
             init(); state = 'playing';
           }`);
    g.frames(1);

    const s = g.get(`({
      state, col: worker.col, row: worker.row, score, lives,
      dying: dying > 0, tween: !!worker.tween,
      falling: falling.length, grid, offX,
      boom: grid.some(c => c.some(v => v >= BOOM0))
    })`);
    seen.add(s.state);
    maxScore = Math.max(maxScore, s.score);

    if (s.col < 0 || s.col >= 12 || s.row < 0 || s.row > 7) {
      throw new Error(`грузчик вне поля: ${s.col},${s.row} на кадре ${i}`);
    }
    if (s.score > 65000) throw new Error(`счёт выше потолка: ${s.score}`);
    if (s.lives < 0 || s.lives > 3) throw new Error(`недопустимое число жизней: ${s.lives}`);

    // Грузчик не имеет права ОСТАНОВИТЬСЯ внутри блока. Ловили это руками уже
    // дважды, поэтому проверяем каждый кадр каждого прогона. Смотрим только
    // устоявшееся состояние: пока идёт твин, логические координаты уже новые,
    // а картинка ещё едет, и мгновенное пересечение там законно.
    if (s.state === 'playing' && !s.dying && !s.tween) {
      for (const r of [s.row, s.row + 1]) {
        const v = r < 8 ? s.grid[s.col][r] : 0;
        // Только ящики и тёмный блок: бонус законно делит клетку с грузчиком
        // ровно до вызова collectHere(), это не «внутри блока».
        if (v >= 2 && v <= 6) {
          throw new Error(`грузчик внутри блока ${v} в ${s.col},${r} на кадре ${i}`);
        }
      }
    }

    for (let c = 0; c < 12; c++) {
      let gap = false;
      for (let r = 0; r < 8; r++) {
        const v = s.grid[c][r];
        if (v !== 0 && (v < 2 || v > 21)) {
          throw new Error(`недопустимое значение клетки ${v} в ${c},${r}`);
        }
        if (v === 0) { gap = true; continue; }
        // Висеть в воздухе ящик вправе, только пока едет вбок или пока
        // на поле идут падения и взрывы.
        if (gap && v >= 2 && v <= 5 && s.offX[c][r] === 0 && !s.falling && !s.boom) {
          throw new Error(`ящик висит в воздухе: ${c},${r} на кадре ${i}`);
        }
      }
    }
  }
  return { seen: [...seen], maxScore };
}

let bad = 0;
for (let run = 0; run < RUNS; run++) {
  try {
    const r = play(run);
    console.log(`  OK    прогон ${run + 1}: ${FRAMES} кадров, состояния ${r.seen.join(',')}, лучший счёт ${r.maxScore}`);
  } catch (e) {
    bad++;
    console.log(`  FAIL  прогон ${run + 1}: ${e.message}`);
  }
}
t.check('все прогоны без нарушений', bad, 0);
t.done();
