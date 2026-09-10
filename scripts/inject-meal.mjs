import { readFile, writeFile } from 'node:fs/promises';

const path = 'index.html';
let html = await readFile(path, 'utf8');
const tag = '<script src="/meal-overlay.js" defer></script>';
html = html
  .replaceAll('https://live.healthlink360.ai/', 'https://beta.healthlink360.ai/')
  .replaceAll('Get the app first', 'Test the Beta');
if (!html.includes(tag)) {
  html = html.replace('</body>', `${tag}\n</body>`);
}
await writeFile(path, html);
