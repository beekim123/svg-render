// 试验 3：核实能不能拿到 Chrome 实际发给 Skia 的绘制指令。两条路都试，CPU / GPU 两种模式都试。
// 用法：node 试验3-取Chrome指令.mjs
import fs from 'node:fs';
import path from 'node:path';
import { openChrome } from './cdp.mjs';
const HERE = import.meta.dirname;
const OUT = path.join(HERE, '输出');
const raf2 = 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))';
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">${fs.readFileSync(path.join(HERE, '试验图.svg'), 'utf8')}`;
for (const mode of ['cpu', 'gpu']) {
  const result = { mode };
  const skpDir = path.join(OUT, 'skp-' + mode); fs.rmSync(skpDir, { recursive: true, force: true }); fs.mkdirSync(skpDir, { recursive: true });
  const chrome = await openChrome({ mode, width: 400, height: 400, extra: ['--enable-gpu-benchmarking', '--no-sandbox'] });
  try {
    const layersSeen = []; chrome.on(msg => { if (msg.method === 'LayerTree.layerTreeDidChange') layersSeen.push(msg.params.layers ?? null); });
    await chrome.send('LayerTree.enable');
    await chrome.setHtml(html);
    await chrome.evaluate(`(() => { const s = document.querySelector('svg'); s.pauseAnimations(); s.setCurrentTime(0.5); for (const a of document.getAnimations()) { a.pause(); a.currentTime = 500; } })()`);
    await chrome.evaluate(raf2); await new Promise(r => setTimeout(r, 800));
    const list = layersSeen.filter(Boolean).at(-1);
    result.LayerTree_事件数 = layersSeen.length; result.LayerTree_层 = list?.map(l => [l.width, l.height, l.drawsContent]) ?? null;
    const logs = [];
    for (const layer of list ?? []) {
      if (!layer.drawsContent) continue;
      try {
        const { snapshotId } = await chrome.send('LayerTree.makeSnapshot', { layerId: layer.layerId });
        const { commandLog } = await chrome.send('LayerTree.snapshotCommandLog', { snapshotId });
        logs.push({ layer: [layer.width, layer.height], commands: commandLog });
      } catch (error) { result.LayerTree_快照错误 = String(error); }
    }
    const count = {}; for (const l of logs) for (const c of l.commands) count[c.method] = (count[c.method] ?? 0) + 1;
    result.LayerTree_指令种类 = count;
    if (logs.length) fs.writeFileSync(path.join(OUT, `试验3-指令-${mode}.json`), JSON.stringify(logs, null, 1));
    try {
      result.skp_返回 = await chrome.evaluate(`(() => { try { return String(chrome.gpuBenchmarking.printToSkPicture(${JSON.stringify(skpDir)})); } catch (e) { return '异常：' + e; } })()`);
      await new Promise(r => setTimeout(r, 2000));
      result.skp_文件 = fs.readdirSync(skpDir, { recursive: true }).map(f => [f, fs.statSync(path.join(skpDir, f)).size]);
    } catch (error) { result.skp_错误 = String(error); }
  } finally { await chrome.close(); }
  console.log(JSON.stringify(result, null, 1));
}
