'use strict';
// Звук на слух не проверишь, но связность таблицы — вполне: имена в вызовах,
// приоритеты и наличие файлов. Такая проверка ловит опечатки вроде playSound('bal').
const fs = require('fs');
const path = require('path');
const { makeGame, suite } = require('./harness');
const t = suite('звук');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
const g = makeGame();
const files = g.get('SOUND_FILES');
const prio = g.get('SOUND_PRIORITY');

// Все имена из вызовов описаны в таблице
const used = [...src.matchAll(/playSound\('([a-z]+)'\)/g)].map(m => m[1]);
const unknown = [...new Set(used)].filter(n => !(n in files));
t.check('все вызванные звуки есть в таблице', unknown, []);
t.check('вызовы покрывают заметную часть таблицы', new Set(used).size >= 8, true);

// У каждого звука, кроме музыки, есть приоритет
const noPrio = Object.keys(files).filter(n => n !== 'music' && !(n in prio));
t.check('у каждого звука есть приоритет', noPrio, []);

// Один файл не назначен на два события
const values = Object.values(files);
t.check('файлы не дублируются', values.length, new Set(values).size);

// Приоритеты осмысленны: конец партии важнее шага
t.check('потеря жизни важнее шага', prio.hurt > prio.step, true);
t.check('рекорд важнее всего', Math.max(...Object.values(prio)), prio.record);

// Файлы на месте (если временные ассеты ещё лежат в проекте)
const dir = path.join(__dirname, '..', 'assets', 'sound');
if (fs.existsSync(dir)) {
  const missing = values.filter(v => !fs.existsSync(path.join(dir, v + '.ogg')));
  t.check('все файлы звуков на месте', missing, []);
} else {
  console.log('  ..    файлов звука нет — проверка пропущена');
}

// Без Audio игра работает молча и не падает
t.check('без звука игра не падает', g.get(`(() => {
  try { playSound('clear'); playSound('нет такого'); updateMusic(); return 'ок'; }
  catch (e) { return String(e); }
})()`), 'ок');

t.done();
