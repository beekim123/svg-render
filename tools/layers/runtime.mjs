import {identity, inverse, multiply} from './math.mjs';

export function runtimeScene(structure, references, opacities = {}) {
  const visit = layer => ({
    node: layer.node,
    reference: references[layer.node],
    opacity: opacities[layer.node] ?? layer.opacity,
    clips: layer.clips || [],
    children: layer.children.map(child => child.draw ? {draw: child.draw} : visit(child)),
  });
  return {width: structure.width, height: structure.height, root: visit(structure.root)};
}

export async function restoreReferences(structure, matrices, actions, read) {
  const references = Object.fromEntries(structure.layers.map(layer => [layer.node, matrices[layer.node]]));
  const pending = new Set(structure.layers.filter(layer => !inverse(references[layer.node])).map(layer => layer.node));
  for (const action of actions) {
    if (!pending.size) break;
    const transforms = new Map(action.tracks.filter(track => track.property === 'transform').map(track => [track.node, track.values]));
    for (const [index, time] of action.times.entries()) {
      const global = {};
      for (const layer of structure.layers) {
        global[layer.node] = multiply(layer.parent === null ? identity : global[layer.parent], transforms.get(layer.node)[index]);
      }
      const available = [...pending].filter(node => inverse(global[node]));
      if (available.length) {
        const sample = await read(action, time, available);
        for (const node of available) {
          references[node] = multiply(inverse(global[node]), sample.matrices[node]);
          pending.delete(node);
        }
      }
      if (!pending.size) break;
    }
  }
  if (pending.size) throw new Error(`没有可逆的运行时参考姿态：${[...pending].join(', ')}`);
  return references;
}
