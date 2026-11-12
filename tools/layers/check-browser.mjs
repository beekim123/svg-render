import assert from 'node:assert/strict';
import {createLayerSession} from './browser.mjs';

// Omitting delay/alternate/ambient phase loses the hand-derived times below;
// freezing the first animated frame loses the unanimated rest translation.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
<style>
@keyframes pulse {0%{transform:translateX(0)}50%{transform:translateX(20px)}100%{transform:translateX(0)}}
@keyframes ambient {0%{opacity:1}25%{opacity:.3}100%{opacity:1}}
.go #moving {animation:pulse 400ms 50ms 2 alternate linear both}
#ambient {animation:ambient 800ms infinite alternate linear}
</style>
<g id="static" transform="translate(30 40) rotate(90)">
<g id="moving" transform="translate(3 4)" opacity=".7"><rect id="shape" width="10" height="8" fill="currentColor"/></g>
</g>
<rect id="ambient" x="60" y="60" width="5" height="5" opacity=".6"/>
</svg>`;
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} != ${expected}`);
const session = await createLayerSession();
try {
  await session.load({svg, id: 'layer-sampling-fixture', color: '#3FE3F0', action: {名字: 'play', 触发: {class: 'go'}}});
  const nodes = await session.browser.evaluate(`Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, Number(element.getAttribute('data-svg-render-node'))]))`);
  const times = await session.keyTimes(850);
  for (const time of [0, 50, 250, 400, 450, 600, 650, 800, 850]) {
    assert.ok(times.some(value => Math.abs(value - time) < 1e-6), `缺少关键时刻 ${time}: ${times}`);
  }
  assert.ok(times.every(time => time >= 0 && time <= 850));
  const sample = await session.sample(250, [0, nodes.static, nodes.moving, nodes.shape]);
  assert.deepEqual(Object.keys(sample.matrices).map(Number).sort((a, b) => a - b), [0, nodes.static, nodes.moving, nodes.shape].sort((a, b) => a - b));
  for (const node of [nodes.moving, nodes.shape]) {
    const matrix = sample.matrices[node];
    near(matrix[0], 0, '全局旋转 a');
    near(matrix[1], 1, '全局旋转 b');
    near(matrix[2], -1, '全局旋转 c');
    near(matrix[4], 30, '250ms 全局 x');
    near(matrix[5], 60, '250ms 全局 y');
  }
  near(sample.opacities[nodes.moving], .7, '未动画 opacity');
  near(sample.locals[nodes.moving][4], 20, '尖点完整局部 x');
  near(sample.locals[nodes.moving][5], 0, '尖点完整局部 y');
  const ambient = await session.sample(400, [nodes.ambient]);
  near(ambient.opacities[nodes.ambient], .3, '触发前 ambient 相位与 alternate');
  const tracks = [{node: nodes.moving, property: 'transform'}, {node: nodes.ambient, property: 'opacity'}];
  const rest = await session.rest({svg, id: 'layer-rest-fixture', color: '#3FE3F0', tracks});
  const matrix = rest.matrices[nodes.moving];
  near(matrix[0], 0, '静止祖先旋转 a');
  near(matrix[1], 1, '静止祖先旋转 b');
  near(matrix[4], 26, '去动画静止 x');
  near(matrix[5], 43, '去动画静止 y');
  near(rest.opacities[nodes.ambient], .6, '去全部动画 opacity');
  const group = rest.scene.nodes[0].children[0];
  assert.equal(group.node, nodes.static);
  const moving = group.children[0];
  assert.equal(moving.node, nodes.moving);
  assert.deepEqual(moving.matrix, [1, 0, 0, 1, 0, 0]);
  assert.deepEqual(moving.children[0].fill.color, [63 / 255, 227 / 255, 240 / 255, 1]);
  assert.equal(await session.browser.evaluate('document.getAnimations().length'), 0);
  await session.load({svg, action: {名字: '待机'}});
  const idle = await session.keyTimes(800);
  assert.ok(idle.some(value => Math.abs(value - 200) < 1e-6), `待机起点: ${idle}`);
  const singularSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><style>@keyframes reveal{from{transform:scale(0)}to{transform:scale(1)}}.go #parent{animation:reveal 100ms linear both}</style><g id="parent"><g id="child" transform="translate(3 4)"><rect width="5" height="5"/></g></g></svg>`;
  await session.load({svg: singularSvg, action: {名字: 'gain', 触发: {class: 'go'}}});
  const child = await session.browser.evaluate(`Number(document.getElementById('child').getAttribute('data-svg-render-node'))`);
  const singular = await session.sample(0, [child]);
  assert.equal(singular.matrices[child][0], 0);
  assert.deepEqual(singular.locals[child], [1, 0, 0, 1, 3, 4]);
  console.log('Chrome 分层采样：延迟/迭代/alternate/ambient 关键时刻、250ms 尖点、全局矩阵、静止祖先与去动画纹理通过');
} finally {
  await session.close();
}
