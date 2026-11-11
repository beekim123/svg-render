// 试验 1：在 Chrome 里把 CSS 动画和 SMIL 一起停在指定时刻，读出动画值，截图。
// 要核实的：
//   a) CSS 动画和 SMIL 能不能都按"毫秒"精确定位；一次性动作（加 class / beginElement）能不能在暂停的时间线上触发；
//   b) 各种动画值能不能读出来（transform、d、颜色、虚线偏移、模糊半径、渐变变换、沿路径运动、set）；
//   c) 同一时刻截图是否每次都一样（同一进程里来回跳、换一个新进程）。
// 用法：node 试验1-冻结取值截图.mjs [cpu|gpu]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { openChrome } from './cdp.mjs';

const HERE = import.meta.dirname;
const OUT = path.join(HERE, '输出'); fs.mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] ?? 'cpu';
const svgText = fs.readFileSync(path.join(HERE, '试验图.svg'), 'utf8');
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">${svgText}`;
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

const PAGE = `
(() => {
  const svg = document.querySelector('svg');
  const kept = new Set();           // 自己记住所有动画对象：播完的动画会从 getAnimations() 里消失
  const starts = new Map();         // 动画 → 它开始的全局时刻（毫秒）
  let now = 0;
  const collect = () => { for (const a of document.getAnimations()) if (!kept.has(a)) { kept.add(a); starts.set(a, now); a.pause(); } };
  window.T = {
    seek(t) { now = t; svg.pauseAnimations(); svg.setCurrentTime(t / 1000); collect(); for (const a of kept) a.currentTime = t - starts.get(a); },
    cast() { svg.classList.add('act-cast'); void svg.getBoundingClientRect(); collect(); document.getElementById('smilBlur').beginElement(); },
    read() {
      const cs = id => getComputedStyle(document.getElementById(id));
      const m = v => [v.a, v.b, v.c, v.d, v.e, v.f].map(x => +x.toFixed(4));
      const g = document.getElementById('lava').gradientTransform.animVal;
      return {
        spinner_transform: cs('spinner').transform,
        breathCss_d: cs('breathCss').d,
        morphSmil_d_computed: cs('morphSmil').d,
        morphSmil_d_attr: document.getElementById('morphSmil').getAttribute('d'),
        eye_fill: cs('eye').fill,
        rune_dashoffset: cs('rune').strokeDashoffset,
        halo_opacity: cs('halo').opacity, halo_transform: cs('halo').transform,
        blur_std: [document.getElementById('fe').stdDeviationX.animVal, document.getElementById('fe').stdDeviationX.baseVal],
        grad_matrix: g.numberOfItems ? m([...Array(g.numberOfItems).keys()].map(i => g.getItem(i).matrix).reduce((a, b) => a.multiply(b))) : null, // animVal 是只读的，不能 consolidate()
        bone_ctm: m(document.getElementById('bone').getCTM()),
        blink_visibility: cs('blink').visibility,
        css_anims: [...kept].map(a => [a.animationName, a.playState, +(+a.currentTime).toFixed(2)]),
        smil_time: svg.getCurrentTime(),
      };
    },
  };
})()`;

async function run(tag) {
  const chrome = await openChrome({ mode, width: 400, height: 400 });
  try {
    await chrome.setHtml(html);
    await chrome.evaluate(PAGE);
    const clip = { x: 0, y: 0, width: 400, height: 400 };
    const result = { mode, raster: chrome.gpuInfo, frames: {} };
    const snap = async (name, t) => {
      await chrome.evaluate(`T.seek(${t})`);
      await chrome.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
      const png = await chrome.shot(clip);
      fs.writeFileSync(path.join(OUT, `试验1-${mode}-${tag}-${name}.png`), png);
      result.frames[name] = { t, hash: sha(png), values: await chrome.evaluate('T.read()') };
    };
    await snap('t0000', 0);
    await snap('t0500', 500);
    await snap('t1250', 1250);
    await chrome.evaluate('T.seek(1000)'); await chrome.evaluate('T.cast()');   // 在 1000ms 这一刻触发"施法"
    await snap('t1700', 1700);                                                  // 施法进行到 700ms
    await snap('t0300-跳回去', 300);
    await snap('t1700-再跳回来', 1700);
    await snap('t2500-施法播完', 2500);
    return result;
  } finally { await chrome.close(); }
}

const first = await run('甲');
const second = await run('乙');
const same = (a, b) => a.hash === b.hash;
const report = {
  mode, 光栅: first.raster,
  同进程来回跳_截图一致: same(first.frames['t1700'], first.frames['t1700-再跳回来']),
  换进程_截图一致: Object.fromEntries(Object.keys(first.frames).map(k => [k, same(first.frames[k], second.frames[k])])),
  换进程_取值一致: JSON.stringify(Object.values(first.frames).map(f => f.values)) === JSON.stringify(Object.values(second.frames).map(f => f.values)),
  取值: Object.fromEntries(Object.entries(first.frames).map(([k, f]) => [k, f.values])),
};
fs.writeFileSync(path.join(OUT, `试验1-${mode}-报告.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, 取值: undefined }, null, 1));
for (const k of ['t0000', 't0500', 't1700', 't2500-施法播完']) console.log(k, JSON.stringify(report.取值[k]));
