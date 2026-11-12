// 带单位的 SMIL 长度回归：百分比 / em / 用户单位的 startOffset、r、x 冻结后必须保留原单位，
// 冻结图要和活图对得上。原来用 SVGLength.value 写回，百分比按视口换算，startOffset 的文字转错位置。
import assert from 'node:assert/strict';
import {createReferenceSession} from './index.mjs';
import {PNG} from 'pngjs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <path id="ring" d="M 100,20 A 80,80 0 1,1 99.9,20" fill="none"/>
  <text font-family="Noto Sans CJK SC" font-size="14" fill="#123">
    <textPath id="pct" href="#ring" startOffset="0%">百分比沿圆排的文字ABC<animate attributeName="startOffset" values="0%;60%" dur="2s" repeatCount="indefinite"/></textPath>
  </text>
  <text font-family="Noto Sans CJK SC" font-size="10" fill="#a33">
    <textPath id="user" href="#ring" startOffset="0">用户单位<animate attributeName="startOffset" values="0;200" dur="2s" repeatCount="indefinite"/></textPath>
  </text>
  <circle id="r" cx="100" cy="100" r="5%" fill="#3a6"><animate attributeName="r" values="5%;15%" dur="2s" repeatCount="indefinite"/></circle>
  <rect id="em" x="1em" y="150" width="20" height="20" font-size="10" fill="#36a"><animate attributeName="x" values="1em;10em" dur="2s" repeatCount="indefinite"/></rect>
</svg>`;

const session = await createReferenceSession();
try {
  const frame = await session.render({svg, id: '单位夹具', scale: 1, time: 1300});
  const frozen = frame.svg;
  const attr = (id, name) => frozen.match(new RegExp(`id="${id}"[^>]*?${name}="([^"]*)"`))?.[1] ?? frozen.match(new RegExp(`${name}="([^"]*)"[^>]*?id="${id}"`))?.[1];
  const pct = attr('pct', 'startOffset'), user = attr('user', 'startOffset'), r = attr('r', 'r'), em = attr('em', 'x');
  console.log({pct, user, r, em});
  assert.match(pct, /^39(\.\d+)?%$/, `百分比 startOffset 应保留 %：${pct}`);
  assert.match(r, /^11(\.\d+)?%$/, `百分比 r 应保留 %：${r}`);
  assert.match(em, /^6\.85\d*em$/, `em 的 x 应保留 em：${em}`);
  assert(Math.abs(Number(user) - 130) < 0.01, `用户单位 startOffset 仍写数字：${user}`);
  assert(frame.verification.通过, JSON.stringify(frame.verification.错误));
  // 冻结图对活图：逐像素最大差很小（同一时刻，文字位置一致）。
  const a = PNG.sync.read(frame.png), b = PNG.sync.read(frame.livePng);
  let worst = 0;
  for (let i = 0; i < a.data.length; i++) worst = Math.max(worst, Math.abs(a.data[i] - b.data[i]));
  console.log('冻结图对活图最大通道差', worst);
  assert(worst <= 16, `冻结图和活图差太多：${worst}`);
} finally {
  await session.close();
}
console.log('单位回归通过');
