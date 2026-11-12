import assert from 'node:assert/strict';
import {compileLayers} from './compile.mjs';

const I = [1, 0, 0, 1, 0, 0];
const shape = (extra = {}) => ({type: 'path', path: 'M-8 -7H4V3H-8Z', bounds: [-8, -7, 12, 10], matrix: I, fill: {type: 'linear', matrix: [12, 0, 0, 10, -8, -7]}, opacity: 1, clips: [], ...extra});
const pattern = {type: 'pattern', matrix: I, nodes: [shape()], tile: [0, 0, 4, 5]};
const scene = {width: 80, height: 60, nodes: [{type: 'layer', node: 0, matrix: [2, 0, 0, 2, 0, 0], opacity: 1, clips: [], children: [
  {type: 'layer', node: 10, matrix: [1, 0, 0, 1, 3, 4], opacity: .5, clips: [{paths: [{path: 'M-10 -8H22V22H-10Z', matrix: I, bounds: [-10, -8, 32, 30]}]}], children: [
    {type: 'layer', node: 11, matrix: [1, 0, 0, 1, 2, 1], opacity: .6, clips: [], children: [shape({fill: pattern})]},
    {type: 'layer', node: 12, matrix: I, opacity: 0, clips: [], children: [shape()]},
    shape(),
  ]},
]}]};
const {root, jobs} = compileLayers(scene, {tracks: [{node: 12, property: 'opacity'}]});
assert.deepEqual(root.matrix, [2, 0, 0, 2, 0, 0]);
const group = root.children[0];
assert.equal(group.opacity, .5);
assert.equal(group.children.length, 3);
assert.equal(group.children[1].node, 12);
assert.equal(group.children[1].opacity, 0);
assert.ok(group.children[1].children[0].texture);
assert.ok(group.children[0].rect[0] < 0);
assert.ok(group.clips.file);
const first = jobs.find(job => job.file === group.children[0].texture);
const staticGroup = first.scene.nodes[0];
assert.equal(staticGroup.type, 'group');
assert.equal(staticGroup.opacity, .6);
const drawn = staticGroup.children[0];
assert.equal(drawn.fill.type, 'pattern');
assert.deepEqual(drawn.fill.nodes[0].matrix, I);
assert.deepEqual(drawn.matrix, drawn.fill.matrix);
assert.equal(drawn.matrix[4] + first.rect[0], 2);
assert.equal(drawn.matrix[5] + first.rect[1], 1);
const mask = jobs.find(job => job.file === group.clips.file);
assert.equal(mask.scene.nodes[0].fill.color[3], 1);
assert.equal(mask.scene.nodes[0].clips.length, 1);
assert.deepEqual(mask.scene.nodes[0].clips[0].paths[0].matrix.slice(0, 4), [1, 0, 0, 1]);
const movingScene = {width: 80, height: 60, nodes: [{type: 'layer', node: 0, matrix: [2, 0, 0, 2, 0, 0], opacity: 1, clips: [], children: [
  {type: 'layer', node: 1, matrix: [1, 0, 0, 1, 100, 200], opacity: 1, clips: [], children: [
    {type: 'layer', node: 2, matrix: [2, 0, 0, 2, 3, 4], opacity: 0, clips: [], children: [shape()]},
  ]},
]}]};
const moving = compileLayers(movingScene, {tracks: [{node: 2, property: 'transform', values: [[1, 0, 0, 1, -20, 5], [1, 0, 0, 1, 30, -10]]}]}).root;
assert.deepEqual(moving.children[0].children[0].rect, [-8.5, -7.5, 13, 11]);
assert.deepEqual(moving.children[0].rect, [-54, -31, 126, 52]);
assert.deepEqual(moving.rect, [46, 169, 126, 52]);
console.log('分层编译：静态连续段顺序、矩阵累乘、负坐标纹理、运行时组 alpha/clip、透明动画内容、pattern 内部坐标及全时段层范围通过');
