import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {compareFiles} from '../compare/cli.mjs';
import {summarize, writeReport} from '../compare/report.mjs';
import {densityLimitEvidence, isDensityLimit, usesPngRenderer} from './limit.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const renderer = option('--renderer', 'skia');
const output = path.resolve(option('--out', 'out/mac/新画法'));
const directory = path.join(output, 'layers');
const planFile = path.resolve(option('--plan', path.join(directory, 'capture-plan.json')));
const reportDirectory = path.resolve(option('--report', path.join(directory, 'compare')));
const plan = JSON.parse(await fs.readFile(planFile, 'utf8'));
const baselineFile = path.resolve(option('--运动基准', path.join(directory, 'motion-baseline.json')));
const baselines = JSON.parse(await fs.readFile(baselineFile, 'utf8'));
const bundles = new Map();
const thresholds = JSON.parse(await fs.readFile('阈值.json', 'utf8'));
const start = performance.now();
const groups = new Map();
for (const frame of plan) {
  const source = path.dirname(path.dirname(frame.key));
  if (!groups.has(source)) groups.set(source, []);
  groups.get(source).push(frame);
}
const metrics = [];
const assets = [];
const renderers = new Set();
const description = modes => '运动线使用逐帧Chrome自差×1.2基准，SSIM下限0.95。'
  + (modes.has('skia') ? 'Skia运行时的未过帧照常计失败。' : '')
  + (modes.has('png') ? 'PNG退回路径沿用Claude已确认两帧的2倍上限分类，其余未过帧计失败。' : '');
for (const [source, frames] of groups) {
  const rows = [];
  const groupRenderers = new Set();
  for (const frame of frames) {
    const row = {路径: frame.key, 甲: frame.reference, 乙: frame.output};
    try {
      const baseline = baselines.帧[frame.key];
      if (!baseline) throw new Error(`运动基准缺少帧：${frame.key}`);
      if (!bundles.has(frame.bundle)) bundles.set(frame.bundle, JSON.parse(await fs.readFile(path.join(directory, frame.bundle), 'utf8')));
      const bundle = bundles.get(frame.bundle);
      const png = usesPngRenderer(bundle, renderer);
      const mode = png ? 'png' : 'skia';
      groupRenderers.add(mode);
      renderers.add(mode);
      const result = await compareFiles(frame.reference, frame.output, {line: '运动', scale: frame.scale, thresholds, baseline});
      const measured = {...row, ...result, 渲染器: mode, 分类: result.通过 ? '通过' : '失败'};
      if (!result.通过 && png) {
        const evidence = densityLimitEvidence(bundle, frame.time, frame.scale);
        if (isDensityLimit(measured, evidence)) {
          measured.分类 = '2倍上限';
          measured.上限图层 = evidence.layers;
        }
      }
      rows.push(measured);
      console.log(`${measured.分类} ${frame.key}`);
    } catch (error) {
      rows.push({...row, 错误: error.message, 通过: false});
      console.log(`出错 ${frame.key}：${error.message}`);
    }
  }
  const target = path.join(reportDirectory, source);
  const report = await writeReport(target, {
    格式版本: 1,
    线: '运动',
    说明: description(groupRenderers),
    渲染器: [...groupRenderers],
    运动基准: baselineFile,
    素材: source,
    甲: path.join(output, 'ref', source),
    乙: path.join(output, 'godot', source),
    生成时间: new Date().toISOString(),
    配对: rows,
  });
  assets.push({素材: source, 报告: path.relative(reportDirectory, path.join(target, 'index.html')), 汇总: report.汇总});
  console.log(`素材 ${source}：通过 ${report.汇总.通过数}/${report.汇总.配对数}，2倍上限 ${report.汇总['2倍上限数']}，失败 ${report.汇总.失败数}`);
  for (const {图片, ...row} of rows) metrics.push(row);
}
const report = {
  格式版本: 1,
  线: '运动',
  说明: description(renderers),
  渲染器: [...renderers],
  运动基准: baselineFile,
  甲: path.join(output, 'ref'),
  乙: path.join(output, 'godot'),
  生成时间: new Date().toISOString(),
  耗时毫秒: performance.now() - start,
  汇总: summarize(metrics),
  素材: assets,
  配对: metrics,
};
await fs.mkdir(reportDirectory, {recursive: true});
await fs.writeFile(path.join(reportDirectory, '结果.json'), JSON.stringify(report, null, 2) + '\n');
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
const links = assets.map(asset => {
  const href = asset.报告.split(path.sep).map(encodeURIComponent).join('/');
  return `<tr><td><a href="${escape(href)}">${escape(asset.素材)}</a></td><td>${asset.汇总.通过数}/${asset.汇总.配对数}</td><td>${asset.汇总['2倍上限数']}</td><td>${asset.汇总.失败数}</td><td>${asset.汇总.指标.ssim.最差}</td></tr>`;
}).join('\n');
await fs.writeFile(path.join(reportDirectory, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Godot 运动对照</title><style>body{font:16px system-ui;margin:32px}table{border-collapse:collapse}th,td{padding:8px 16px;border-bottom:1px solid #ddd;text-align:left}</style><h1>Godot 运动对照</h1><p>${escape(report.说明)}</p><p>通过 ${report.汇总.通过数}/${report.汇总.配对数}，2倍上限 ${report.汇总['2倍上限数']}，失败 ${report.汇总.失败数}，最低 SSIM ${report.汇总.指标.ssim.最差}。</p><table><tr><th>素材</th><th>通过帧</th><th>2倍上限</th><th>失败</th><th>最低 SSIM</th></tr>${links}</table></html>`);
console.log(`运动对照：${report.汇总.通过数}/${report.汇总.配对数}；2倍上限 ${report.汇总['2倍上限数']}；失败 ${report.汇总.失败数}；最低 SSIM ${report.汇总.指标.ssim.最差}；${reportDirectory}/index.html`);
if (report.汇总.失败数 > 0) process.exitCode = 1;
