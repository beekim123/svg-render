#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { compareImages, thresholdFor, largestThickComponent } from './metrics.mjs';
import { loadPng, encodePng, main, pairPaths } from './cli.mjs';

const root = resolve(import.meta.dirname, '../..');
function image(w, h, rgba = [255, 255, 255, 255]) { const data = Buffer.alloc(w * h * 4); for (let p = 0; p < w * h; p++) data.set(rgba, p * 4); return { width: w, height: h, data }; }
const copy = a => ({ width: a.width, height: a.height, data: Buffer.from(a.data) });
function rect(a, x, y, w, h, color) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) a.data.set(color, (yy * a.width + xx) * 4); }
const metric = (a, b, options) => compareImages(a, b, options).分组[0].指标;
const tests = [], record = async (name, run) => { const start = performance.now(); await run(); tests.push({ 检查: name, 通过: true, 毫秒: performance.now() - start }); console.log(`通过：${name}`); };
const tmp = await mkdtemp(join(tmpdir(), 'svg-compare-'));
try {
  await record('完全相同与全透明隐藏 RGB', () => {
    for (const [a, b] of [[image(20, 13), image(20, 13)], [image(1, 1, [20, 30, 40, 0]), image(1, 1, [240, 12, 90, 0])]]) {
      const r = metric(a, b); assert.equal(r.ssim, 1); for (const k of ['大差比例', '大差比例_不算边', '最大差异块', '平均偏色', '最大差', '平均绝对差']) assert.equal(r[k], 0);
    }
  });
  await record('抗锯齿圆平移一像素', () => {
    const a = image(80, 80), b = image(80, 80);
    for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) for (const [im, cx] of [[a, 39], [b, 40]]) {
      let inside = 0; for (let sy = 0; sy < 8; sy++) for (let sx = 0; sx < 8; sx++) if (Math.hypot(x + (sx + .5) / 8 - cx, y + (sy + .5) / 8 - 40) <= 24) inside++;
      const c = Math.round(255 * (1 - inside / 64)); im.data.set([c, c, c, 255], (y * 80 + x) * 4);
    }
    const r = metric(a, b); assert.equal(r.大差比例_不算边, 0); assert(r.ssim < 1);
  });
  await record('抹掉10×10方块', () => { const a = image(80, 80), b = copy(a); rect(a, 20, 20, 10, 10, [0, 0, 0, 255]); assert.equal(metric(a, b).最大差异块, 100); });
  await record('抹掉1×60线', () => { const a = image(80, 80), b = copy(a); rect(a, 20, 10, 1, 60, [0, 0, 0, 255]); const r = metric(a, b); assert.equal(r.最大差异块, 0); assert.equal(r.不算边大差像素, 60); });
  await record('整体加3与有符号通道偏色', () => { const r = metric(image(20, 20, [80, 100, 120, 255]), image(20, 20, [83, 103, 123, 255])); assert.equal(r.平均偏色, 3); assert.deepEqual(r.通道平均差, [-3, -3, -3]); assert.equal(r.大差比例_不算边, 0); });
  await record('白色半透明块128对168', () => { const r = metric(image(20, 20, [255, 255, 255, 128]), image(20, 20, [255, 255, 255, 168])); assert(r.大差比例_不算边 > 0); assert.equal(r.底, '深'); });
  await record('文字区域独立阈值', () => {
    const a = image(200, 100, [120, 120, 120, 255]), b = copy(a);
    // 文字半区均匀分布正负 1，偏色互相抵消，但 SSIM 只落在文字线内。
    for (let y = 0; y < 100; y++) for (let x = 0; x < 98; x++) for (let c = 0; c < 3; c++) b.data[(y * 200 + x) * 4 + c] = 120 + ((x + y) % 2 ? 1 : -1);
    const result = compareImages(a, b, { textBoxes: [{ x: 0, y: 0, width: 98, height: 100 }] });
    const text = result.分组.find(g => g.区域 === '文字'); assert(text.指标.ssim >= .98 && text.指标.ssim < .995, JSON.stringify(text)); assert(result.通过); assert(text.通过);
  });
  await record('文字和非文字分别选择最差底且内容不重计', () => {
    const a = image(80, 40), b = copy(a);
    for (let p = 0; p < 3200; p++) { const color = p % 80 < 40 ? 255 : 0; a.data.set([color, color, color, 128], p * 4); b.data.set([color, color, color, 168], p * 4); }
    const groups = compareImages(a, b, { textBoxes: [{x:0,y:0,width:38,height:40}] }).分组;
    assert.equal(groups.find(g => g.区域 === '文字').指标.底, '深');
    assert.equal(groups.find(g => g.区域 === '非文字').指标.底, '浅');
    assert.equal(groups[0].指标.内容像素, groups[1].指标.内容像素 + groups[2].指标.内容像素);
  });
  await record('小图镜像边界、透明外扩、平方倍率和GPU基准', () => {
    for (const [w, h] of [[1, 1], [1, 3], [3, 1], [2, 2]]) assert(Number.isFinite(metric(image(w, h, [20, 30, 40, 255]), image(w, h, [24, 31, 44, 255])).ssim));
    const a = image(30, 30, [0, 0, 0, 0]); rect(a, 15, 15, 1, 1, [0, 0, 0, 1]); assert.equal(metric(a, a).内容像素, 121);
    assert.equal(thresholdFor('静止', 2).最大差异块, 64); assert.equal(thresholdFor('运动', 2).ssim, .985);
    assert.throws(() => thresholdFor('GPU'), /基准/);
    assert.equal(thresholdFor('GPU', 1, undefined, { ssim: .999, 大差比例_不算边: .0001, 最大差异块: 4, 平均偏色: .1 }).最大差异块, 4.8);
    // 两个2×2块只在角上接触，八邻域应为8。
    const hard = Uint8Array.from([1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1]); assert.equal(largestThickComponent(hard, 4, 4), 8);
  });
  await record('CLI退出码、配对、元数据与独立HTML', async () => {
    const a = join(tmp, 'a.png'), b = join(tmp, 'b.png'), c = join(tmp, 'c.png'), report = join(tmp, 'report');
    await writeFile(a, encodePng(image(20, 20))); await writeFile(b, encodePng(image(21, 20))); await writeFile(c, encodePng(image(20, 20, [0,0,0,255])));
    assert.equal(await main([a, b, '--报告', report]), 2); assert.equal(await main([a, c, '--报告', report]), 1); assert.equal(await main([a, a, '--报告', report]), 0);
    assert.equal(await main([a, a, '--倍率', '0', '--报告', report]), 2);
    const html = await readFile(join(report, 'index.html'), 'utf8'); assert(html.includes('data:image/png;base64,')); assert(!/src="https?:/.test(html));
    await mkdir(join(tmp, 'left')); await mkdir(join(tmp, 'right')); await assert.rejects(pairPaths(join(tmp, 'left'), join(tmp, 'right')), /没有 PNG/);
    await writeFile(join(tmp, 'left', 'x.png'), encodePng(image(2, 2))); await assert.rejects(pairPaths(join(tmp, 'left'), join(tmp, 'right')), /找不到配对/);
    const child = spawnSync(process.execPath, [join(root, 'tools/compare/cli.mjs'), a, b, '--报告', report]); assert.equal(child.status, 2);
  });
  await record('五对真实素材对照Python试验版', async () => {
    const names = ['icon_status_stun', 'icon_gem_obsidian', 'icon_gem_soulstone', 'icon_gem_topaz', 'icon_gem_emerald'];
    const pairs = [];
    for (const [i, name] of names.entries()) {
      const aPath = join(root, '素材/源文件/复杂测试图/icons', `${name}.png`), a = await loadPng(aPath), b = copy(a);
      // 五个真实素材分别施加确定的RGB差、透明度差和平移，避免相同图的无效对数。
      for (let p = 0; p < a.width * a.height; p++) {
        if (i < 3) for (let c = 0; c < 3; c++) b.data[p * 4 + c] = Math.min(255, b.data[p * 4 + c] + (i + 1) * (c + 1));
        else if (i === 3) b.data[p * 4 + 3] = Math.max(0, b.data[p * 4 + 3] - 21);
        else { const x = p % a.width, from = (p - (x ? 1 : 0)) * 4; b.data.set(a.data.subarray(from, from + 4), p * 4); }
      }
      const bPath = join(tmp, `${name}.png`); await writeFile(bPath, encodePng(b));
      pairs.push({ aPath, bPath, js: metric(a, b) });
    }
    // 原试验版没有平均偏色。只读导入它，用它的 over/content/ssim 函数独立补算偏色，不改原文件。
    const python = `import importlib.util,json,sys,numpy as np\ns=importlib.util.spec_from_file_location('trial',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nout=[]\nfor pa,pb in json.loads(sys.argv[2]):\n a,b=m.load(pa),m.load(pb);mask=m.dilate((a[...,3]>0)|(b[...,3]>0),5);r=m.compare(pa,pb);bg=32 if r['底']=='深' else 224;r['平均偏色']=float(np.max(np.abs((m.over(a,bg)-m.over(b,bg))[mask].mean(axis=0))));out.append(r)\nprint(json.dumps(out))`;
    const child = spawnSync('python3', ['-c', python, join(root, 'docs/试验/比较.py'), JSON.stringify(pairs.map(p => [p.aPath, p.bPath]))], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(child.status, 0, child.stderr);
    const py = JSON.parse(child.stdout);
    for (let i = 0; i < pairs.length; i++) for (const key of ['ssim', '平均偏色', '大差比例']) assert(Math.abs(pairs[i].js[key] - py[i][key]) <= .001, `${names[i]} ${key}: JS=${pairs[i].js[key]} Python=${py[i][key]}`);
    tests.push({ 检查: 'Python对数细项', 通过: true, 对数: pairs.map((p, i) => ({ 素材: names[i], JavaScript: p.js, Python: py[i] })) });
  });
  if (process.argv.includes('--4k')) for (const transparent of [false, true]) await record(`3840×2160${transparent ? '半透明双底' : '不透明'}非相同图端到端五秒内`, async () => {
    const a = image(3840, 2160), b = copy(a);
    // 整张图都有内容且有差异。半透明场景必须实际计算两种底。
    for (let p = 0; p < a.width * a.height; p++) {
      const x = p % a.width, y = Math.floor(p / a.width);
      for (let c = 0; c < 3; c++) { a.data[p * 4 + c] = (x * 3 + y * 7 + c * 31) % 220; b.data[p * 4 + c] = a.data[p * 4 + c] + 3; }
      if (transparent) { a.data[p * 4 + 3] = 128; b.data[p * 4 + 3] = 135; }
    }
    const ap = join(tmp, '4k-a.png'), bp = join(tmp, '4k-b.png'); await writeFile(ap, encodePng(a)); await writeFile(bp, encodePng(b));
    const runner = `import {main} from ${JSON.stringify(new URL('./cli.mjs', import.meta.url).href)}; process.exitCode=await main(process.argv.slice(1)); console.log(JSON.stringify({资源:process.resourceUsage()}));`;
    const start = performance.now(); const child = spawnSync(process.execPath, ['--input-type=module', '--eval', runner, ap, bp, '--报告', join(tmp, '4k')], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    const elapsed = performance.now() - start; assert.equal(child.status, 1, child.stderr);
    const resource = JSON.parse(child.stdout.trim().split('\n').at(-1)).资源;
    console.log(`4K${transparent ? '半透明双底' : '不透明'}读取、计算、差异编码及HTML/JSON：${elapsed.toFixed(1)} 毫秒，峰值内存 ${(resource.maxRSS / 1024).toFixed(1)} MiB`);
    tests.push({ 检查: `4K${transparent ? '半透明双底' : '不透明'}端到端实测`, 通过: elapsed < 5000, 毫秒: elapsed, 峰值内存MiB: resource.maxRSS / 1024, Node: process.version, 平台: process.platform, 架构: process.arch, 进程资源: resource });
    assert(elapsed < 5000, `4K耗时 ${elapsed.toFixed(1)} 毫秒，超过5000`);
  });
  const output = process.argv.find(v => v.startsWith('--结果='))?.slice('--结果='.length);
  if (output) { await mkdir(resolve(output, '..'), { recursive: true }); await writeFile(output, JSON.stringify({ 通过: true, 检查: tests }, null, 2)); }
  console.log(`完成：${tests.length} 项检查。${process.argv.includes('--4k') ? '' : '4K性能尚未检查，请加 --4k。'}`);
} catch (error) { console.error(error); process.exitCode = 1; const output = process.argv.find(v => v.startsWith('--结果='))?.slice('--结果='.length); if (output) { await mkdir(resolve(output, '..'), { recursive: true }); await writeFile(output, JSON.stringify({ 通过: false, 错误: error.message, 检查: tests }, null, 2)); } }
finally { await rm(tmp, { recursive: true, force: true }); }
