// 试验 2：
//   a) 拿现有游戏的几个真素材（只读），在 CPU 光栅和 GPU 光栅下各截一张 2 倍图，量两种模式差多少 → 给阈值找"底噪"；
//   b) 核实能不能从 Chrome 里拿到它实际发给 Skia 的绘制指令（两条路：调试协议的 LayerTree 快照；gpuBenchmarking 导出 .skp 文件）。
// 用法：node 试验2-真素材与指令.mjs
import fs from 'node:fs';
import path from 'node:path';
import { openChrome } from './cdp.mjs';

const HERE = import.meta.dirname;
const OUT = path.join(HERE, '输出'); fs.mkdirSync(OUT, { recursive: true });
const ART = '素材/源文件/现有游戏/svg';   // 只读
const PICK = [['mon_chest', 'hit', 150], ['mon_dragon', null, 800], ['card_art_bag', null, 0], ['fx_rainbow', 'play', 250], ['table_cloth', null, 0]];
const SCALE = 2;
const page = text => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">${text}`;
const raf2 = 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))';

async function shots(mode) {
  const chrome = await openChrome({ mode, width: 1400, height: 1000 });
  const sizes = {};
  try {
    for (const [id, event, t] of PICK) {
      const file = path.join(ART, id + '.svg'); if (!fs.existsSync(file)) { console.log('没有', id); continue; }
      await chrome.setHtml(page(fs.readFileSync(file, 'utf8')));
      const size = await chrome.evaluate(`(() => { const s = document.querySelector('svg'); const vb = s.viewBox.baseVal; s.setAttribute('width', vb.width * ${SCALE}); s.setAttribute('height', vb.height * ${SCALE}); s.style.display = 'block';
        ${event ? `s.setAttribute('data-anim', ${JSON.stringify(event)});` : ''} void s.getBoundingClientRect();
        s.pauseAnimations(); for (const a of document.getAnimations()) { a.pause(); a.currentTime = ${t}; }
        return [vb.width * ${SCALE}, vb.height * ${SCALE}, document.getAnimations().length]; })()`);
      await chrome.evaluate(raf2);
      fs.writeFileSync(path.join(OUT, `试验2-${mode}-${id}.png`), await chrome.shot({ x: 0, y: 0, width: size[0], height: size[1] }));
      sizes[id] = size;
    }
  } finally { await chrome.close(); }
  return sizes;
}

async function commands() {
  const result = {};
  const skpDir = path.join(OUT, 'skp'); fs.rmSync(skpDir, { recursive: true, force: true }); fs.mkdirSync(skpDir, { recursive: true });
  const chrome = await openChrome({ mode: 'cpu', width: 400, height: 400, extra: ['--enable-gpu-benchmarking', '--no-sandbox'] });
  try {
    await chrome.setHtml(page(fs.readFileSync(path.join(HERE, '试验图.svg'), 'utf8')));
    await chrome.evaluate(`(() => { const s = document.querySelector('svg'); s.pauseAnimations(); s.setCurrentTime(0.5); for (const a of document.getAnimations()) { a.pause(); a.currentTime = 500; } })()`);
    await chrome.evaluate(raf2);
    // 路一：调试协议 LayerTree
    try {
      const layers = new Promise(ok => chrome.on(msg => { if (msg.method === 'LayerTree.layerTreeDidChange' && msg.params.layers) ok(msg.params.layers); }));
      await chrome.send('LayerTree.enable');
      const list = await Promise.race([layers, new Promise(r => setTimeout(() => r(null), 5000))]);
      result.LayerTree_层数 = list?.length ?? null;
      const logs = [];
      for (const layer of list ?? []) {
        if (!layer.drawsContent) continue;
        const { snapshotId } = await chrome.send('LayerTree.makeSnapshot', { layerId: layer.layerId });
        const { commandLog } = await chrome.send('LayerTree.snapshotCommandLog', { snapshotId });
        logs.push({ layer: [layer.width, layer.height], commands: commandLog });
      }
      result.LayerTree_指令条数 = logs.map(l => l.commands.length);
      const count = {}; for (const l of logs) for (const c of l.commands) count[c.method] = (count[c.method] ?? 0) + 1;
      result.LayerTree_指令种类 = count;
      fs.writeFileSync(path.join(OUT, '试验2-指令-LayerTree.json'), JSON.stringify(logs, null, 1));
    } catch (error) { result.LayerTree_错误 = String(error); }
    // 路二：gpuBenchmarking 导出 skp
    try {
      result.gpuBenchmarking_有 = await chrome.evaluate(`typeof chrome !== 'undefined' && !!chrome.gpuBenchmarking && typeof chrome.gpuBenchmarking.printToSkPicture`);
      if (result.gpuBenchmarking_有 === 'function') {
        await chrome.evaluate(`chrome.gpuBenchmarking.printToSkPicture(${JSON.stringify(skpDir)})`);
        await new Promise(r => setTimeout(r, 500));
        result.skp_文件 = fs.readdirSync(skpDir).map(f => [f, fs.statSync(path.join(skpDir, f)).size]);
      }
    } catch (error) { result.skp_错误 = String(error); }
  } finally { await chrome.close(); }
  return result;
}

const a = await shots('cpu'); await shots('gpu');
console.log('截图', JSON.stringify(a));
console.log('指令', JSON.stringify(await commands(), null, 1));
