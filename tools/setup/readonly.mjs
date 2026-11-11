import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { root } from './paths.mjs';
const directories = ['docs', '素材/源文件', '素材/字体', '素材/试验图', '参考'];
async function walk(dir) {
  const entries = await fs.readdir(path.join(root, dir), { withFileTypes: true });
  const result = [];
  for (const entry of entries.sort((a,b) => a.name.localeCompare(b.name))) {
    const name = `${dir}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await walk(name));
    else if (entry.isFile()) result.push(name);
    else throw new Error(`只读目录里出现不支持的文件类型：${name}`);
  }
  return result;
}
export async function checkReadonly() {
  const baseline = JSON.parse(await fs.readFile(path.join(root, '报告/只读指纹.json'), 'utf8'));
  const current = {};
  for (const dir of directories) for (const file of await walk(dir)) current[file] = crypto.createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex');
  const changed = [...new Set([...Object.keys(baseline), ...Object.keys(current)])].filter(p => baseline[p] !== current[p]);
  return { '检查': '只读目录', '通过': changed.length === 0, '文件数': Object.keys(current).length, '变化': changed };
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = await checkReadonly(); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.通过 ? 0 : 1;
}
