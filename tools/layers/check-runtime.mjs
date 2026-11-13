import assert from 'node:assert/strict';
import {runtimeScene, restoreReferences} from './runtime.mjs';
import {identity, multiply} from './math.mjs';

const draw = [{type: 'path', path: 'M0 0H3V4H0Z', matrix: identity, opacity: 1}];
const clip = [{paths: [{path: 'M0 0H2V2H0Z', matrix: [1, 0, 0, 1, .25, .5]}]}];
const child = {node: 10, parent: 0, opacity: 1, clips: clip, children: [{draw}]};
const root = {node: 0, parent: null, opacity: 1, clips: [], children: [child]};
const structure = {width: 80, height: 60, root, layers: [root, child]};
const references = {0: [2, 0, 0, 2, .5, 1], 10: [0, 2, -2, 0, 10.25, 20.5]};
const scene = runtimeScene(structure, references, {0: 1, 10: .78});
assert.deepEqual(scene, {width: 80, height: 60, root: {
  node: 0, reference: references[0], opacity: 1, clips: [], children: [{
    node: 10, reference: references[10], opacity: .78, clips: clip, children: [{draw}],
  }],
}});
assert.equal(JSON.stringify(scene).includes('.png'), false);

const action = {times: [0, 20], tracks: [
  {node: 0, property: 'transform', values: [[0, 0, 0, 0, 0, 0], [1, 0, 0, 1, 3, 4]]},
  {node: 10, property: 'transform', values: [identity, [0, 1, -1, 0, 5, 6]]},
]};
const global = multiply(action.tracks[0].values[1], action.tracks[1].values[1]);
const calls = [];
const recovered = await restoreReferences(structure, {0: references[0], 10: [0, 0, 0, 0, 1, 2]}, [action], async (selected, time, nodes) => {
  calls.push({selected, time, nodes});
  return {matrices: {10: multiply(global, references[10])}};
});
assert.deepEqual(recovered, references);
assert.deepEqual(calls, [{selected: action, time: 20, nodes: [10]}]);
console.log('运行时场景：局部绘制/裁剪、完整参考、静态透明度及相对D恢复奇异静止参考通过');
