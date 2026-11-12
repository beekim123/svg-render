import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createReferenceSession} from './index.mjs';
import {root} from '../setup/paths.mjs';
import {PNG} from 'pngjs';
import {compareImages} from '../compare/metrics.mjs';
import {gaussianBlur} from '../compare/blur.mjs';

const fixture = scale => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="10 20 120 80">
  <style>
    @keyframes pose { from,to { transform:translate(7px,-4px) rotate(20deg) scale(1.2,.8) } }
    @keyframes identity { from,to { transform:none } }
    #view { transform-box:view-box;transform-origin:25% 75%;animation:pose 1s both }
    #fill { transform-box:fill-box;transform-origin:25% 75%;animation:pose 1s both }
    #identity { transform-box:view-box;transform-origin:99px 99px;animation:identity 1s both }
  </style>
  <g style="transform:scale(${scale});transform-origin:0px 0px;transform-box:view-box">
    <g id="view"><rect x="11" y="17" width="40" height="24"/></g>
    <g id="fill"><rect x="11" y="17" width="40" height="24"/></g>
    <g id="identity"><rect x="11" y="17" width="40" height="24"/></g>
  </g>
</svg>`;
const close = (actual, expected, label) => {
  assert.equal(actual.length, 6, label);
  for (let index = 0; index < 6; index++) assert.ok(Math.abs(actual[index] - expected[index]) < 1e-6, `${label}[${index}]: ${actual[index]} / ${expected[index]}`);
};
const session = await createReferenceSession();
const thresholds = JSON.parse(await fs.readFile(path.join(root, '阈值.json'), 'utf8')).冻结对活图;
try {
  const regular = await session.render({svg: fixture('1,1'), time: 0, id: 'singular/native-local'});
  assert.equal(regular.verification.通过, true);
  for (const scale of ['0,0', '0,1']) {
    const collapsed = await session.render({svg: fixture(scale), time: 0, id: `singular/${scale}`});
    assert.equal(collapsed.verification.通过, true, JSON.stringify(collapsed.verification.错误));
    for (const id of ['view', 'fill', 'identity']) {
      const expected = regular.values.find(row => row.元素id === id && row.属性 === 'transform');
      const actual = collapsed.values.find(row => row.元素id === id && row.属性 === 'transform');
      assert(actual && expected, id);
      close(actual.完整局部矩阵, expected.完整局部矩阵, `${scale}/${id}`);
      if (id === 'identity') close(actual.完整局部矩阵, [1, 0, 0, 1, 0, 0], `${scale}/identity`);
    }
  }
  for (const [id, name, time] of [['ui_heart', 'gain', 0], ['ui_rule_sign', 'flip', 200]]) for (const scale of [1, 2]) {
    const svg = await fs.readFile(path.join(root, `素材/新画法/${id}.svg`), 'utf8');
    const action = {名字: name, 触发: {attr: ['data-anim', name]}};
    const frame = await session.render({svg, action, time, scale, id: `新画法/${id}`});
    assert.equal(frame.verification.通过, true, `${id}/${name}/${time}: ${JSON.stringify(frame.verification.错误)}`);
    for (const row of frame.values.filter(row => row.属性 === 'transform')) assert(row.完整局部矩阵.every(Number.isFinite));
    const frozen = PNG.sync.read(frame.png);
    const live = PNG.sync.read(frame.livePng);
    const ssim = compareImages(frozen, live).分组.find(group => group.区域 === '全图').指标.ssim;
    const blurred = ssim >= thresholds.ssim ? null : compareImages(gaussianBlur(frozen, thresholds.模糊sigma), gaussianBlur(live, thresholds.模糊sigma)).分组.find(group => group.区域 === '全图').指标.ssim;
    console.log(JSON.stringify({id, name, time, scale, ssim, blurred}));
    assert(ssim >= thresholds.ssim || blurred >= thresholds.ssim, `${id}/${name}/${time}@${scale}x: ${ssim} / ${blurred}`);
  }
  console.log('奇异父变换：fill-box/view-box 枢轴、非平凡局部矩阵、identity 子节点及 ui_heart/gain、ui_rule_sign/flip 冻结复核通过');
} finally {
  await session.close();
}
