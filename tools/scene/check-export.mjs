import assert from 'node:assert/strict';
import {createSceneExportSession} from './export.mjs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60" viewBox="0 0 40 30">
<defs>
  <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff" stop-opacity=".5"/></linearGradient>
  <radialGradient id="radial" gradientUnits="userSpaceOnUse" cx="12" cy="13" r="7"><stop offset="0" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient>
  <pattern id="hatch" width="4" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#123456" stroke-width=".5"/></pattern>
  <clipPath id="clip"><rect x="1" y="2" width="16" height="18" rx="2"/><circle cx="20" cy="20" r="3"/></clipPath>
</defs>
<g opacity=".5" transform="translate(3 4)" clip-path="url(#clip)">
  <rect x="1" y="2" width="10" height="8" fill="url(#gradient)" fill-opacity=".4" stroke="currentColor" style="color:#2468ac" stroke-dasharray="3 2 1" stroke-dashoffset="2"/>
  <ellipse cx="12" cy="13" rx="7" ry="4" fill="url(#radial)"/>
  <path d="M0 0H24V24H0Z" fill="url(#hatch)" fill-opacity=".3"/>
</g></svg>`;

const session = await createSceneExportSession();
try {
  const scene = await session.export({svg, source: 'scene exporter fixture'});
  assert.deepEqual([scene.width, scene.height], [80, 60]);
  const group = scene.nodes[0];
  assert.equal(group.type, 'group');
  assert.equal(group.opacity, .5);
  assert.equal(group.clips[0].paths.length, 2);
  const [rect, ellipse, patterned] = group.children;
  assert.deepEqual(rect.matrix, [2, 0, 0, 2, 6, 8]);
  assert.equal(rect.fill.type, 'linear');
  assert.deepEqual(rect.fill.matrix, [20, 0, 0, 16, 8, 12]);
  assert.deepEqual(rect.fill.stops.map(stop => stop.color[3]), [.4, .2]);
  assert.deepEqual(rect.stroke.color, [36 / 255, 104 / 255, 172 / 255, 1]);
  assert.deepEqual(rect.strokeDasharray, [3, 2, 1, 3, 2, 1]);
  assert.equal(rect.strokeDashoffset, 2);
  assert.equal(rect.pathLength, null);
  assert.match(ellipse.path, /^M/);
  assert.deepEqual(ellipse.fill.points, [12, 13, 0, 12, 13, 7]);
  assert.equal(patterned.fill.type, 'pattern');
  assert.equal(patterned.fill.opacity, .3);
  assert.deepEqual(patterned.fill.tile, [0, 0, 4, 5]);
  assert.deepEqual(patterned.fill.nodes[0].matrix, [1, 0, 0, 1, 0, 0]);
  assert.equal(patterned.fill.nodes[0].strokeWidth, .5);
  const calibrated = await session.export({source: 'pathLength dash calibration', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 200 300">
    <g fill="none" stroke="black">
      <line id="line" x1="0" y1="0" x2="10" y2="0" pathLength="1" stroke-dasharray=".2 .8" stroke-dashoffset=".1"/>
      <circle id="circle" cx="40" cy="40" r="12" pathLength="15" stroke-dasharray=".04 .96" stroke-dashoffset=".1"/>
      <rect id="rect" x="14.3" y="14.3" width="171.4" height="183.4" rx="5.8" pathLength="112" stroke-dasharray=".02 .98" stroke-dashoffset=".1"/>
      <ellipse id="ellipse" cx="60" cy="60" rx="10.5" ry="7.8" pathLength="12" stroke-dasharray=".05 .95" stroke-dashoffset=".1"/>
      <path id="mirror" d="M60.5 70A31.5 39.5 0 1 1 123.5 70A31.5 39.5 0 1 1 60.5 70Z" pathLength="44" stroke-dasharray=".02 .98" stroke-dashoffset=".1"/>
    </g>
  </svg>`});
  for (const [index, pathLength, firstDash] of [[0, 1, .2], [1, 15, .04], [2, 112, .02], [3, 12, .05], [4, 44, .02]]) {
    const node = calibrated.nodes[index];
    assert.equal(node.pathLength, pathLength);
    assert.deepEqual(node.strokeDasharray, [firstDash, 1 - firstDash]);
    assert.equal(node.strokeDashoffset, .1);
  }
  await assert.rejects(session.export({svg: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><text>bad</text></svg>'}), /<text>/);
  console.log('场景导出：尺寸、变换、组合透明度、裁剪、渐变、pattern、虚线、pathLength 和不支持元素通过');
} finally {
  await session.close();
}
