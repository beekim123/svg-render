import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createSceneExportSession} from '../scene/export.mjs';
import {installTimeline} from '../ref/page.mjs';
import {compileLayers} from './compile.mjs';
import {mergeVariants, migrateAssets, selectVariants} from './catalog.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const selected = args.flatMap((arg, index) => arg === '--id' ? [args[index + 1]] : []);
const output = path.resolve(option('--out', 'out/mac/新画法'));
const binary = path.resolve(option('--binary', 'out/mac/scene/scene-draw'));
const directory = path.join(output, 'layers');
const report = JSON.parse(await fs.readFile(path.join(output, '报告/参照.json'), 'utf8'));
const groups = selectVariants(report.动作, selected);
if (!groups.size) throw new Error(`没有所选动作：${selected.join(', ')}`);
await fs.mkdir(directory, {recursive: true});
let assets = [];
if (selected.length) {
  try {
    assets = migrateAssets(JSON.parse(await fs.readFile(path.join(directory, 'index.json'), 'utf8')).assets);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const session = await createSceneExportSession();
let actionCount = 0;
let textureCount = 0;
let variantCount = 0;

async function exportAction(source, action) {
  const valuesFile = path.join(output, 'values', source, `${action.动作}.json`);
  const values = JSON.parse(await fs.readFile(valuesFile, 'utf8'));
  const tracks = values.轨.map(track => {
    if (track.属性 === 'transform') return {node: track.节点号, property: 'transform', values: track.完整局部矩阵};
    if (track.属性 === 'opacity') return {node: track.节点号, property: 'opacity', values: track.值.map(Number)};
    throw new Error(`${valuesFile}：不支持轨道 ${track.节点号}/${track.属性}`);
  });
  if (values.时刻.at(-1) < action.值表范围) {
    const endpoint = path.join(output, 'ref', source, action.动作, `${action.值表范围}.svg`);
    await session.export({svg: await fs.readFile(endpoint, 'utf8'), source: endpoint});
    await session.browser.evaluate(`(${installTimeline.toString()})()`);
    const descriptors = values.轨.map(track => ({节点号: track.节点号, 属性: track.属性, 来自: track.来自}));
    const samples = await session.browser.evaluate(`__ref.read(${JSON.stringify(descriptors)})`);
    for (const [index, track] of tracks.entries()) {
      track.values.push(track.property === 'transform' ? samples[index].完整局部矩阵 : Number(samples[index].值));
    }
    values.时刻.push(action.值表范围);
  }
  let frozen = path.join(output, 'ref', source, action.动作, `${values.时刻[0]}.svg`);
  let svg = await fs.readFile(frozen, 'utf8');
  const singular = tracks.some(track => {
    if (track.property !== 'transform') return false;
    const matrix = track.values[0];
    return matrix[0] * matrix[3] - matrix[1] * matrix[2] === 0;
  });
  const hidden = /visibility\s*:\s*hidden\s*!important/;
  if (singular && hidden.test(svg)) {
    let replacement = null;
    for (const frame of action.帧.filter(frame => frame.倍率 === 1 && frame.时刻 > 0)) {
      const file = path.join(output, 'ref', source, action.动作, `${frame.时刻}.svg`);
      const candidate = await fs.readFile(file, 'utf8');
      if (hidden.test(candidate)) continue;
      replacement = {file, svg: candidate};
      break;
    }
    if (!replacement) throw new Error(`${source}/${action.动作}：没有非奇异冻结帧可用于纹理烘焙`);
    frozen = replacement.file;
    svg = replacement.svg;
    console.log(`${source}/${action.动作}：烘焙使用 ${path.basename(frozen)}`);
  }
  const scene = await session.export({svg, source: frozen, layers: true, tracks});
  const {root, jobs} = compileLayers(scene, {tracks, textureScale: 2});
  const target = path.join(directory, source, action.动作);
  await fs.mkdir(target, {recursive: true});
  for (const job of jobs) {
    const sceneFile = path.join(target, job.file.replace(/\.png$/, '.scene.json'));
    await fs.writeFile(sceneFile, JSON.stringify(job.scene));
    try {
      const result = spawnSync(binary, [sceneFile, '2', path.join(target, job.file)], {
        encoding: 'utf8',
        env: {...process.env, OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1', VECLIB_MAXIMUM_THREADS: '1'},
      });
      if (result.status !== 0) throw new Error(`${sceneFile}：${result.error?.message || result.stderr}`);
    } finally {
      await fs.rm(sceneFile);
    }
  }
  const bundle = {
    width: scene.width,
    height: scene.height,
    textureScale: 2,
    root,
    times: values.时刻,
    tracks,
    kind: action.种类,
    period: action.周期毫秒,
    duration: action.值表范围,
  };
  const bundleFile = path.join(target, 'bundle.json');
  await fs.writeFile(bundleFile, JSON.stringify(bundle));
  actionCount++;
  textureCount += jobs.length;
  console.log(`${source}/${action.动作}：${jobs.length} 张纹理，${tracks.length} 条轨`);
  return {name: action.动作, bundle: path.relative(directory, bundleFile)};
}

try {
  for (const group of groups.values()) {
    const updated = [];
    for (const variant of group.variants) {
      const entry = {source: variant.source, actions: []};
      for (const action of variant.actions) entry.actions.push(await exportAction(variant.source, action));
      updated.push(entry);
      variantCount++;
    }
    const asset = mergeVariants(assets.find(existing => existing.id === group.id), group.id, updated, report.动作);
    assets = assets.filter(existing => existing.id !== asset.id);
    assets.push(asset);
    await fs.writeFile(path.join(directory, 'index.json'), JSON.stringify({assets}, null, 2) + '\n');
  }
} finally {
  await session.close();
}
console.log(`分层完成：${groups.size} 件、${variantCount} 变体、${actionCount} 动作、${textureCount} 张纹理；${directory}/index.json`);
