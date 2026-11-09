'use strict';
// Общий стенд для тестов. Игра грузится в изолированный контекст с заглушками
// браузера: канвас глотает все вызовы рисования, кадры прокручиваются вручную,
// клавиатурные события подаются напрямую. Никаких зависимостей.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.join(__dirname, '..', 'js', 'game.js');
const noop = () => {};

// Контекст рисования, который принимает что угодно и ничего не делает.
function stubCtx() {
  return new Proxy({}, {
    get(_t, p) {
      if (p === 'createLinearGradient' || p === 'createRadialGradient') {
        return () => ({ addColorStop: noop });
      }
      return typeof p === 'string' ? noop : undefined;
    },
    set: () => true,
  });
}

/**
 * Поднять игру. По умолчанию поле очищается, кран останавливается и
 * состояние переводится в 'playing' — тестам почти всегда нужно именно это.
 *   char  — индекс персонажа: 0 красный, 1 синий, 2 зелёный
 *   setup — код, выполняемый внутри игры после подготовки
 *   raw   — не чистить поле (для проверок стартовой раскладки и стресса)
 */
function makeGame({ char = 0, setup = '', raw = false } = {}) {
  const listeners = {};
  let now = 0;
  let rafCb = null;

  const sandbox = {
    document: { getElementById: () => ({ getContext: stubCtx }) },
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    performance: { now: () => now },
    requestAnimationFrame: cb => { rafCb = cb; },
    Math,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(GAME, 'utf8'), sandbox);

  const api = {
    // выполнить код внутри игры (можно сцеплять: .run(...).frames(n))
    run(code) { vm.runInContext(code, sandbox); return api; },
    // прочитать выражение из игры
    get: expr => vm.runInContext(`(${expr})`, sandbox),
    // подать клавиатурное событие
    key(type, code) {
      for (const fn of listeners[type] || []) fn({ code, preventDefault: noop });
      return api;
    },
    // прокрутить n кадров по 16 мс
    frames(n) {
      for (let i = 0; i < n; i++) {
        now += 16;
        const cb = rafCb;
        rafCb = null;
        if (!cb) throw new Error('цикл кадров оборвался');
        cb(now);
      }
      return api;
    },
    // прокручивать кадры, пока идёт хоть какая-то анимация. Надёжнее счёта
    // кадров: длительности выведены из оригинала и могут меняться.
    settle(maxMs = 6000) {
      let spent = 0;
      // на время ожидания подвоз останавливаем: иначе новый ящик с крана
      // успеет упасть в кадр и подменит проверяемое состояние
      api.run('craneTimer = 1e9;');
      // очередь тоже считается занятостью: действие из неё ещё не началось,
      // а без этого ожидание закончилось бы, не успев начаться
      const busy = `!!worker.tween || falling.length > 0 || queue.length > 0 ||
        offX.some(c => c.some(v => v !== 0))`;
      // Покой засчитываем только устойчивый: у двухфазного прыжка между
      // подъёмом и шагом есть кадр, где не идёт ровно ничего, и одиночная
      // проверка приняла бы его за конец движения.
      let calm = 0;
      while (spent < maxMs && calm < 3) {
        api.frames(1);
        spent += 16;
        calm = api.get(busy) ? 0 : calm + 1;
      }
      return api;
    },
    // колонка целиком, снизу вверх
    col: c => api.get(`grid[${c}].slice()`),
    // часто нужное состояние одним куском
    snap: () => api.get(`({
      state, col: worker.col, row: worker.row, facing: worker.facing,
      goingTo: worker.tween && worker.tween.toCol,
      dur: worker.tween && worker.tween.dur,
      pendingDir: worker.pendingDir,
      held, heldT, freezeT, lives, score, level, cleared,
      queue: queue.slice(),
      cranes: cranes.map(c => ({ col: c.targetCol, cargo: c.cargo, dir: c.dir })),
      falling: falling.map(f => ({ col: f.col, shoved: !!f.shoved, offX: f.offX || 0 })),
      offX: offX.map(c => c.slice())
    })`),
  };

  api.run(`
    charIdx = ${char};
    init();
    state = 'playing';
    ${raw ? '' : `
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) grid[c][r] = EMPTY;
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) offX[c][r] = 0;
      cranes.length = 0; craneTimer = 1e9;
      falling.length = 0; queue.length = 0;
      held = 0; heldT = 0; freezeT = 0;
      keys.left = false; keys.right = false;
    `}
    ${setup}
  `);
  return api;
}

// Простой набор проверок: печатает результат и считает провалы.
function suite(name) {
  let fails = 0;
  let total = 0;
  console.log(`\n— ${name}`);
  return {
    check(label, got, want) {
      total++;
      const ok = JSON.stringify(got) === JSON.stringify(want);
      if (!ok) fails++;
      console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label}`);
      if (!ok) {
        console.log(`        получено:  ${JSON.stringify(got)}`);
        console.log(`        ожидалось: ${JSON.stringify(want)}`);
      }
    },
    done() {
      console.log(fails ? `  ${fails} из ${total} провалено` : `  все ${total} пройдены`);
      if (fails) process.exitCode = 1;
      return fails;
    },
  };
}

module.exports = { makeGame, suite };
