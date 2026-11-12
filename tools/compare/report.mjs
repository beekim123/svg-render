import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const median = values => { values.sort((a, b) => a - b); const n = values.length; return n ? (values[Math.floor((n - 1) / 2)] + values[Math.floor(n / 2)]) / 2 : null; };
const metrics = ['ssim', '大差比例_不算边', '最大差异块', '平均偏色'];
export function summarize(rows) {
  const groups = rows.flatMap(row => (row.分组 ?? []).filter(group => group.区域 !== '全图' || row.分组.length === 1));
  return { 配对数: rows.length, 通过数: rows.filter(r => r.通过).length, '2倍上限数': rows.filter(r => r.分类 === '2倍上限').length, 失败数: rows.filter(r => !r.通过 && r.分类 !== '2倍上限').length, 错误数: rows.filter(r => r.错误).length,
    指标: Object.fromEntries(metrics.map(key => { const values = groups.map(g => g.指标[key]); return [key, { 最差: values.length ? (key === 'ssim' ? Math.min(...values) : Math.max(...values)) : null, 中位数: median(values) }]; })) };
}
const score = row => row.错误 ? -Infinity : Math.min(...row.分组.map(g => g.指标.ssim));
const display = value => typeof value === 'number' ? Number(value.toPrecision(8)).toString() : String(value);
export async function writeReport(dir, report) {
  await mkdir(dir, { recursive: true });
  report.汇总 = summarize(report.配对);
  report.配对.sort((a, b) => score(a) - score(b));
  const cards = report.配对.map((row, i) => `<article><h2>${escape(row.路径)} <span class="${row.分类 === '2倍上限' ? 'limit' : row.通过 ? 'pass' : 'fail'}">${row.错误 ? '出错' : row.分类 === '2倍上限' ? '2倍上限' : row.通过 ? '通过' : '未通过'}</span></h2>${row.错误 ? `<p>${escape(row.错误)}</p>` : `
    <div class="pictures"><figure><img id="toggle-${i}" src="${row.图片.甲}" alt="甲图，点击切换到乙图" data-a="${row.图片.甲}" data-b="${row.图片.乙}" onclick="const b=this.dataset.showing==='b';this.src=b?this.dataset.a:this.dataset.b;this.dataset.showing=b?'a':'b';this.nextElementSibling.textContent=b?'甲（点击切换）':'乙（点击切换）'"><figcaption>甲（点击切换）</figcaption></figure><figure><img src="${row.图片.乙}" alt="乙图"><figcaption>乙</figcaption></figure><figure><img src="${row.图片.差异}" alt="差异放大八倍"><figcaption>差异 ×8；绿色表示不算边的大差像素</figcaption></figure></div>
    <p>${row.宽} × ${row.高}，${row.倍率} 倍，${row.耗时毫秒.toFixed(1)} 毫秒</p>
    ${row.分组.map(g => `<h3>${escape(g.区域)} · ${escape(g.线)}线 · ${g.通过 ? '通过' : `未通过：${escape(g.未通过.join('、'))}`}${g.区域 === '全图' && row.分组.length > 1 ? '（全图只供参考，按文字和非文字两组判定）' : ''}</h3><p>采用${escape(g.指标.底)}底，内容 ${g.指标.内容像素} 像素</p><dl>${Object.entries(g.指标).filter(([k]) => !['底', '内容像素'].includes(k)).map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(Array.isArray(v) ? v.map(display).join(', ') : display(v))}${g.阈值[k] === undefined ? '' : `（线：${k === 'ssim' ? '≥' : '≤'} ${escape(display(g.阈值[k]))}）`}</dd>`).join('')}</dl>`).join('')}`}</article>`).join('\n');
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SVG 图像对照报告</title><style>body{font:15px system-ui;margin:24px;background:#f4f5f7;color:#17202a}article{background:white;padding:20px;margin:24px 0;border-radius:8px}h1,h2{line-height:1.35}.pass{color:#067242}.fail{color:#b62424}.limit{color:#956200}.pictures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0}img{max-width:100%;background:repeating-conic-gradient(#ddd 0% 25%,#fff 0% 50%) 0/16px 16px;cursor:pointer}figcaption{margin-top:8px}dl{display:grid;grid-template-columns:180px 1fr}dt,dd{margin:0;padding:4px;border-bottom:1px solid #eee}pre{white-space:pre-wrap}@media(max-width:700px){.pictures{grid-template-columns:1fr}}</style><h1>SVG 图像对照报告</h1>${report.说明 ? `<p><strong>${escape(report.说明)}</strong></p>` : ''}<p>共 ${report.汇总.配对数} 对，通过 ${report.汇总.通过数} 对，2倍上限 ${report.汇总['2倍上限数']} 对，失败 ${report.汇总.失败数} 对，出错 ${report.汇总.错误数} 对。按相似度从低到高排列。</p><p>所有比例均为 0–1 的比值；0.001 表示 0.1%。汇总取参与判定的区域。平均绝对差为 RGB 三通道绝对差的平均。所有图片已嵌入，此网页无需网络或本地服务。</p><pre>${escape(JSON.stringify(report.汇总.指标, null, 2))}</pre>${cards}</html>`;
  await writeFile(join(dir, '结果.json'), JSON.stringify(report, null, 2));
  await writeFile(join(dir, 'index.html'), html);
  return report;
}
