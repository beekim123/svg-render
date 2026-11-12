import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createLayerSession} from './browser.mjs';
import {structureLayers, setReferenceRects, relativePose, compileDeviceLayers} from './device.mjs';
import {sampleAdaptive} from './sample.mjs';
import {inverse, maxScale} from './math.mjs';
import {mergeVariants, migrateAssets, selectVariants} from './catalog.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const selected = args.flatMap((arg, index) => arg === '--id' ? [args[index + 1]] : []);
const output = path.resolve(option('--out', 'out/mac/新画法'));
const binary = path.resolve(option('--binary', 'out/mac/scene/scene-draw'));
const directory = path.join(output, 'layers');
const report = JSON.parse(await fs.readFile(path.join(output, '报告/参照.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile('素材/新画法/清单.json', 'utf8'));
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
const session = await createLayerSession();
let variantCount = 0;
let actionCount = 0;
let textureBytes = 0;

async function exportVariant(group, variant) {
  const entry = manifest.find(asset => asset.id === group.id);
  const svg = await fs.readFile(entry.文件, 'utf8');
  const color = variant.source.includes('@') ? '#' + variant.source.split('@').at(-1) : undefined;
  const union = new Map();
  for (const summary of variant.actions) {
    const values = JSON.parse(await fs.readFile(path.join(output, 'values', variant.source, `${summary.动作}.json`), 'utf8'));
    for (const track of values.轨) union.set(`${track.节点号}/${track.属性}`, {node: track.节点号, property: track.属性});
  }
  const tracks = [...union.values()];
  const rest = await session.rest({svg, id: variant.source, color, tracks});
  const structure = structureLayers(rest.scene, tracks);
  const nodes = structure.layers.map(layer => layer.node);
  const actions = [];
  for (const summary of variant.actions) {
    const action = entry.动作.find(action => action.名字 === summary.动作.replace(/@switch\d+$/, ''));
    const base = {svg, id: variant.source, color, action, triggerTime: summary.触发毫秒};
    await session.load(base);
    const times = new Set(await session.keyTimes(summary.值表范围));
    for (let time = 0; time <= summary.值表范围; time += 20) times.add(time);
    const ordered = [...times].sort((a, b) => a - b);
    const cache = new Map();
    for (const time of ordered) cache.set(time, await session.sample(time, nodes));
    actions.push({summary, base, duration: summary.值表范围, times: ordered, cache});
  }
  const singular = nodes.filter(node => !inverse(rest.matrices[node]));
  let references = Object.fromEntries(nodes.map(node => [node, rest.matrices[node]]));
  const chooseReferences = () => {
    let changed = false;
    for (const node of singular) {
      const matrices = actions.flatMap(action => [...action.cache.values()].map(sample => sample.matrices[node]));
      const matrix = matrices.filter(matrix => inverse(matrix)).sort((a, b) => maxScale(b) - maxScale(a))[0];
      if (!matrix) throw new Error(`${variant.source} 节点 ${node} 所有姿态都不可逆：${JSON.stringify(references[node])}`);
      if (matrix.some((value, index) => value !== references[node][index])) changed = true;
      references[node] = matrix;
    }
    return changed;
  };
  chooseReferences();
  const rects = root => {
    const result = {};
    const visit = node => {
      if (node.texture) return;
      result[node.node] = node.rect;
      node.children.forEach(visit);
    };
    visit(root);
    return result;
  };
  setReferenceRects(structure, references);
  let compiled = compileDeviceLayers(structure, {references, actions, opacities: rest.opacities});
  let changed;
  do {
    const previous = rects(compiled.root);
    for (const layer of structure.layers) layer.rect = previous[layer.node];
    for (const action of actions) {
      await session.load(action.base);
      Object.assign(action, await sampleAdaptive(session, {layers: structure.layers, references, duration: action.duration, times: action.times, cache: action.cache}));
      console.log(`${variant.source}/${action.summary.动作}：${action.times.length} 样本`);
    }
    changed = chooseReferences();
    compiled = compileDeviceLayers(structure, {references, actions, opacities: rest.opacities});
    const next = rects(compiled.root);
    changed ||= structure.layers.some(layer => next[layer.node].some((value, index) => value !== previous[layer.node][index]));
  } while (changed);
  const target = path.join(directory, variant.source);
  await fs.rm(path.join(target, 'textures'), {recursive: true, force: true});
  await fs.mkdir(path.join(target, 'textures'), {recursive: true});
  let bytes = 0;
  for (const job of compiled.jobs) {
    const image = path.join(target, job.file);
    const sceneFile = image.replace(/\.png$/, '.scene.json');
    await fs.writeFile(sceneFile, JSON.stringify(job.scene));
    try {
      const result = spawnSync(binary, [sceneFile, String(job.scale), image], {encoding: 'utf8'});
      if (result.status !== 0) throw new Error(`${sceneFile}：${result.error?.message || result.stderr}`);
      bytes += (await fs.stat(image)).size;
    } finally {
      await fs.rm(sceneFile);
    }
  }
  const result = {source: variant.source, actions: [], samples: [], textureBytes: bytes, textureCount: compiled.jobs.length};
  for (const action of actions) {
    const poses = action.samples.map(sample => relativePose(structure.layers, references, sample));
    const runtime = structure.layers.flatMap(layer => {
      const values = [{node: layer.node, property: 'transform', values: poses.map(pose => pose[layer.node])}];
      const opacity = action.samples.map(sample => sample.opacities[layer.node]);
      if (layer.animatedOpacity || opacity.some(value => value !== rest.opacities[layer.node])) values.push({node: layer.node, property: 'opacity', values: opacity});
      return values;
    });
    const actionDirectory = path.join(target, action.summary.动作);
    await fs.rm(actionDirectory, {recursive: true, force: true});
    await fs.mkdir(actionDirectory, {recursive: true});
    const bundleFile = path.join(actionDirectory, 'bundle.json');
    await fs.writeFile(bundleFile, JSON.stringify({width: structure.width, height: structure.height, textureScale: 2, root: compiled.root, times: action.times, tracks: runtime, kind: action.summary.种类, period: action.summary.周期毫秒, duration: action.duration}));
    result.actions.push({name: action.summary.动作, bundle: path.relative(directory, bundleFile)});
    result.samples.push({action: action.summary.动作, count: action.times.length});
    actionCount++;
  }
  textureBytes += bytes;
  variantCount++;
  console.log(`${variant.source}：共用 ${compiled.jobs.length} 张纹理，${(bytes / 1e6).toFixed(3)} MB`);
  return result;
}

try {
  for (const group of groups.values()) {
    const updated = [];
    for (const variant of group.variants) updated.push(await exportVariant(group, variant));
    const asset = mergeVariants(assets.find(existing => existing.id === group.id), group.id, updated, report.动作);
    assets = assets.filter(existing => existing.id !== asset.id);
    assets.push(asset);
    await fs.writeFile(path.join(directory, 'index.json'), JSON.stringify({assets}, null, 2) + '\n');
  }
} finally {
  await session.close();
}
console.log(`分层完成：${groups.size} 件、${variantCount} 变体、${actionCount} 动作、纹理 ${(textureBytes / 1e6).toFixed(3)} MB`);
