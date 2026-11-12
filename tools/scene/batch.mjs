import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const args = process.argv.slice(2);
const phase = args.shift();
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const selected = args.flatMap((arg, index) => arg === '--id' ? [args[index + 1]] : []);
const root = path.resolve(option('--out', 'out/mac/新画法'));
const referenceDirectory = phase === 'compare' ? path.resolve(option('--ref', path.join(root, 'ref'))) : path.join(root, 'ref');
const binary = path.resolve(option('--binary', 'out/mac/scene/scene-draw'));
const reportDirectory = path.resolve(option('--report', '报告/阶段1A'));

async function files(directory, extension) {
  const result = [];
  for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(file, extension));
    else if (entry.name.endsWith(extension)) result.push(file);
  }
  return result.sort();
}

const images = (await files(referenceDirectory, '.png')).filter(file => {
  const id = path.relative(referenceDirectory, file).split(path.sep).slice(0, 2).join('/');
  return !selected.length || selected.includes(id) || selected.includes(id.replace(/@[0-9a-f]{6}$/i, ''));
});
if (!images.length) throw new Error('没有所选参照帧');
const relative = file => path.relative(referenceDirectory, file);

if (phase === 'export') {
  const {createSceneExportSession} = await import('./export.mjs');
  const session = await createSceneExportSession();
  try {
    for (const [index, file] of images.entries()) {
      const frozen = file.replace(/@1x\.png$/, '.svg').replace(/\.png$/, '.svg');
      const scene = await session.export({svg: await fs.readFile(frozen, 'utf8'), source: frozen});
      const target = path.join(root, 'scene', relative(file).replace(/\.png$/, '.json'));
      await fs.mkdir(path.dirname(target), {recursive: true});
      await fs.writeFile(target, JSON.stringify(scene));
      if ((index + 1) % 100 === 0) console.log(`已导出 ${index + 1}/${images.length}`);
    }
  } finally {
    await session.close();
  }
} else if (phase === 'draw') {
  for (const [index, file] of images.entries()) {
    const target = path.join(root, 'skia', relative(file));
    const scene = path.join(root, 'scene', relative(file).replace(/\.png$/, '.json'));
    await fs.mkdir(path.dirname(target), {recursive: true});
    const result = spawnSync(binary, [scene, '1', target], {encoding: 'utf8'});
    if (result.status !== 0) throw new Error(`${scene}: ${result.error?.message || result.stderr}`);
    if ((index + 1) % 100 === 0) console.log(`已绘制 ${index + 1}/${images.length}`);
  }
} else if (phase === 'compare') {
  const {writeStageReport} = await import('./report.mjs');
  const ids = [...new Set(images.map(file => relative(file).split(path.sep).slice(0, 2).join('/')))];
  const rows = [];
  let worst = [];
  for (const id of ids) {
    const target = path.join(root, 'compare', id);
    await fs.rm(path.join(target, '结果.json'), {force: true});
    const result = spawnSync(process.execPath, [
      'tools/compare/cli.mjs', path.join(referenceDirectory, id), path.join(root, 'skia', id),
      '--线', '静止', '--报告', target,
    ], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
    if (result.error || result.status > 2 || result.status === null) {
      throw new Error(`${id}: ${result.error?.message || result.stderr || result.stdout}`);
    }
    const data = JSON.parse(await fs.readFile(path.join(target, '结果.json'), 'utf8'));
    for (const row of data.配对) {
      row.路径 = `${id}/${row.路径}`;
      const {图片, ...small} = row;
      rows.push(small);
      worst.push(row);
    }
    worst.sort((a, b) => score(a) - score(b));
    worst = worst.slice(0, 20);
    console.log(`${id}: ${data.汇总.通过数}/${data.汇总.配对数}`);
  }
  await writeStageReport(reportDirectory, {
    rows,
    worst,
    detailsFile: path.join(root, 'compare', '结果.json'),
    referenceDirectory,
    skiaDirectory: path.join(root, 'skia'),
  });
  console.log(`对照报告：${reportDirectory}/index.html`);
  if (rows.some(row => !row.通过)) process.exitCode = 1;
} else {
  throw new Error('用法：node tools/scene/batch.mjs export|draw|compare [--id 新画法/素材] [--out out/mac/新画法] [--ref 参照目录]');
}
console.log(`${phase}: ${images.length} 帧`);

function score(row) {
  return row.错误 ? -Infinity : Math.min(...row.分组.map(group => group.指标.ssim));
}
