import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {PNG} from 'pngjs';
import {writeStageReport} from './report.mjs';

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'scene-report-'));
const reportDirectory = path.join(temporary, 'report');
const referenceDirectory = path.join(temporary, 'out', 'ref-img');
const skiaDirectory = path.join(temporary, 'out', 'skia');
const detailsFile = path.join(temporary, 'out', 'compare', '结果.json');
const png = new PNG({width: 8, height: 8});
png.data.fill(255);
const encoded = PNG.sync.write(png);
const picture = `data:image/png;base64,${encoded.toString('base64')}`;
const row = (name, passed) => ({
  路径: `新画法/fixture/${name}@1x.png`,
  甲: path.join(temporary, 'out', 'ref-img', '新画法', 'fixture', `${name}@1x.png`),
  乙: path.join(temporary, 'out', 'skia', '新画法', 'fixture', `${name}@1x.png`),
  倍率: 1,
  通过: passed,
  分组: [{区域: '全图', 通过: passed, 未通过: passed ? [] : ['ssim'], 指标: {ssim: passed ? 1 : .9}}],
});
const passing = row('idle-0', true);
const failing = row('idle-20', false);
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const run = args => spawnSync(process.execPath, args, {encoding: 'utf8'});

try {
  await writeStageReport(reportDirectory, {rows: [passing, failing], worst: [], detailsFile, referenceDirectory, skiaDirectory});
  let report = await json(path.join(reportDirectory, '结果.json'));
  assert.equal(report.汇总.帧数, 2);
  assert.equal(report.汇总.通过帧数, 1);
  assert.deepEqual(report.未过帧.map(item => item.路径), ['新画法/fixture/idle-20@1x.png']);
  assert.equal(JSON.stringify(report).includes('idle-0@1x.png'), false);
  assert.equal((await json(detailsFile)).帧.length, 2);

  const pictures = {甲: picture, 乙: picture, 差异: picture};
  await writeStageReport(reportDirectory, {rows: [passing, failing], worst: [{...passing, 图片: pictures}, {...failing, 图片: pictures}], detailsFile, referenceDirectory, skiaDirectory});
  await writeStageReport(reportDirectory, {rows: [passing], worst: [{...passing, 图片: pictures}], detailsFile, referenceDirectory, skiaDirectory});
  assert.equal((await fs.readdir(path.join(reportDirectory, '帧'))).length, 3);
  let result = run(['tools/scene/handoff.mjs', reportDirectory]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await json(path.join(reportDirectory, '未过线.json'))).素材.length, 0);

  for (const file of [failing.甲, failing.乙]) {
    await fs.mkdir(path.dirname(file), {recursive: true});
    await fs.writeFile(file, encoded);
  }
  const frozen = path.join(temporary, 'out', 'ref', '新画法', 'fixture', 'idle-20.svg');
  const scene = path.join(temporary, 'out', 'scene', '新画法', 'fixture', 'idle-20@1x.json');
  for (const file of [frozen, scene]) {
    await fs.mkdir(path.dirname(file), {recursive: true});
    await fs.writeFile(file, file.endsWith('.svg') ? '<svg/>' : '{}');
  }
  await writeStageReport(reportDirectory, {rows: [failing], worst: [], detailsFile, referenceDirectory, skiaDirectory});
  result = run(['tools/scene/handoff.mjs', reportDirectory]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await json(path.join(reportDirectory, '未过线.json'))).素材.length, 1);
  assert.equal(await fs.readFile(path.join(reportDirectory, '未过线图', 'fixture.svg'), 'utf8'), '<svg/>');

  const root = path.join(temporary, 'batch');
  for (const id of ['fixture', 'fixture@abcdef', 'unselected']) {
    for (const directory of ['ref', 'ref-img', 'skia']) {
      const file = path.join(root, directory, '新画法', id, 'idle-0@1x.png');
      await fs.mkdir(path.dirname(file), {recursive: true});
      const image = new PNG({width: 8, height: 8});
      image.data.fill(directory === 'ref' ? 0 : 255);
      await fs.writeFile(file, PNG.sync.write(image));
    }
  }
  result = run(['tools/scene/batch.mjs', 'compare', '--out', root, '--ref', path.join(root, 'ref-img'), '--id', '新画法/fixture', '--report', reportDirectory]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  report = await json(path.join(reportDirectory, '结果.json'));
  assert.equal(report.汇总.帧数, 2);
  assert.equal(report.汇总.素材数, 1);
  assert.equal(report.汇总.通过帧数, 2);
  const details = await json(path.join(root, 'compare', '结果.json'));
  assert.equal(details.帧.length, 2);
  assert.equal(details.帧.every(item => item.甲.includes(`${path.sep}ref-img${path.sep}`)), true);
  console.log('阶段报告：未过帧精简、out 全部明细、重写清图、交接与整图参照选择通过');
} finally {
  await fs.rm(temporary, {recursive: true, force: true});
}
