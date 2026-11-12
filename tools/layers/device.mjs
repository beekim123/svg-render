import {identity, multiply, inverse, transformBounds, union, maxScale} from './math.mjs';
import {flatten, contentBounds, transformClips} from './compile.mjs';

export function structureLayers(scene, tracks) {
  const animated = new Set(tracks.map(track => track.node));
  const opacity = new Set(tracks.filter(track => track.property === 'opacity').map(track => track.node));
  const dynamic = new WeakMap();
  const mark = node => {
    const descendants = (node.children || []).map(mark);
    const active = node.type === 'layer' && animated.has(node.node) || descendants.some(Boolean);
    dynamic.set(node, active);
    return active;
  };
  mark(scene.nodes[0]);
  const layers = [];
  const preserve = (node, parent = null) => {
    const layer = {node: node.node, parent, opacity: node.opacity, animatedOpacity: opacity.has(node.node), clips: node.clips, children: []};
    layers.push(layer);
    let run = [];
    const flush = () => {
      if (run.length) layer.children.push({draw: run});
      run = [];
    };
    for (const child of node.children) {
      if (dynamic.get(child)) {
        flush();
        layer.children.push(preserve(child, node.node));
      } else {
        run.push(flatten(child));
      }
    }
    flush();
    return layer;
  };
  return {width: scene.width, height: scene.height, root: preserve(scene.nodes[0]), layers};
}

export function setReferenceRects(structure, references) {
  const visit = layer => {
    const matrix = references[layer.node];
    const bounds = [];
    for (const child of layer.children) {
      if (child.draw) {
        const rect = union(child.draw.map(contentBounds).filter(Boolean));
        if (rect) bounds.push(transformBounds(rect, matrix));
      } else {
        bounds.push(visit(child));
      }
    }
    if (layer.clips?.length) {
      layer.rect = union(layer.clips.flatMap(clip => clip.paths.map(item => transformBounds(item.bounds, multiply(matrix, item.matrix)))));
    } else {
      layer.rect = union(bounds);
    }
    layer.rect ||= [0, 0, 0, 0];
    return layer.rect;
  };
  visit(structure.root);
}

export function relativePose(layers, references, sample) {
  const result = {};
  for (const layer of layers) {
    const referenceInverse = inverse(references[layer.node]);
    // The equivalent local formula also works while an animated parent has scale(0).
    result[layer.node] = layer.parent === null
      ? multiply(sample.matrices[layer.node], referenceInverse)
      : multiply(multiply(references[layer.parent], sample.locals[layer.node]), referenceInverse);
  }
  return result;
}

function pixelRect(rect, scale) {
  const left = Math.floor(rect[0] * scale) - 1;
  const top = Math.floor(rect[1] * scale) - 1;
  const right = Math.ceil((rect[0] + rect[2]) * scale) + 1;
  const bottom = Math.ceil((rect[1] + rect[3]) * scale) + 1;
  return {pixels: [left, top, right - left, bottom - top], rect: [left / scale, top / scale, (right - left) / scale, (bottom - top) / scale]};
}

export function compileDeviceLayers(structure, {references, actions, opacities = {}}) {
  const samples = actions.flatMap(action => action.cache ? [...action.cache.values()] : action.samples);
  const poses = samples.map(sample => relativePose(structure.layers, references, sample));
  const jobs = [];
  const scales = {};
  for (const layer of structure.layers) {
    const referenceInverse = inverse(references[layer.node]);
    const largest = samples.reduce((largest, sample) => Math.max(largest, maxScale(multiply(sample.matrices[layer.node], referenceInverse))), 0);
    scales[layer.node] = Math.ceil(Math.min(2, Math.max(1, 2 * largest)) * 4) / 4;
  }
  const bake = (nodes, bounds, reference, scale, file) => {
    const box = pixelRect(bounds, scale);
    const raster = [scale, 0, 0, scale, -box.pixels[0], -box.pixels[1]];
    jobs.push({file: `textures/${file}`, scale: 1, scene: {width: box.pixels[2], height: box.pixels[3], nodes: nodes.map(node => flatten(node, multiply(raster, reference)))}});
    return {file: `../textures/${file}`, rect: box.rect, rasterScale: scale};
  };
  const visit = layer => {
    const reference = references[layer.node];
    const scale = scales[layer.node];
    const record = {node: layer.node, matrix: [...identity], opacity: opacities[layer.node] ?? layer.opacity, animatedOpacity: layer.animatedOpacity, rasterScale: scale, children: []};
    if (layer.clips?.length) {
      const clips = transformClips(layer.clips, reference);
      const bounds = union(clips.flatMap(clip => clip.paths.map(item => transformBounds(item.bounds, item.matrix))));
      const [x, y, width, height] = bounds;
      const white = {type: 'path', path: `M${x} ${y}H${x + width}V${y + height}H${x}Z`, matrix: [...identity], fill: {type: 'color', color: [1, 1, 1, 1]}, opacity: 1, clips};
      record.clips = bake([white], bounds, identity, scale, `mask-${layer.node}.png`);
    }
    let run = 0;
    for (const child of layer.children) {
      if (!child.draw) {
        record.children.push(visit(child));
        continue;
      }
      const localBounds = union(child.draw.map(contentBounds).filter(Boolean));
      if (!localBounds) continue;
      const image = bake(child.draw, transformBounds(localBounds, reference), reference, scale, `layer-${layer.node}-${run++}.png`);
      record.children.push({texture: image.file, rect: image.rect, rasterScale: scale});
    }
    if (record.clips) {
      record.rect = record.clips.rect;
    } else {
      const bounds = record.children.flatMap(child => child.texture ? [child.rect] : poses.map(pose => transformBounds(child.rect, pose[child.node])));
      record.rect = pixelRect(union(bounds) || [0, 0, 0, 0], scale).rect;
    }
    return record;
  };
  return {root: visit(structure.root), jobs};
}
