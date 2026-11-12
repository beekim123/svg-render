import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {normalizeManifest} from '../ref/batch.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const source = path.resolve(option('--source', '../gemcard-demo'));
const output = path.resolve('素材/新画法');
const selected = args.flatMap((arg, index) => arg === '--id' ? [args[index + 1]] : []);
const manifest = JSON.parse(await fs.readFile(path.join(source, 'art/art-manifest.json'), 'utf8'));
const provenance = JSON.parse(await fs.readFile(path.join(source, 'art/new-art-provenance.json'), 'utf8'));
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const dirty = execFileSync('git', ['-C', source, 'status', '--porcelain', '--', 'art/svg', 'art/art-manifest.json'], {encoding: 'utf8'}).trim().length > 0;
await fs.mkdir(output, {recursive: true});
const assets = manifest.assets.map(asset => ({
  id: `新画法/${asset.id}`,
  批: '新画法',
  文件: `素材/新画法/${asset.id}.svg`,
  动作: [
    {名字: '待机', 种类: '循环', 静态: !asset.idle},
    ...Object.entries(asset.events || {}).map(([name, duration]) => ({
      名字: name,
      种类: asset.stay?.includes(name) ? null : '播一次',
      ...(asset.stay?.includes(name) ? {分类状态: '待验证', stay: true} : {}),
      毫秒: duration,
      触发: {attr: ['data-anim', name]},
    })),
  ],
  染色: Boolean(asset.tint),
  来源: 'gemcard-demo/art/art-manifest.json',
}));
normalizeManifest(assets);
let copied = 0;
for (const asset of manifest.assets) {
  if (selected.length && !selected.includes(asset.id)) continue;
  await fs.copyFile(path.join(source, 'art/svg', asset.id + '.svg'), path.join(output, asset.id + '.svg'));
  copied++;
}
await fs.writeFile(path.join(output, '清单.json'), JSON.stringify(assets, null, 2) + '\n');
await fs.writeFile(path.join(output, '来源.json'), JSON.stringify({
  仓库: 'gemcard-demo',
  提交: commit,
  素材来自工作区: dirty,
  素材数: assets.length,
  包: Object.fromEntries(manifest.assets.map(asset => [asset.id, provenance.assets[asset.id].package])),
}, null, 2) + '\n');
console.log(JSON.stringify({复制: copied, 素材: assets.length, 动作: assets.reduce((n, a) => n + a.动作.length, 0), 源提交: commit, 素材来自工作区: dirty}));
