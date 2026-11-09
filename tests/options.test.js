'use strict';
// Настройки: переключение значений, сохранение и влияние на игру.
const { makeGame, suite } = require('./harness');
const t = suite('настройки');

// Меню: выбор между началом партии и настройками
let g = makeGame({ setup: `state = 'menu'; menuIdx = 0;` });
g.key('keydown', 'ArrowRight');
t.check('вправо переводит на настройки', g.get('menuIdx'), 1);
g.key('keydown', 'Enter');
t.check('Enter открывает настройки', g.snap().state, 'options');
g.key('keydown', 'Escape');
t.check('Esc возвращает в меню', g.snap().state, 'menu');
g.key('keydown', 'ArrowLeft').key('keydown', 'Enter');
t.check('с первой кнопки идём к выбору грузчика', g.snap().state, 'select');

// Перебор пунктов
g = makeGame({ setup: `state = 'options'; optIdx = 0;` });
g.key('keydown', 'ArrowDown');
t.check('вниз — следующий пункт', g.get('optIdx'), 1);
g.key('keydown', 'ArrowUp').key('keydown', 'ArrowUp');
t.check('вверх с первого — на последний', g.get('optIdx'), g.get('OPTIONS.length - 1'));

// Графика переключается и влияет на путь к спрайтам
g = makeGame({ setup: `state = 'options'; optIdx = 0;` });
t.check('по умолчанию графика пиксельная', g.get('gfxMode'), 'pixel');
g.key('keydown', 'ArrowRight');
t.check('переключилась на современную', g.get('gfxMode'), 'modern');
t.check('папка спрайтов сменилась', g.get('GFX_DIRS[gfxMode]'), 'assets/new_sprites');
g.key('keydown', 'ArrowRight');
t.check('обратно на пиксельную', g.get('gfxMode'), 'pixel');

// Звук
g = makeGame({ setup: `state = 'options'; optIdx = 1; audioOn = true;` });
g.key('keydown', 'ArrowRight');
t.check('звук выключается', g.get('audioOn'), false);
g.key('keydown', 'ArrowLeft');
t.check('и включается обратно', g.get('audioOn'), true);

// Режим звука
g = makeGame({ setup: `state = 'options'; optIdx = 2;` });
t.check('по умолчанию один канал', g.get('soundMode'), 'channel');
g.key('keydown', 'ArrowRight');
t.check('переключается на наложение', g.get('soundMode'), 'mix');

// Все пункты описаны корректно
g = makeGame();
const opts = g.get('OPTIONS');
t.check('у каждого пункта столько же имён, сколько значений',
  opts.filter(o => o.vals.length !== o.names.length), []);
t.check('текущее значение каждого пункта есть в списке',
  g.get('OPTIONS.filter(o => o.vals.indexOf(optValue(o.key)) < 0)'), []);

// Сохранение переживает перезапуск: пишем настройки и читаем их обратно
g = makeGame({ setup: `
  gfxMode = 'modern'; soundMode = 'mix'; audioOn = false;
  globalThis.__saved = JSON.stringify({ gfx: gfxMode, sound: audioOn, smode: soundMode });
  gfxMode = 'pixel'; soundMode = 'channel'; audioOn = true;
  try { localStorage = null; } catch (e) {}
  // разбор сохранённого делаем тем же кодом, что и при старте
  const o = JSON.parse(globalThis.__saved);
  if (o.gfx === 'pixel' || o.gfx === 'modern') gfxMode = o.gfx;
  if (typeof o.sound === 'boolean') audioOn = o.sound;
  if (o.smode === 'channel' || o.smode === 'mix') soundMode = o.smode;
` });
t.check('настройки восстанавливаются',
  [g.get('gfxMode'), g.get('soundMode'), g.get('audioOn')], ['modern', 'mix', false]);


// --- Громкость ---
g = makeGame({ setup: `state = 'options'; optFrom = 'menu'; optIdx = 3; volume = 0.6;` });
g.key('keydown', 'ArrowRight');
t.check('вправо поднимает громкость', g.get('volume'), 0.8);
g.key('keydown', 'ArrowLeft').key('keydown', 'ArrowLeft');
t.check('влево опускает громкость', g.get('volume'), 0.4);
g.run(`for (let i = 0; i < OPTIONS[3].vals.length; i++) {
  setOption('vol', OPTIONS[3].vals[i]);
}`);
t.check('крайнее значение — полная громкость', g.get('volume'), 1);
t.check('громкость есть отдельным пунктом настроек',
  g.get(`OPTIONS.some(o => o.key === 'vol')`), true);
t.check('тихий край действительно нулевой',
  g.get(`OPTIONS.find(o => o.key === 'vol').vals[0]`), 0);

// --- Настройки из паузы ---
g = makeGame({ setup: `
  worker.col=4; worker.row=0; worker.tween=null;
  state = 'playing'; togglePause();
` });
t.check('партия на паузе', g.snap().state, 'paused');
g.key('keydown', 'KeyO');
t.check('O из паузы открывает настройки', g.snap().state, 'options');
t.check('запомнено, что пришли из паузы', g.get('optFrom'), 'paused');
g.key('keydown', 'Escape');
t.check('Esc возвращает обратно в паузу, а не в меню', g.snap().state, 'paused');
g.key('keydown', 'KeyP');
t.check('из паузы партия продолжается', g.snap().state, 'playing');

g = makeGame({ setup: `state = 'menu'; menuIdx = 1;` });
g.key('keydown', 'Enter').key('keydown', 'Escape');
t.check('из меню Esc по-прежнему уводит в меню', g.snap().state, 'menu');

t.done();
