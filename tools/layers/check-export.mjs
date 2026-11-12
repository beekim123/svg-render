import assert from 'node:assert/strict';
import {createSceneExportSession} from '../scene/export.mjs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 40 30" data-svg-render-node="0">
<defs>
  <linearGradient id="gradient"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient>
  <pattern id="hatch" width="4" height="5" patternUnits="userSpaceOnUse"><path d="M0 0H2V5H0Z" fill="white"/></pattern>
  <clipPath id="clip"><rect x="-10" y="-8" width="32" height="30"/></clipPath>
</defs>
<g data-svg-render-node="10" transform="translate(3 4)" opacity=".5" clip-path="url(#clip)">
  <g data-svg-render-node="11" transform="translate(2 1)">
    <path data-svg-render-node="12" transform="translate(5 6)" opacity="0" d="M-8 -7H4V3H-8Z" fill="url(#gradient)"/>
    <path data-svg-render-node="13" d="M0 0H4V4H0Z" fill="url(#hatch)"/>
  </g>
  <path data-svg-render-node="14" transform="translate(1 2)" opacity=".78" d="M-3 -2H2V2H-3Z"/>
</g></svg>`;

const session = await createSceneExportSession();
try {
  const scene = await session.export({svg, layers: true, tracks: [{node: 12, property: 'transform'}, {node: 12, property: 'opacity'}, {node: 14, property: 'transform'}]});
  const root = scene.nodes[0];
  assert.equal(root.type, 'layer');
  assert.deepEqual(root.matrix, [2, 0, 0, 2, 0, 0]);
  const group = root.children[0];
  assert.equal(group.opacity, .5);
  assert.deepEqual(group.matrix, [1, 0, 0, 1, 3, 4]);
  assert.deepEqual(group.clips[0].paths[0].matrix, [1, 0, 0, 1, 0, 0]);
  const nested = group.children[0];
  assert.deepEqual(nested.matrix, [1, 0, 0, 1, 2, 1]);
  const animated = nested.children[0];
  assert.equal(animated.node, 12);
  assert.equal(animated.opacity, 1);
  assert.deepEqual(animated.matrix, [1, 0, 0, 1, 0, 0]);
  const shape = animated.children[0];
  assert.equal(shape.type, 'path');
  assert.equal(shape.opacity, 1);
  assert.deepEqual(shape.matrix, [1, 0, 0, 1, 0, 0]);
  assert.deepEqual(shape.bounds, [-8, -7, 12, 10]);
  assert.deepEqual(shape.fill.matrix, [12, 0, 0, 10, -8, -7]);
  const patterned = nested.children[1];
  assert.equal(patterned.fill.nodes[0].type, 'path');
  assert.deepEqual(patterned.fill.nodes[0].matrix, [1, 0, 0, 1, 0, 0]);
  assert.equal(group.children[1].opacity, .78);
  console.log('分层导出：viewBox、嵌套矩阵、匿名节点、初始零透明度、负坐标、组裁剪/alpha、渐变和 pattern 通过');
} finally {
  await session.close();
}
