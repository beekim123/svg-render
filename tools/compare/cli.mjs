#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { resolve, relative, join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { PNG } from 'pngjs';
import { compareImages, DEFAULT_THRESHOLDS } from './metrics.mjs';
import { writeReport } from './report.mjs';

export async function loadPng(path) { return PNG.sync.read(await readFile(path)); }
export function encodePng(image) { return PNG.sync.write(image); }
const json = async path => JSON.parse(await readFile(path, 'utf8'));
async function optionalJson(path) { try { return await json(path); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
async function pngPaths(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await pngPaths(p));
    else if (entry.isFile() && extname(p).toLowerCase() === '.png') result.push(p);
  }
  return result.sort();
}
export async function pairPaths(a, b) {
  const sa = await stat(a), sb = await stat(b);
  if (sa.isFile() && sb.isFile()) return [{ key: a.split(/[\\/]/).at(-1), a, b }];
  if (!sa.isDirectory() || !sb.isDirectory()) throw new Error('甲乙必须同为文件或同为目录');
  const aa = await pngPaths(a), bb = await pngPaths(b), bmap = new Map(bb.map(p => [relative(b, p), p]));
  const pairs = [], missing = [];
  for (const pa of aa) { const key = relative(a, pa); if (!bmap.has(key)) missing.push(`乙缺少 ${key}`); else { pairs.push({ key, a: pa, b: bmap.get(key) }); bmap.delete(key); } }
  for (const key of bmap.keys()) missing.push(`甲缺少 ${key}`);
  if (missing.length) throw new Error(`找不到配对：\n${missing.join('\n')}`);
  if (!pairs.length) throw new Error('目录中没有 PNG，不能将空目录算作通过');
  return pairs;
}
export async function compareFiles(a, b, options = {}) {
  const start = performance.now(), metadata = await optionalJson(a.replace(/\.png$/i, '.json')) ?? {};
  let scale = options.scale ?? metadata.倍率 ?? metadata.scale ?? Number(a.match(/@([\d.]+)x\.png$/i)?.[1] ?? 1);
  const boxes = metadata.文字区域 ?? metadata.textBoxes ?? metadata.textRegions ?? [];
  if (!Array.isArray(boxes)) throw new Error('文字区域必须是包围盒数组');
  const [ia, ib] = await Promise.all([loadPng(a), loadPng(b)]);
  const result = compareImages(ia, ib, { ...options, scale, textBoxes: boxes.map(box => box.bbox ?? box) });
  const diff = encodePng(result.差异图); delete result.差异图;
  return { ...result, 耗时毫秒: performance.now() - start, 图片: { 甲: `data:image/png;base64,${(await readFile(a)).toString('base64')}`, 乙: `data:image/png;base64,${(await readFile(b)).toString('base64')}`, 差异: `data:image/png;base64,${diff.toString('base64')}` } };
}
export function parseArgs(argv) {
  const options = { line: '静止', report: 'out/报告/对照' }, positional = [];
  const flags = { '--线': 'line', '--报告': 'report', '--阈值': 'thresholdPath', '--GPU基准': 'baselinePath', '--倍率': 'scale' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--帮助' || argv[i] === '--help') return { help: true };
    if (flags[argv[i]]) { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${argv[i]} 缺少值`); options[flags[argv[i]]] = argv[++i]; }
    else if (argv[i].startsWith('--')) throw new Error(`未知参数 ${argv[i]}`);
    else positional.push(argv[i]);
  }
  if (positional.length !== 2) throw new Error('用法：npm run compare -- <甲> <乙> --线 静止|运动|GPU --报告 <目录>');
  if (!['静止', '运动', 'GPU'].includes(options.line)) throw new Error('--线 只接受 静止、运动、GPU');
  if (options.scale !== undefined) { options.scale = Number(options.scale); if (!Number.isFinite(options.scale) || options.scale <= 0) throw new Error('--倍率 必须为正数'); }
  return { ...options, a: resolve(positional[0]), b: resolve(positional[1]) };
}
export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
    if (options.help) { console.log('用法：npm run compare -- <甲.png|甲目录> <乙.png|乙目录> --线 静止|运动|GPU --报告 <目录> [--倍率 2] [--阈值 阈值.json] [--GPU基准 自身差.json]'); return 0; }
    const start = performance.now();
    const configured = options.thresholdPath ? await json(options.thresholdPath) : await optionalJson('阈值.json');
    const thresholds = configured ? { ...DEFAULT_THRESHOLDS, ...configured } : DEFAULT_THRESHOLDS;
    const baselines = options.baselinePath ? await json(options.baselinePath) : null;
    const pairs = await pairPaths(options.a, options.b), rows = [];
    for (const pair of pairs) {
      try {
        const baseline = baselines?.帧?.[pair.key] ?? baselines?.[pair.key];
        const result = await compareFiles(pair.a, pair.b, { ...options, thresholds, baseline });
        rows.push({ 路径: pair.key, 甲: pair.a, 乙: pair.b, ...result });
        console.log(`${result.通过 ? '通过' : '未通过'} ${pair.key} (${result.耗时毫秒.toFixed(0)} 毫秒)`);
      } catch (error) { rows.push({ 路径: pair.key, 甲: pair.a, 乙: pair.b, 错误: error.message, 通过: false }); }
    }
    const report = { 格式版本: 1, 线: options.line, 甲: options.a, 乙: options.b, 生成时间: new Date().toISOString(), 耗时毫秒: performance.now() - start, 配对: rows };
    await writeReport(options.report, report);
    console.log(`报告：${join(options.report, 'index.html')}`);
    return rows.some(r => r.错误) ? 2 : rows.every(r => r.通过) ? 0 : 1;
  } catch (error) {
    console.error(`对照出错：${error.message}`);
    if (options?.report) { await mkdir(options.report, { recursive: true }); await writeFile(join(options.report, '错误.json'), JSON.stringify({ 错误: error.message }, null, 2)); }
    return 2;
  }
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = await main();
