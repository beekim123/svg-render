// 试验用的小工具：自己开一个无头 Chrome，用调试协议（CDP）控制它。
// 只关自己开的那个 Chrome 进程（别的会话可能也在用浏览器）。
// 不是正式代码，只为核实设计里的几件事。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** mode: 'cpu' = 关掉 GPU，全用 CPU 光栅；'gpu' = 开 GPU 光栅 */
export async function openChrome({ mode = 'cpu', width = 800, height = 800, extra = [] } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svgdesign-chrome-'));
  const flags = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(tmp, 'profile')}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--disable-background-networking',
    '--force-device-scale-factor=1', '--force-color-profile=srgb', `--window-size=${width},${height}`,
    ...(mode === 'cpu' ? ['--disable-gpu'] : ['--enable-gpu-rasterization', '--ignore-gpu-blocklist']),
    ...extra, 'about:blank',
  ];
  const child = spawn(CHROME, flags, { stdio: 'ignore' });
  const portFile = path.join(tmp, 'profile', 'DevToolsActivePort');
  for (let i = 0; i < 200 && !fs.existsSync(portFile); i++) await new Promise(r => setTimeout(r, 50));
  if (!fs.existsSync(portFile)) { child.kill('SIGTERM'); throw new Error('Chrome 没起来'); }
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
  let targets = [];
  for (let i = 0; i < 100; i++) {
    targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    if (targets.some(t => t.type === 'page')) break;
    await new Promise(r => setTimeout(r, 50));
  }
  const page = targets.find(t => t.type === 'page');
  // 问浏览器进程：现在到底是 CPU 光栅还是 GPU 光栅
  const gpuInfo = await (async () => {
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const b = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((ok, bad) => { b.onopen = ok; b.onerror = bad; });
    const answer = new Promise(ok => { b.onmessage = e => ok(JSON.parse(e.data)); });
    b.send(JSON.stringify({ id: 1, method: 'SystemInfo.getInfo' }));
    const r = (await answer).result; b.close();
    return { browser: version.Browser, rasterization: r?.gpu?.featureStatus?.rasterization, gpu_compositing: r?.gpu?.featureStatus?.gpu_compositing, device: r?.gpu?.devices?.[0]?.deviceString, featureStatus: r?.gpu?.featureStatus };
  })().catch(error => ({ error: String(error) }));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  let next = 1; const waiting = new Map(); const listeners = [];
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id && waiting.has(msg.id)) { const { ok, bad } = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? bad(new Error(JSON.stringify(msg.error))) : ok(msg.result); }
    else for (const fn of listeners) fn(msg);
  };
  const send = (method, params = {}) => new Promise((ok, bad) => { const id = next++; waiting.set(id, { ok, bad }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression, awaitPromise = true) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  const setHtml = async html => {
    const { frameTree } = await send('Page.getFrameTree');
    await send('Page.setDocumentContent', { frameId: frameTree.frame.id, html });
    await evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
  };
  const shot = async (clip) => Buffer.from((await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: false })).data, 'base64');
  const close = async () => {
    try { ws.close(); } catch {}
    if (child.exitCode === null) { const exited = new Promise(r => child.once('exit', r)); child.kill('SIGTERM'); await Promise.race([exited, new Promise(r => setTimeout(r, 5000))]); }
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  return { gpuInfo, send, evaluate, setHtml, shot, close, on: fn => listeners.push(fn), pid: child.pid, tmp };
}
