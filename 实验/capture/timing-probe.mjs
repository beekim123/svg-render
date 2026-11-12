// 计时探针：不改工具代码，包一层页面方法，统计每帧各环节耗时。用法：node 实验/capture/timing-probe.mjs <素材id>...
import fs from 'node:fs/promises';
import path from 'node:path';
const T = path.resolve(import.meta.dirname, '../..');
const {createReferenceSession} = await import(T + '/tools/ref/index.mjs');
const {freezeAgainstLive} = await import(T + '/tools/ref/batch.mjs');
const manifest = JSON.parse(await fs.readFile(T + '/素材/清单.json', 'utf8'));
const list = manifest.素材 ?? manifest;
const ids = process.argv.slice(2);
const acc = {};
const add = (k, ms) => { acc[k] ??= {n: 0, ms: 0}; acc[k].n++; acc[k].ms += ms; };
const wrap = (obj, label) => {
  for (const m of ['evaluate', 'shot', 'viewport', 'setHtml', 'send']) {
    const f = obj[m]; if (typeof f !== 'function') continue;
    obj[m] = async (...a) => {
      const t = performance.now();
      try { return await f(...a); } finally {
        let k = `${label}.${m}`;
        if (m === 'evaluate') { const s = String(a[0]); k += s.includes('__ref.freeze') ? ':freeze' : s.includes('__ref.read(') ? ':read' : s.includes('document.fonts') ? ':fonts' : s.includes('installTimeline') || s.includes('__ref=') || s.length > 2000 ? ':install' : s.includes('__ref.seek') ? ':seek' : s.includes('requestAnimationFrame') ? ':raf' : ':other'; }
        add(k, performance.now() - t);
      }
    };
  }
};
const s = await createReferenceSession({mode: 'cpu'});
wrap(s.browser, 'live'); wrap(s.frozen, 'frozen');
const tmp = path.join(T, 'out/timing-probe'); await fs.mkdir(tmp, {recursive: true});
const result = {};
try {
  for (const id of ids) {
    const asset = list.find(a => a.id === id);
    const svg = await fs.readFile(path.join(T, asset.文件), 'utf8');
    const action = asset.动作[0];
    for (const k in acc) delete acc[k];
    const times = [0, 100, 200, 300, 400, 500];
    let render = 0, prep = 0, cmp = 0, n = 0, same = 0, liveSame = 0;
    // 对照：先 prepare 一次，之后只 seek+freeze，看冻结 SVG 是否和每帧重载一致
    await s.prepare({svg, scale: 1, action, triggerTime: 1000, id});
    const reused = [];
    for (const t of times) { await s.browser.evaluate(`__ref.seek(${t + 0})`); await s.browser.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))'); reused.push((await s.browser.evaluate('__ref.freeze()')).svg); }
    for (const k in acc) delete acc[k];
    for (const scale of [1, 2]) for (const [i, t] of times.entries()) {
      let t0 = performance.now(); await s.prepare({svg, scale, action, triggerTime: 1000, id}); prep += performance.now() - t0;
      t0 = performance.now();
      const fr = await s.render({svg, scale, time: t, action, triggerTime: 1000, id});
      render += performance.now() - t0; n++;
      if (scale === 1 && fr.svg === reused[i]) same++;
      await fs.writeFile(tmp + '/r.png', fr.png); await fs.writeFile(tmp + '/l.png', fr.livePng);
      t0 = performance.now(); await freezeAgainstLive(tmp + '/r.png', tmp + '/l.png'); cmp += performance.now() - t0;
    }
    let t0 = performance.now();
    await s.sampleValues({svg, scale: 1, action, triggerTime: 1000, duration: 2000, id});
    const values = performance.now() - t0;
    result[id] = {帧数: n, 每帧render毫秒: +(render / n).toFixed(1), 单独prepare每次毫秒: +(prep / n).toFixed(1), 每帧比对毫秒: +(cmp / n).toFixed(1), 值表2秒毫秒: +values.toFixed(0), 复用页面冻结SVG相同: `${same}/${times.length}`, 环节: Object.fromEntries(Object.entries(acc).sort((a, b) => b[1].ms - a[1].ms).map(([k, v]) => [k, {次: v.n, 每帧毫秒: +(v.ms / n).toFixed(1)}]))};
  }
} finally { await s.close(); }
console.log(JSON.stringify(result, null, 1));
