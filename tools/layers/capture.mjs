import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const selections = name => args.flatMap((arg, index) => arg === name ? [args[index + 1]] : []);
const ids = selections('--id');
const times = selections('--time').map(Number);
const scales = selections('--scale').map(Number);
const output = path.resolve(option('--out', 'out/mac/新画法'));
const directory = path.join(output, 'layers');
const planFile = path.resolve(option('--plan', path.join(directory, 'capture-plan.json')));
const index = JSON.parse(await fs.readFile(path.join(directory, 'index.json'), 'utf8'));
const report = JSON.parse(await fs.readFile(path.join(output, '报告/参照.json'), 'utf8'));
const plan = [];
for (const asset of index.assets) {
  for (const variant of asset.variants) {
    if (ids.length && !ids.includes(asset.id) && !ids.includes(variant.source)) continue;
    for (const action of variant.actions) {
      const summary = report.动作.find(row => row.素材 === variant.source && row.动作 === action.name);
      for (const frame of summary.帧) {
        if (times.length && !times.includes(frame.时刻)) continue;
        if (scales.length && !scales.includes(frame.倍率)) continue;
        const reference = path.resolve(output, frame.文件);
        const key = path.relative(path.join(output, 'ref'), reference);
        plan.push({
          bundle: action.bundle,
          time: frame.时刻,
          scale: frame.倍率,
          reference,
          output: path.join(output, 'godot', key),
          key,
        });
      }
    }
  }
}
if (!plan.length) throw new Error(`没有所选参照帧：id=${ids.join(', ')} time=${times.join(', ')} scale=${scales.join(', ')}`);
await fs.mkdir(path.dirname(planFile), {recursive: true});
await fs.writeFile(planFile, JSON.stringify(plan, null, 2) + '\n');
console.log(`Godot 截图计划：${plan.length} 帧；${planFile}`);
