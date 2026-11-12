import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {pairPaths, loadPng} from '../compare/cli.mjs';
import {compareImages} from '../compare/metrics.mjs';

export async function generateMotionBaseline({root = 'out/mac/新画法', file} = {}) {
  root = path.resolve(root);
  file = path.resolve(file || path.join(root, 'layers/motion-baseline.json'));
  const reference = path.join(root, 'ref');
  const live = path.join(root, 'live');
  const pairs = await pairPaths(reference, live);
  const thresholds = JSON.parse(await fs.readFile('阈值.json', 'utf8'));
  const frames = {};
  let passed = 0;
  let lowest = 1;
  for (const [index, pair] of pairs.entries()) {
    const metadata = JSON.parse(await fs.readFile(pair.a.replace(/\.png$/, '.json'), 'utf8'));
    const [a, b] = await Promise.all([loadPng(pair.a), loadPng(pair.b)]);
    const result = compareImages(a, b, {line: '运动', thresholds, scale: metadata.倍率, textBoxes: (metadata.文字区域 || []).map(box => box.bbox || box)});
    frames[pair.key.split(path.sep).join('/')] = Object.fromEntries(result.分组.map(group => [group.区域, Object.fromEntries(['ssim', '大差比例_不算边', '最大差异块', '平均偏色'].map(key => [key, group.指标[key]]))]));
    passed += Number(result.通过);
    lowest = Math.min(lowest, ...result.分组.map(group => group.指标.ssim));
    if ((index + 1) % 100 === 0) console.log(`Chrome运动基准 ${index + 1}/${pairs.length}`);
  }
  const result = {线: '运动', 参照目录: reference, 活图目录: live, 汇总: {帧数: pairs.length, 原运动线通过: passed, 最低SSIM: lowest}, 帧: frames};
  await fs.mkdir(path.dirname(file), {recursive: true});
  await fs.writeFile(file, JSON.stringify(result) + '\n');
  console.log(`Chrome运动基准：${pairs.length} 帧；${file}`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
  await generateMotionBaseline({root: option('--out', 'out/mac/新画法'), file: option('--file')});
}
