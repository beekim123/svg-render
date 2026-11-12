import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const math = await import('./math.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return null;
});
assert.ok(math, '共享矩阵与插值公式尚未实现');
const {identity, multiply, inverse, point, transformBounds, union, maxScale, interpolate} = math;
const close = (actual, expected, label) => {
  assert.equal(actual.length, expected.length, label);
  for (let index = 0; index < actual.length; index++) {
    assert.ok(Math.abs(actual[index] - expected[index]) <= 1e-5, `${label}[${index}]: ${actual[index]} != ${expected[index]}`);
  }
};
const pose = (rotation, sx, sy, skew = 0, x = 0, y = 0) => [
  Math.cos(rotation) * sx, Math.sin(rotation) * sx,
  -Math.sin(rotation + skew) * sy, Math.cos(rotation + skew) * sy, x, y,
];
const cases = [
  {a: identity, b: pose(Math.PI / 2, 1, 1), w: .5},
  {a: pose(3.1, 2, 3), b: pose(-3.1, 4, 1), w: .4},
  {a: pose(.3, 2, -3, .2), b: pose(-.6, 1, -2, -.4), w: .37},
  {a: pose(.3, 2, 3, .2), b: pose(-.6, 1, 2, -.4), w: .61},
  {a: pose(.8, 0, 2), b: pose(-.2, 2, 3), w: .5},
  {a: pose(-.9, 3, 0), b: pose(.2, 2, -4), w: .75},
  {a: [0, 0, 0, 0, 10, -20], b: pose(.5, 2, 3, -.3, 1e6, -2e6), w: .25},
  {a: [1, 2, 2, 4, 0, 0], b: pose(.4, 3, 2, .1), w: .5},
  {a: pose(.2, 2, -3, -.3, 20, 40), b: pose(-1, 1, 5, .4, -20, -40), w: .5},
];
for (const {a, b} of [...cases]) {
  cases.push({a, b, w: 0}, {a, b, w: 1}, {a, b: a, w: .43});
}
const rotated = interpolate(identity, pose(Math.PI / 2, 1, 1), .5);
close(rotated, [Math.SQRT1_2, Math.SQRT1_2, -Math.SQRT1_2, Math.SQRT1_2, 0, 0], '45度旋转');
assert.ok(Math.abs(Math.hypot(rotated[0], rotated[1]) - 1) < 1e-12);
for (const {a} of cases) close(interpolate(a, a, .43), a, '相同姿态');
assert.ok(interpolate(cases[2].a, cases[2].b, .5)[0] * interpolate(cases[2].a, cases[2].b, .5)[3]
  - interpolate(cases[2].a, cases[2].b, .5)[1] * interpolate(cases[2].a, cases[2].b, .5)[2] < 0);
assert.ok(Math.abs(maxScale([1, 0, 1, 1, 0, 0]) - (1 + Math.sqrt(5)) / 2) < 1e-12);
assert.equal(maxScale([0, 0, 0, 0, 100, 200]), 0);
const matrix = pose(.4, 2, -3, .2, 10, 20);
close(multiply(matrix, inverse(matrix)), identity, '矩阵求逆');
close(point([2, 0, 0, 3, 4, 5], [-1, 2]), [2, 11], '点变换');
close(transformBounds([-1, -2, 3, 4], [0, 1, -1, 0, 10, 20]), [8, 19, 4, 3], '矩形变换');
close(union([[0, 1, 2, 3], [-2, -3, 1, 1]]), [-2, -3, 4, 7], '矩形并集');

const temporary = await mkdtemp('/private/tmp/svg-render-interpolation-');
try {
  const fixture = path.join(temporary, 'fixture.json');
  await writeFile(fixture, JSON.stringify({cases}));
  const executable = process.env.SVG_RENDER_GODOT || path.resolve('../gemcard-demo/Godot.app/Contents/MacOS/Godot');
  const result = spawnSync(executable, [
    '--headless', '--single-threaded-scene', '--path', path.resolve('godot'),
    '--script', 'res://check_player.gd', '--log-file', path.join(temporary, 'godot.log'),
    '--', '--interpolation-fixture', fixture,
  ], {
    encoding: 'utf8', timeout: 30000,
    env: {...process.env, OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1', VECLIB_MAXIMUM_THREADS: '1'},
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const output = result.stdout.split('\n').find(line => line.startsWith('{"matrices":'));
  assert.ok(output, `Godot 未输出插值矩阵：${result.stdout}\n${result.stderr}`);
  const {matrices} = JSON.parse(output);
  assert.equal(matrices.length, cases.length);
  for (let index = 0; index < cases.length; index++) {
    const {a, b, w} = cases[index];
    close(matrices[index], interpolate(a, b, w), `JS/Godot ${index}`);
  }
  console.log(`分层插值：${cases.length} 组 JS/Godot 矩阵逐分量误差 ≤ 1e-5，旋转、缩放、斜切、反射、零缩放与大平移通过`);
} finally {
  await rm(temporary, {recursive: true, force: true});
}
