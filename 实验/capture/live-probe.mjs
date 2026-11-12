// 活图对冻结图差异的定向实验：同几个素材分别用不同的 Chrome 参数出图，
// 看冻结图是否和正式参照逐字节相同、活图对冻结图相似度是否回到 0.95 以上。
// 用法：node 实验/capture/live-probe.mjs <名字> [--flag ...] -- <素材id> ...
import fs from 'node:fs/promises';
import path from 'node:path';
import {runBatch} from '../../tools/ref/batch.mjs';
import {sha256} from '../../tools/ref/index.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const name = args.shift();
const split = args.indexOf('--');
const extra = split < 0 ? [] : args.slice(0, split);
const ids = split < 0 ? args : args.slice(split + 1);
const platform = process.platform === 'darwin' ? 'mac' : 'linux';
const formal = path.join(ROOT, 'out', platform);
const out = path.join(ROOT, 'out', platform, 'capture-probe', 'live-' + name);

const report = await runBatch({ids, out, cache: false, sessionOptions: {extra}});
const rows = [];
for (const action of report.动作) {
  for (const frame of action.帧) {
    const mine = await fs.readFile(path.join(out, frame.文件));
    const theirs = await fs.readFile(path.join(formal, frame.文件)).catch(() => null);
    rows.push({素材: action.素材, 动作: action.动作, 时刻: frame.时刻, 倍率: frame.倍率, 相似度: frame.相似度, 相似度_模糊后: frame.相似度_模糊后 ?? null, 通过: frame.通过,
      冻结图等于正式参照: theirs ? sha256(mine) === sha256(theirs) : null});
  }
}
const byAction = {};
for (const r of rows) {
  const key = `${r.素材}/${r.动作}`;
  byAction[key] ??= {帧数: 0, 最低相似度: 1, 低于095: 0, 未通过: 0, 冻结图不同于正式参照: 0};
  const a = byAction[key];
  a.帧数++;
  a.最低相似度 = Math.min(a.最低相似度, r.相似度);
  if (r.相似度 < 0.95) a.低于095++;
  if (!r.通过) a.未通过++;
  if (r.冻结图等于正式参照 === false) a.冻结图不同于正式参照++;
}
const summary = {名字: name, 参数: extra, 错误: report.错误, 按动作: byAction, 行: rows};
await fs.writeFile(path.join(out, '实验结果.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({名字: name, 参数: extra, 错误数: report.错误.length, 按动作: byAction}, null, 1));
