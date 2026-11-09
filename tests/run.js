'use strict';
// Запуск всех наборов: node tests/run.js
// Каждый файл самодостаточен и запускается отдельно, поэтому падение одного
// набора не мешает остальным.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.test.js'))
  .sort();

let failed = 0;
for (const f of files) {
  try {
    process.stdout.write(execFileSync(process.execPath, [path.join(__dirname, f)],
      { encoding: 'utf8' }));
  } catch (e) {
    failed++;
    process.stdout.write(e.stdout || '');
    process.stdout.write(e.stderr || '');
  }
}

console.log(failed
  ? `\nНАБОРОВ С ОШИБКАМИ: ${failed} из ${files.length}`
  : `\nВсе ${files.length} наборов пройдены.`);
process.exit(failed ? 1 : 0);
