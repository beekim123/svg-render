import fs from 'node:fs/promises';
import path from 'node:path';
import {openChrome} from '../chrome/index.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = path.resolve(option('--out', 'out/mac/新画法'));
const selected = args.flatMap((arg, index) => arg === '--id' ? [args[index + 1]] : []);
const reference = path.join(root, 'ref');

async function images(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await images(file));
    else if (entry.name.endsWith('.png')) result.push(file);
  }
  return result.sort();
}

const files = (await images(reference)).filter(file => {
  const id = path.relative(reference, file).split(path.sep).slice(0, 2).join('/');
  return !selected.length || selected.includes(id) || selected.includes(id.replace(/@[0-9a-f]{6}$/i, ''));
});
if (!files.length) throw new Error('没有所选参照帧');
const chrome = await openChrome();
try {
  for (const [index, file] of files.entries()) {
    const frozen = file.replace(/@1x\.png$/, '.svg').replace(/\.png$/, '.svg');
    const svg = await fs.readFile(frozen, 'utf8');
    const header = await fs.open(file);
    const size = Buffer.alloc(24);
    try {
      await header.read(size, 0, size.length, 0);
    } finally {
      await header.close();
    }
    const width = size.readUInt32BE(16);
    const height = size.readUInt32BE(20);
    const url = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    await chrome.viewport(width, height);
    await chrome.setHtml(`<!doctype html><style>html,body{margin:0;background:transparent}img{display:block}</style><img width="${width}" height="${height}" src="${url}">`);
    await chrome.evaluate('document.querySelector("img").decode()');
    const png = await chrome.shot({x: 0, y: 0, width, height});
    const target = path.join(root, 'ref-img', path.relative(reference, file));
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.writeFile(target, png);
    if ((index + 1) % 100 === 0) console.log(`整图参照 ${index + 1}/${files.length}`);
  }
} finally {
  await chrome.close();
}
console.log(`整图参照：${files.length} 帧`);
