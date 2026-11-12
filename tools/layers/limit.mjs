import {identity, interpolate, maxScale, multiply} from './math.mjs';

const tolerance = 1e-6;
// Claude confirmed these frames in HANDOFF; enlargement alone does not identify the cause of other frames' differences.
const confirmedFrames = new Set(['新画法/ui_heart/gain/279.0587@2x.png', '新画法/ui_heart/gain/350@2x.png']);

function sampleInterval(times, time) {
  time = Math.min(times.at(-1), Math.max(times[0], time));
  let first = 0;
  let following = times.length - 1;
  while (first + 1 < following) {
    const middle = Math.floor((first + following) / 2);
    if (times[middle] <= time) first = middle;
    else following = middle;
  }
  const weight = first === following ? 0 : (time - times[first]) / (times[following] - times[first]);
  return {first, following, weight};
}

const hasArea = rect => rect?.[2] > 0 && rect?.[3] > 0;

export function densityLimitEvidence(bundle, time, outputScale) {
  const {first, following, weight} = sampleInterval(bundle.times, time);
  const transforms = new Map();
  const opacities = new Map();
  for (const track of bundle.tracks) {
    const a = track.values[first];
    const b = track.values[following];
    if (track.property === 'transform') transforms.set(track.node, interpolate(a, b, weight));
    if (track.property === 'opacity') opacities.set(track.node, a + (b - a) * weight);
  }
  const layers = [];
  const add = (node, matrix, rasterScale) => {
    const scale = maxScale(matrix);
    if (scale <= 1 + tolerance || scale * outputScale <= rasterScale + tolerance || rasterScale < 2 - tolerance) return;
    if (!layers.some(layer => layer.node === node && layer.rasterScale === rasterScale)) layers.push({node, scale, rasterScale});
  };
  const visit = (record, parentMatrix, visible, parentNode) => {
    if (record.texture) {
      if (!visible || !hasArea(record.rect)) return false;
      add(parentNode, parentMatrix, record.rasterScale ?? bundle.textureScale);
      return true;
    }
    const opacity = opacities.get(record.node) ?? record.opacity;
    if (!visible || opacity <= 0 || record.clips && !hasArea(record.clips.rect)) return false;
    const matrix = multiply(parentMatrix, transforms.get(record.node) ?? record.matrix);
    let content = false;
    for (const child of record.children) {
      if (visit(child, matrix, true, record.node)) content = true;
    }
    // These are the same nodes that allocate a SubViewport in layer_player.gd.
    const composite = record.clips || record.opacity !== 1 || opacities.has(record.node);
    if (content && composite && hasArea(record.rect)) add(record.node, matrix, record.rasterScale ?? bundle.textureScale);
    return content;
  };
  visit(bundle.root, identity, true, null);
  return {enlarged: layers.length > 0, layers};
}

export function isDensityLimit(row, evidence) {
  if (!confirmedFrames.has(row.路径)) return false;
  if (row.错误 || row.通过 !== false || !row.运动基准 || !evidence.enlarged) return false;
  const regions = row.分组.some(region => region.区域 === '非文字') ? row.分组.filter(region => region.区域 !== '全图') : row.分组;
  let failedSSIM = false;
  for (const region of regions) {
    if (region.指标.ssim < 0.95) return false;
    if (region.通过) continue;
    if (region.线 !== '运动' || region.未通过.length !== 1 || region.未通过[0] !== 'ssim') return false;
    failedSSIM = true;
  }
  return failedSSIM;
}
