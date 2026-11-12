// 截图稳定性定向实验：用正式出图流程反复出同一帧，看冻结图是否每次逐字节相同。
// 用法：node 实验/capture/probe.mjs <做法> [次数] [素材id] [毫秒] [前一帧：毫秒@倍率，默认 同毫秒@1]
//   做法：new（现在的默认：截到连续两次相同、不扩视口）| current（原做法）| no-beyond（截图不扩视口）| all-stages（加 --run-all-compositor-stages-before-draw）
//        | stable（截到连续两次相同为止）| all-stages-no-beyond
import fs from 'node:fs/promises';
import path from 'node:path';
import {createReferenceSession, sha256} from '../../tools/ref/index.mjs';
import {resolveAssetPath} from '../../tools/scan/path.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const [variant = 'current', countText = '20', assetId = '复杂测试图/scene_hall', timeText = '2666.6667', previousText] = process.argv.slice(2);
const count = Number(countText);
const time = Number(timeText);
const scale = 2;
const [previousTime, previousScale] = previousText ? previousText.split('@').map(Number) : [time, 1];

const manifest = JSON.parse(await fs.readFile(path.join(ROOT, '素材/清单.json'), 'utf8'));
const assets = Array.isArray(manifest) ? manifest : manifest.素材;
const asset = assets.find(a => a.id === assetId);
if (!asset) throw new Error(`清单里没有 ${assetId}`);
const action = asset.动作[0];
const svg = await fs.readFile(resolveAssetPath(asset), 'utf8');

const platform = process.platform === 'darwin' ? 'mac' : 'linux';
const formalFile = path.join(ROOT, 'out', platform, 'ref', assetId, action.名字, `${time}@${scale}x.png`);
const formalHash = sha256(await fs.readFile(formalFile));

const extra = variant.startsWith('all-stages') ? ['--run-all-compositor-stages-before-draw'] : [];
const session = await createReferenceSession({extra});
const originalShot = session.frozen.shot;
const beyond = !variant.endsWith('no-beyond');
const send = session.frozen.send;
const rawShot = async clip => Buffer.from((await send('Page.captureScreenshot', {format: 'png', clip: {...clip, scale: 1}, captureBeyondViewport: beyond})).data, 'base64');
if (variant === 'stable') {
  session.frozen.shot = async clip => {
    let previous = await rawShot(clip);
    for (let i = 0; i < 10; i++) {
      const next = await rawShot(clip);
      if (next.equals(previous)) return next;
      previous = next;
    }
    throw new Error('连截 10 次仍不稳定');
  };
} else if (variant === 'current') {
  // 原做法：一次截图、扩视口。
  session.frozen.shot = async clip => Buffer.from((await send('Page.captureScreenshot', {format: 'png', clip: {...clip, scale: 1}, captureBeyondViewport: true})).data, 'base64');
} else if (variant !== 'new') {
  session.frozen.shot = rawShot;
}

const outDir = path.join(ROOT, 'out', platform, 'capture-probe', `${variant}-前${previousTime}@${previousScale}`);
await fs.mkdir(outDir, {recursive: true});
const rows = [];
try {
  for (let i = 0; i < count; i++) {
    // 正式流程里 2 倍帧之前总有 1 倍帧，视口会从 1920 变到 3840；这里照样走一遍。
    await session.render({svg, id: assetId, action, scale: previousScale, time: previousTime});
    const started = performance.now();
    const frame = await session.render({svg, id: assetId, action, scale, time});
    const hash = sha256(frame.png);
    const same = hash === formalHash;
    if (!same) await fs.writeFile(path.join(outDir, `${i}.png`), frame.png);
    rows.push({次: i, 哈希: hash, 等于正式参照: same, 毫秒: Math.round(performance.now() - started), 截图次数: frame.metadata.截图次数?.冻结图 ?? null});
    console.log(`${variant} ${i + 1}/${count} ${same ? '相同' : '不同'} ${hash.slice(0, 12)} ${rows.at(-1).毫秒}ms 截图${rows.at(-1).截图次数 ?? '-'}次`);
  }
} finally {
  await session.close();
}
const distinct = new Set(rows.map(r => r.哈希)).size;
const summary = {做法: variant, 前一帧: `${previousTime}@${previousScale}x`, 素材: assetId, 毫秒: time, 倍率: scale, 次数: count, 不同哈希数: distinct, 等于正式参照: rows.filter(r => r.等于正式参照).length, 启动参数补充: extra, 截图扩视口: beyond, 行: rows};
await fs.writeFile(path.join(outDir, '结果.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({做法: variant, 次数: count, 不同哈希数: distinct, 等于正式参照: summary.等于正式参照}));
