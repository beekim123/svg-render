import {identity, interpolate, inverse, multiply, point} from './math.mjs';
import {relativePose} from './device.mjs';

export async function sampleAdaptive(session, {layers, references, duration, times, cache = new Map()}) {
  const nodes = layers.map(layer => layer.node);
  const referenceInverses = Object.fromEntries(layers.map(layer => [layer.node, inverse(references[layer.node])]));
  const corners = Object.fromEntries(layers.map(({node, rect: [x, y, width, height]}) => [node, [
    [x, y], [x + width, y], [x, y + height], [x + width, y + height],
  ]]));
  const retained = new Set([0, ...times, duration]);
  const initial = [...retained].sort((a, b) => a - b);
  const poses = new Map();
  const read = async time => {
    if (!cache.has(time)) cache.set(time, await session.sample(time, nodes));
    return cache.get(time);
  };
  const pose = time => {
    if (!poses.has(time)) poses.set(time, relativePose(layers, references, cache.get(time)));
    return poses.get(time);
  };
  const refine = async (start, end) => {
    const middle = (start + end) / 2;
    const actual = await read(middle);
    if (end - start <= 1) return;
    const first = cache.get(start);
    const last = cache.get(end);
    const firstPose = pose(start);
    const lastPose = pose(end);
    const predicted = {};
    let split = false;
    for (const {node, parent} of layers) {
      const local = interpolate(firstPose[node], lastPose[node], .5);
      predicted[node] = multiply(parent === null ? identity : predicted[parent], local);
      const truth = multiply(actual.matrices[node], referenceInverses[node]);
      for (const corner of corners[node]) {
        const expectedPoint = point(truth, corner);
        const predictedPoint = point(predicted[node], corner);
        const error = Math.hypot(expectedPoint[0] - predictedPoint[0], expectedPoint[1] - predictedPoint[1]) * 2;
        if (error > .25) split = true;
      }
      const opacity = first.opacities[node] + (last.opacities[node] - first.opacities[node]) * .5;
      if (Math.abs(opacity - actual.opacities[node]) > 1 / 255) split = true;
    }
    if (!split) return;
    retained.add(middle);
    await refine(start, middle);
    await refine(middle, end);
  };
  for (const time of initial) await read(time);
  for (let index = 1; index < initial.length; index++) await refine(initial[index - 1], initial[index]);
  const resultTimes = [...retained].sort((a, b) => a - b);
  return {times: resultTimes, samples: resultTimes.map(time => cache.get(time)), cache};
}
