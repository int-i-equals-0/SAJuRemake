'use strict';



const OLD_FILES = [
  
  'crate_red.png', 'crate_green.png', 'crate_yellow.png', 'crate_blue.png', 'crate_dark.png',
  'ball_red.png', 'ball_green.png', 'ball_yellow.png', 'ball_blue.png', 'ball_black.png',
  'hammer.png', 'magnet.png', 'feather.png', 'dumbbell.png', 'warning.png', 'heart.png',
  'boom0.png', 'boom1.png', 'boom2.png', 'boom3.png',
  
  'background.png', 'rail.png', 'crane0.png', 'crane1.png', 'ui_a.png', 'ui_b.png', 'ui_c.png',
  
  ...Array.from({length: 7}, (_, i) => `hourglass${i}.png`),
  
  ...['red', 'blue', 'green'].flatMap(c =>
    Array.from({length: 17}, (_, i) => `worker_${c}_${String(i).padStart(2, '0')}.png`)
  )
];


const NEW_FILES = OLD_FILES.filter(f => !f.startsWith('worker_'));


const REF_FILES = [
  'worker-red.png',
  'worker-blue.png',
  'worker-green.png'
];


const gridOld = document.getElementById('grid-old');
const gridNew = document.getElementById('grid-new');

function createImg(src, alt = '') {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.loading = 'lazy';
  return img;
}


OLD_FILES.forEach(f => gridOld.appendChild(createImg(`assets/sprites/${f}`, f)));
NEW_FILES.forEach(f => gridNew.appendChild(createImg(`assets/new_sprites/${f}`, f)));


document.querySelectorAll('.worker-frames').forEach(container => {
  const type = container.dataset.type;   
  const color = container.dataset.color;
  const basePath = type === 'old' ? 'assets/sprites' : 'assets/new_sprites';
  for (let i = 0; i < 17; i++) {
    const file = `worker_${color}_${String(i).padStart(2, '0')}.png`;
    const div = document.createElement('div');
    div.className = 'frame';
    const img = document.createElement('img');
    img.src = `${basePath}/${file}`;
    img.alt = file;
    img.loading = 'lazy';
    div.appendChild(img);
    container.appendChild(div);
  }
});


async function downloadZip(buttonId, files, baseDir, zipName) {
  const btn = document.getElementById(buttonId);
  btn.disabled = true;
  btn.textContent = 'Собираем...';
  try {
    const zip = new JSZip();
    const folder = zip.folder(baseDir);
    for (const file of files) {
      const url = `${baseDir}/${file}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Не удалось загрузить ${url}`);
      const blob = await response.blob();
      folder.file(file, blob);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert('Ошибка при создании архива: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = buttonId === 'dl-old' ? 'Все старые спрайты' :
                     buttonId === 'dl-new' ? 'Новые спрайты (без грузчиков)' :
                     'Все референсы';
  }
}

document.getElementById('dl-old').addEventListener('click', () => {
  downloadZip('dl-old', OLD_FILES, 'assets/sprites', 'old_sprites.zip');
});
document.getElementById('dl-new').addEventListener('click', () => {
  downloadZip('dl-new', NEW_FILES, 'assets/new_sprites', 'new_sprites.zip');
});
document.getElementById('dl-ref').addEventListener('click', () => {
  downloadZip('dl-ref', REF_FILES, 'assets/references', 'references.zip');
});