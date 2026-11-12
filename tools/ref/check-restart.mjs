// Chrome 断连回归：①真 Chrome 被杀后，请求要在几秒内报"已关闭"并带退出信息，不能白等 30 秒超时；
// ②批量出图时会话死了，要重开 Chrome 并把这个动作重试一次。只杀本测试自己开的 Chrome 进程。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import {openChrome, ChromeDisconnectedError} from '../chrome/index.mjs';
import {runBatch} from './batch.mjs';
import {sha256} from './index.mjs';

// ① 真 Chrome
const browser = await openChrome();
try {
  assert.equal(browser.alive(), true);
  process.kill(browser.pid, 'SIGKILL');
  const started = performance.now();
  let error;
  try {
    // 第一次可能还没收到关闭事件，连发几次，任何一次都必须很快失败。
    for (let i = 0; i < 3; i++) await browser.send('Runtime.evaluate', {expression: '1'});
  } catch (e) {
    error = e;
  }
  const elapsed = performance.now() - started;
  assert(error instanceof ChromeDisconnectedError, `应报断连，实际：${error?.message}`);
  assert(elapsed < 5000, `断连后 ${Math.round(elapsed)} 毫秒才报错`);
  for (let i = 0; i < 50 && browser.alive(); i++) await new Promise(r => setTimeout(r, 100));
  assert.equal(browser.alive(), false);
  const again = await browser.send('Page.getFrameTree').then(() => null, e => e);
  assert(again instanceof ChromeDisconnectedError, '关闭后再发请求必须立刻失败');
  console.log(`真 Chrome：${Math.round(elapsed)} 毫秒报错；${again.message}`);
} finally {
  await browser.close();
}

// ② 批量重开（模拟会话，不出真图）
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'svg-ref-restart-'));
try {
  const fonts = {};
  for (const weight of ['Regular', 'Bold']) {
    const name = `NotoSansCJKsc-${weight}.otf`;
    fonts[name] = sha256(await fs.readFile(path.resolve(import.meta.dirname, '../../素材/字体', name)));
  }
  let sessions = 0;
  const factory = async ({mode, freezePolicy}) => {
    const index = ++sessions;
    let dead = false;
    return {
      freezePolicy, fonts,
      browser: {
        pid: 1000 + index, alive: () => !dead,
        gpuInfo: {browser: 'Chrome/157.0.8103.50', rasterization: 'disabled_software'},
        flags: ['--user-data-dir=/tmp/test'],
        evaluate: async () => ({period: 0, animated: false}),
      },
      prepare: async () => {
        // 第一个会话一开工就"断连"。
        if (index === 1) { dead = true; throw new ChromeDisconnectedError('Chrome 调试连接已关闭（模拟）'); }
        return {width: 4, height: 4};
      },
      render: async ({scale, time, id, action, oplog}) => {
        const image = new PNG({width: 4 * scale, height: 4 * scale});
        image.data.fill(0);
        const png = PNG.sync.write(image);
        return {png, livePng: png, svg: '<svg/>', verification: {通过: true, 轨道数: 0, 错误: []},
          metadata: {素材: id, 动作: action.名字, 时刻: time, 倍率: scale, 冻结策略: freezePolicy, 文字区域: []},
          ...(oplog ? {oplog: [{commands: [{method: 'drawRect'}]}]} : {})};
      },
      sampleValues: async ({id, action}) => ({id, 动作: action.名字, 步长毫秒: 20, 时刻: [0], 轨: []}),
      close: async () => {},
    };
  };
  const source = path.join(tmp, 'fixture.svg');
  await fs.writeFile(source, '<svg viewBox="0 0 4 4"/>');
  const manifest = [{id: '试验图/试验图', 文件: source, 染色: false, 动作: [{名字: '待机', 种类: '循环'}]}];
  const report = await runBatch({manifest, out: path.join(tmp, 'out'), cache: false, sessionFactory: factory, sessionOptions: {freezePolicy: 'value-only'}});
  assert.equal(sessions, 2, '断连后应重开一个会话');
  assert.equal(report.浏览器重开?.length, 1);
  assert.deepEqual(report.错误, []);
  assert(report.通过, JSON.stringify(report.错误));
  console.log('批量重开：断连后重开 1 次，动作重试成功');
} finally {
  await fs.rm(tmp, {recursive: true, force: true});
}
console.log('断连回归通过');
