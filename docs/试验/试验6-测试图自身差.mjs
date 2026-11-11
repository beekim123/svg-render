// 试验 6：拿 argon 交回的复杂测试图（只读），量 Chrome 自己的差：
//   a) CPU 光栅下，同一时刻换一个进程再截，是不是一样（带噪声、光照、置换这些滤镜时还可不可重复）；
//   b) CPU 光栅 对 GPU 光栅 差多少。
// 都是"活图"（动画停在某一刻直接截），1 倍。用法：node 试验6-测试图自身差.mjs
import fs from 'node:fs';
import path from 'node:path';
import { openChrome } from './cdp.mjs';
const HERE = import.meta.dirname;
const OUT = path.join(HERE, '输出'); fs.mkdirSync(OUT, { recursive: true });
const ART = path.resolve(HERE, '../../素材/源文件/复杂测试图');   // 只读
const PICK = [['char_lich', 1300], ['char_golem', 900], ['char_swarm', 700], ['fx_explosion', 0], ['fx_circle', 1100], ['card_foil', 800], ['ui_hud', 600], ['scene_vault', 500], ['scene_hall', 1500], ['icons/' + fs.readdirSync(path.join(ART, 'icons')).filter(f => f.endsWith('.svg'))[0].replace('.svg', ''), 300]];
const raf2 = 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))';
async function shots(tag, mode) {
  const chrome = await openChrome({ mode, width: 1920, height: 1080 });
  const times = {};
  try {
    for (const [id, t] of PICK) {
      const text = fs.readFileSync(path.join(ART, id + '.svg'), 'utf8');
      const started = Date.now();
      await chrome.setHtml(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">${text}`);
      const size = await chrome.evaluate(`(() => { const s = document.querySelector('svg'); s.style.display = 'block'; const vb = s.viewBox.baseVal;
        s.pauseAnimations(); s.setCurrentTime(${t / 1000}); for (const a of document.getAnimations()) { a.pause(); a.currentTime = ${t}; }
        return [vb.width, vb.height, document.getAnimations().length, s.querySelectorAll('animate,animateTransform,animateMotion,set').length]; })()`);
      await chrome.evaluate(raf2);
      const png = await chrome.shot({ x: 0, y: 0, width: size[0], height: size[1] });
      fs.writeFileSync(path.join(OUT, `试验6-${tag}-${id.replace('/', '_')}.png`), png);
      times[id] = { 毫秒: Date.now() - started, 尺寸: [size[0], size[1]], css动画: size[2], smil动画: size[3] };
    }
  } finally { await chrome.close(); }
  return times;
}
const a = await shots('cpu甲', 'cpu'); await shots('cpu乙', 'cpu'); const g = await shots('gpu', 'gpu');
console.log(JSON.stringify({ cpu: a, gpu: Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.毫秒])) }, null, 1));
