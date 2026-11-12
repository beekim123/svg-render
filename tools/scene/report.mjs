import fs from 'node:fs/promises';
import path from 'node:path';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const score = row => row.错误 ? 0 : Math.min(...row.分组.map(group => group.指标.ssim));

export async function writeStageReport(directory, {rows, worst}) {
  await fs.mkdir(path.join(directory, '帧'), {recursive: true});
  rows.sort((a, b) => score(a) - score(b));
  const assets = new Map();
  for (const row of rows) {
    const id = row.路径.split('/').slice(0, 2).join('/').replace(/@[0-9a-f]{6}$/i, '');
    if (!assets.has(id)) assets.set(id, {素材: id, 帧数: 0, 通过帧数: 0, 最低相似度: 1});
    const asset = assets.get(id);
    asset.帧数++;
    asset.通过帧数 += Number(row.通过);
    asset.最低相似度 = Math.min(asset.最低相似度, score(row));
  }
  const summary = {
    素材数: assets.size,
    素材通过数: [...assets.values()].filter(asset => asset.帧数 === asset.通过帧数).length,
    帧数: rows.length,
    通过帧数: rows.filter(row => row.通过).length,
    出错帧数: rows.filter(row => row.错误).length,
    最低相似度: Math.min(...rows.map(score)),
  };
  const cards = [];
  for (const [index, row] of worst.entries()) {
    const pictures = [];
    for (const [key, label] of [['甲', 'Chrome'], ['乙', 'Skia'], ['差异', '差异 ×8']]) {
      const filename = `帧/${String(index + 1).padStart(2, '0')}-${label.replace(' ×8', '')}.png`;
      if (row.图片) {
        await fs.writeFile(path.join(directory, filename), Buffer.from(row.图片[key].split(',')[1], 'base64'));
        pictures.push(`<figure><img loading="lazy" src="${filename}" alt="${label}"><figcaption>${label}</figcaption></figure>`);
      }
    }
    cards.push(`<article><h2>${index + 1}. ${escape(row.路径)} · ${row.通过 ? '通过' : '未过线'}</h2><p>SSIM ${score(row).toFixed(8)}${row.错误 ? ` · ${escape(row.错误)}` : ''}</p><div class="pictures">${pictures.join('')}</div><p>${escape(reason(row))}</p></article>`);
  }
  const failed = rows.filter(row => !row.通过).map(row => ({帧: row.路径, 原因: reason(row)}));
  await fs.writeFile(path.join(directory, '结果.json'), JSON.stringify({线: '静止', 汇总: summary, 素材: [...assets.values()], 未过线: failed, 帧: rows}, null, 2) + '\n');
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>新画法 · Skia 对 Chrome</title><style>body{margin:24px;font:15px system-ui;background:#f4f5f7;color:#17202a}article{background:white;padding:20px;margin:20px 0}.pictures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0}img{max-width:100%;background:repeating-conic-gradient(#ddd 0% 25%,#fff 0% 50%) 0/16px 16px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:8px;border-bottom:1px solid #ccc}pre{white-space:pre-wrap}@media(max-width:700px){.pictures{grid-template-columns:1fr}}</style><h1>新画法 · Skia 对 Chrome</h1><p>静止线，1 倍与 2 倍。素材 ${summary.素材通过数}/${summary.素材数} 过线，帧 ${summary.通过帧数}/${summary.帧数} 过线，最低 SSIM ${summary.最低相似度.toFixed(8)}。阈值沿用阈值.json。</p><h2>最差的 20 帧</h2>${cards.join('\n')}<h2>全部素材</h2><table><thead><tr><th>素材</th><th>通过 / 帧数</th><th>最低 SSIM</th></tr></thead><tbody>${[...assets.values()].sort((a,b)=>a.最低相似度-b.最低相似度).map(asset=>`<tr><td>${escape(asset.素材)}</td><td>${asset.通过帧数} / ${asset.帧数}</td><td>${asset.最低相似度.toFixed(8)}</td></tr>`).join('')}</tbody></table><h2>未过线帧</h2><pre>${escape(JSON.stringify(failed, null, 2))}</pre><p><a href="结果.json">全部逐帧指标</a></p></html>`;
  await fs.writeFile(path.join(directory, 'index.html'), html);
  return summary;
}

function reason(row) {
  return row.错误 || row.分组.filter(group => !group.通过).map(group => `${group.区域}：${group.未通过.join('、')}`).join('；');
}
