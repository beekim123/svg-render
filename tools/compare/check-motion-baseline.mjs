import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { thresholdFor } from './metrics.mjs';
import { encodePng, main } from './cli.mjs';

const metric = (ssim, ratio, block, bias) => ({ ssim, 大差比例_不算边: ratio, 最大差异块: block, 平均偏色: bias });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('运动自差只放宽，清晰的活图保留原阈值', () => {
  const strict = thresholdFor('运动', 2);
  assert.deepEqual(thresholdFor('运动', 2, undefined, metric(1, 0, 0, 0)), strict);
  const relaxed = thresholdFor('运动', 2, undefined, metric(0.98, 0.02, 200, 3));
  near(relaxed.ssim, 0.976);
  near(relaxed.大差比例_不算边, 0.024);
  assert.equal(relaxed.最大差异块, 240);
  near(relaxed.平均偏色, 3.6);
});

test('运动 SSIM 保留 0.95 下限，最大块只缩放原阈值', () => {
  const loose = thresholdFor('运动', 2, undefined, metric(0.8, 0.2, 200, 10));
  assert.equal(loose.ssim, 0.95);
  assert.equal(loose.最大差异块, 240);
  const small = thresholdFor('运动', 2, undefined, metric(0.99, 0, 20, 0));
  assert.equal(small.最大差异块, 128);
});

test('GPU 自差保持原来的收紧方向', () => {
  const actual = thresholdFor('GPU', 2, undefined, metric(0.999, 0.001, 2, 1));
  near(actual.ssim, 0.9988);
  near(actual.大差比例_不算边, 0.0012);
  near(actual.最大差异块, 2.4);
  near(actual.平均偏色, 1.2);
  assert.throws(() => thresholdFor('GPU'), /GPU/);
});

test('CLI 用参照根目录完整键查运动基准，并按双底比较的区域取值', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'motion-baseline-'));
  try {
    const ref = join(dir, 'ref');
    const a = join(ref, '素材甲', 'gain', '0@2x.png');
    const b = join(dir, 'candidate', '0@2x.png');
    const data = Buffer.alloc(16 * 12 * 4);
    for (let p = 0; p < data.length; p += 4) {
      data[p] = 90;
      data[p + 1] = 80;
      data[p + 2] = 70;
      data[p + 3] = 128;
    }
    const png = encodePng({ width: 16, height: 12, data });
    await mkdir(dirname(a), { recursive: true });
    await mkdir(dirname(b), { recursive: true });
    await writeFile(a, png);
    await writeFile(b, png);
    await writeFile(a.replace('.png', '.json'), JSON.stringify({ 文字区域: [{ x: 0, y: 0, width: 3, height: 12 }] }));
    const regions = { 全图: metric(0.97, 0.03, 200, 3), 非文字: metric(0.96, 0.04, 300, 4), 文字: metric(0.2, 1, 999, 99) };
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(baselinePath, JSON.stringify({ 线: '运动', 参照目录: ref, 帧: {
      '素材甲/gain/0@2x.png': regions,
      '素材乙/gain/0@2x.png': { 全图: metric(1, 0, 0, 0), 非文字: metric(1, 0, 0, 0) },
      '0@2x.png': { 全图: metric(1, 0, 0, 0), 非文字: metric(1, 0, 0, 0) },
    } }));
    for (const [label, aa, bb] of [['file', a, b], ['directory', dirname(a), dirname(b)]]) {
      const reportDir = join(dir, label);
      const code = await main([aa, bb, '--线', '运动', '--运动基准', baselinePath, '--报告', reportDir]);
      assert.equal(code, 0);
      const report = JSON.parse(await readFile(join(reportDir, '结果.json'), 'utf8'));
      assert.deepEqual(report.配对[0].运动基准, regions);
      const groups = report.配对[0].分组;
      near(groups.find(g => g.区域 === '全图').阈值.ssim, 0.964);
      const nontext = groups.find(g => g.区域 === '非文字');
      near(nontext.阈值.ssim, 0.952);
      assert.equal(nontext.阈值.最大差异块, 360);
      near(nontext.阈值.平均偏色, 4.8);
      assert.equal(groups.find(g => g.区域 === '文字').阈值.ssim, 0.98);
    }
    await writeFile(baselinePath, JSON.stringify({ 帧: { '0@2x.png': regions } }));
    const reportDir = join(dir, 'relative-fixture');
    assert.equal(await main([a, b, '--线', '运动', '--运动基准', baselinePath, '--报告', reportDir]), 0);
    const report = JSON.parse(await readFile(join(reportDir, '结果.json'), 'utf8'));
    near(report.配对[0].分组.find(g => g.区域 === '全图').阈值.ssim, 0.964);
    await writeFile(baselinePath, JSON.stringify({ 参照目录: ref, 帧: { '素材乙/gain/0@2x.png': regions } }));
    const missingDir = join(dir, 'missing-key');
    assert.equal(await main([a, b, '--线', '运动', '--运动基准', baselinePath, '--报告', missingDir]), 2);
    const missing = JSON.parse(await readFile(join(missingDir, '结果.json'), 'utf8'));
    assert.match(missing.配对[0].错误, /素材甲\/gain\/0@2x\.png/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
