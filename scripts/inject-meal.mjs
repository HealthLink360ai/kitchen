import { readFile, writeFile } from 'node:fs/promises';

const path = 'index.html';
let html = await readFile(path, 'utf8');
const tag = '<script src="/meal-overlay.js" defer></script>';
if (!html.includes(tag)) {
  html = html.replace('</body>', `${tag}\n</body>`);
  await writeFile(path, html);
}
