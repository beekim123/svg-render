// 试验 4：Chrome 自己"动画停在某一刻直接截图"（活图：会动的元素被拆成合成层再变换）
//         和"把这一刻的值写死、关掉动画再画"（冻结图：全部重新栅格化，最清晰）之间差多少。
// 这个差就是 Chrome 自己播动画时的"发软"程度，用来当我们缓存层重采样误差的标尺。
// 只用现有游戏里纯 CSS 动画的素材（只读）。用法：node 试验4-活图对冻结图.mjs
import fs from 'node:fs';
import path from 'node:path';
import { openChrome } from './cdp.mjs';
const HERE = import.meta.dirname;
const OUT = path.join(HERE, '输出'); fs.mkdirSync(OUT, { recursive: true });
const ART = '素材/源文件/现有游戏/svg';
const PICK = [['mon_chest', 'hit', 150], ['mon_chest', 'attack', 330], ['mon_dragon', null, 800], ['mon_bear', 'die', 450], ['fx_rainbow', 'play', 250], ['card_art_bag', null, 700], ['mon_clock', null, 1300]];
const raf2 = 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))';
const kebab = 'n => n.replace(/[A-Z]/g, c => "-" + c.toLowerCase())';
const chrome = await openChrome({ mode: 'cpu', width: 1400, height: 1000 });
try {
  for (const scale of [1, 2]) for (const [id, event, t] of PICK) {
    const file = path.join(ART, id + '.svg'); if (!fs.existsSync(file)) continue;
    await chrome.setHtml(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">${fs.readFileSync(file, 'utf8')}`);
    const size = await chrome.evaluate(`(() => { const s = document.querySelector('svg'); const vb = s.viewBox.baseVal; s.setAttribute('width', vb.width * ${scale}); s.setAttribute('height', vb.height * ${scale}); s.style.display = 'block';
      ${event ? `s.setAttribute('data-anim', ${JSON.stringify(event)});` : ''} void s.getBoundingClientRect();
      for (const a of document.getAnimations()) { a.pause(); a.currentTime = ${t}; }
      return [vb.width * ${scale}, vb.height * ${scale}]; })()`);
    await chrome.evaluate(raf2);
    const clip = { x: 0, y: 0, width: size[0], height: size[1] };
    const name = `${id}-${event ?? 'idle'}-${t}-${scale}x`;
    fs.writeFileSync(path.join(OUT, `试验4-活-${name}.png`), await chrome.shot(clip));
    // 冻结：把正在播的动画改的属性按此刻的计算值写成行内样式，再关掉全部动画
    await chrome.evaluate(`(() => { const kebab = ${kebab}; const s = document.querySelector('svg'); const todo = [];
      for (const a of document.getAnimations()) { const el = a.effect.target; const cs = getComputedStyle(el);
        for (const k of new Set(a.effect.getKeyframes().flatMap(f => Object.keys(f)))) if (!['offset', 'computedOffset', 'easing', 'composite'].includes(k)) todo.push([el, kebab(k), cs.getPropertyValue(kebab(k))]); }
      for (const [el, k, v] of todo) el.style.setProperty(k, v);
      const off = document.createElementNS('http://www.w3.org/2000/svg', 'style'); off.textContent = '*{animation:none!important;transition:none!important}'; s.prepend(off); void s.getBoundingClientRect();
      return document.getAnimations().length; })()`);
    await chrome.evaluate(raf2);
    fs.writeFileSync(path.join(OUT, `试验4-冻-${name}.png`), await chrome.shot(clip));
    console.log(name);
  }
} finally { await chrome.close(); }
