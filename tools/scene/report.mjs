import fs from 'node:fs/promises';
import path from 'node:path';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const score = row => row.错误 ? 0 : Math.min(...row.分组.map(group => group.指标.ssim));

export async function writeStageReport(directory, {rows, worst, detailsFile, referenceDirectory, skiaDirectory}) {
  await fs.rm(path.join(directory, '帧'), {recursive: true, force: true});
  await fs.rm(path.join(directory, '未过线图'), {recursive: true, force: true});
  await fs.rm(path.join(directory, '未过线.json'), {force: true});
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
  await fs.mkdir(path.dirname(detailsFile), {recursive: true});
  await fs.writeFile(detailsFile, JSON.stringify({线: '静止', 汇总: summary, 帧: rows}) + '\n');
  await fs.writeFile(path.join(directory, '结果.json'), JSON.stringify({线: '静止', 汇总: summary, 素材: [...assets.values()], 未过线: failed, 未过帧: rows.filter(row => !row.通过)}, null, 2) + '\n');
  const imageUrl = filename => path.relative(directory, filename).split(path.sep).map(encodeURIComponent).join('/');
  const viewerRows = rows.map(row => [row.路径, score(row), Number(row.通过)]);
  const viewer = `<h2>全部帧</h2><p>全部帧图像来自本机 out/mac/新画法，最差20帧随报告保存。</p>
<div class="viewer-controls"><label for="frame-filter">筛选帧 <input id="frame-filter" type="search" placeholder="素材、动作或时刻"></label><label for="frame-select">选择帧 <select id="frame-select"></select></label><button id="frame-prev" type="button">上一帧</button><button id="frame-next" type="button">下一帧</button></div>
<p id="frame-count" role="status"></p><article id="frame-viewer"><h3 id="frame-name"></h3><p id="frame-stats"></p><div class="pictures pair"><figure><img id="frame-chrome" alt="Chrome"><figcaption>Chrome</figcaption></figure><figure><img id="frame-skia" alt="Skia"><figcaption>Skia</figcaption></figure></div></article>
<script id="frame-data" type="application/json">${JSON.stringify(viewerRows).replace(/</g, '\\u003c')}</script>
<script>
(() => {
const frames = JSON.parse(document.getElementById('frame-data').textContent);
const chromeDirectory = ${JSON.stringify(imageUrl(referenceDirectory))};
const skiaDirectory = ${JSON.stringify(imageUrl(skiaDirectory))};
const filter = document.getElementById('frame-filter');
const select = document.getElementById('frame-select');
const previous = document.getElementById('frame-prev');
const next = document.getElementById('frame-next');
const viewer = document.getElementById('frame-viewer');
const count = document.getElementById('frame-count');
const chrome = document.getElementById('frame-chrome');
const skia = document.getElementById('frame-skia');
let matching = [];
function showFrame() {
  const index = select.selectedIndex;
  const row = frames[matching[index]];
  viewer.hidden = !row;
  previous.disabled = index <= 0;
  next.disabled = index < 0 || index >= matching.length - 1;
  if (!row) {
    chrome.removeAttribute('src');
    skia.removeAttribute('src');
    document.getElementById('frame-name').textContent = '';
    document.getElementById('frame-stats').textContent = '';
    return;
  }
  document.getElementById('frame-name').textContent = row[0];
  document.getElementById('frame-stats').textContent = 'SSIM ' + row[1].toFixed(8) + ' · ' + (row[2] ? '通过' : '未过线');
  const filename = row[0].split('/').map(encodeURIComponent).join('/');
  chrome.src = chromeDirectory + '/' + filename;
  skia.src = skiaDirectory + '/' + filename;
}
function filterFrames() {
  const selected = select.value;
  const query = filter.value.trim().toLocaleLowerCase();
  matching = [];
  const options = document.createDocumentFragment();
  frames.forEach((row, index) => {
    if (!row[0].toLocaleLowerCase().includes(query)) return;
    matching.push(index);
    options.appendChild(new Option(row[0], String(index)));
  });
  select.replaceChildren(options);
  select.disabled = !matching.length;
  if (selected !== '' && matching.includes(Number(selected))) select.value = selected;
  count.textContent = matching.length ? '显示 ' + matching.length + ' / ' + frames.length + ' 帧' : '没有匹配的帧。共 ' + frames.length + ' 帧。';
  showFrame();
}
filter.addEventListener('input', filterFrames);
select.addEventListener('change', showFrame);
previous.addEventListener('click', () => { select.selectedIndex--; showFrame(); });
next.addEventListener('click', () => { select.selectedIndex++; showFrame(); });
filterFrames();
})();
</script>`;
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>新画法 · Skia 对 Chrome</title><style>body{margin:24px;font:15px system-ui;background:#f4f5f7;color:#17202a}article{background:white;padding:20px;margin:20px 0}.pictures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.pictures.pair{grid-template-columns:repeat(2,minmax(0,1fr))}.viewer-controls{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.viewer-controls label{max-width:100%}input,select,button{font:inherit;padding:6px;max-width:100%}figure{margin:0}img{max-width:100%;background:repeating-conic-gradient(#ddd 0% 25%,#fff 0% 50%) 0/16px 16px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:8px;border-bottom:1px solid #ccc}pre{white-space:pre-wrap}@media(max-width:700px){.pictures,.pictures.pair{grid-template-columns:1fr}}</style><h1>新画法 · Skia 对 Chrome</h1><p>静止线，1 倍与 2 倍。素材 ${summary.素材通过数}/${summary.素材数} 过线，帧 ${summary.通过帧数}/${summary.帧数} 过线，最低 SSIM ${summary.最低相似度.toFixed(8)}。阈值沿用阈值.json。</p><p>对原参照 7439/7522，差别来自 Chrome 合成层，见 HANDOFF。</p><h2>最差的 20 帧</h2>${cards.join('\n')}${viewer}<h2>全部素材</h2><table><thead><tr><th>素材</th><th>通过 / 帧数</th><th>最低 SSIM</th></tr></thead><tbody>${[...assets.values()].sort((a,b)=>a.最低相似度-b.最低相似度).map(asset=>`<tr><td>${escape(asset.素材)}</td><td>${asset.通过帧数} / ${asset.帧数}</td><td>${asset.最低相似度.toFixed(8)}</td></tr>`).join('')}</tbody></table><h2>未过线帧</h2><pre>${escape(JSON.stringify(failed, null, 2))}</pre><p><a href="结果.json">汇总与未过帧指标</a> · <a href="${imageUrl(detailsFile)}">全部逐帧指标（out）</a></p></html>`;
  await fs.writeFile(path.join(directory, 'index.html'), html);
  return summary;
}

function reason(row) {
  return row.错误 || row.分组.filter(group => !group.通过).map(group => `${group.区域}：${group.未通过.join('、')}`).join('；');
}
