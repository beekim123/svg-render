import fs from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve(process.argv[2] || '报告/阶段1A');
const report = JSON.parse(await fs.readFile(path.join(directory, '结果.json'), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const quote = value => `'${value.replace(/'/g, `'\\''`)}'`;
const grouped = new Map();
for (const row of report.未过帧) {
  const id = row.路径.split('/')[1].replace(/@[0-9a-f]{6}$/i, '');
  if (!grouped.has(id)) grouped.set(id, []);
  grouped.get(id).push(row);
}
const cases = [];
await fs.rm(path.join(directory, '未过线图'), {recursive: true, force: true});
await fs.mkdir(path.join(directory, '未过线图'), {recursive: true});
for (const [id, rows] of grouped) {
  const row = rows[0];
  const stem = `未过线图/${id}`;
  const files = {Chrome: `${stem}-Chrome.png`, Skia: `${stem}-Skia.png`, 冻结SVG: `${stem}.svg`, 场景: `${stem}.json`};
  const frozen = row.甲.replace(`${path.sep}ref-img${path.sep}`, `${path.sep}ref${path.sep}`).replace(/@1x\.png$/, '.svg').replace(/\.png$/, '.svg');
  const scene = row.乙.replace(`${path.sep}skia${path.sep}`, `${path.sep}scene${path.sep}`).replace(/\.png$/, '.json');
  for (const [from, to] of [[row.甲, files.Chrome], [row.乙, files.Skia], [frozen, files.冻结SVG], [scene, files.场景]]) {
    await fs.copyFile(from, path.join(directory, to));
  }
  const relative = key => path.relative(process.cwd(), path.join(directory, files[key]));
  const commands = [
    `SVG_RENDER_CACHE=/private/tmp/svg-render-mac-cache node tools/scene/export.mjs ${quote(relative('冻结SVG'))} ${quote(relative('场景'))}`,
    `out/mac/scene/scene-draw ${quote(relative('场景'))} 1 ${quote(relative('Skia'))}`,
    `npm run compare -- ${quote(relative('Chrome'))} ${quote(relative('Skia'))} --线 静止 --倍率 ${row.倍率} --报告 ${quote(`out/mac/新画法/单帧对照/${id}`)}`,
  ];
  cases.push({素材: id, 未过帧数: rows.length, 代表帧: row.路径, 指标: row.分组, 文件: files, 复现命令: commands,
    原因: row.错误 || row.分组.filter(group => !group.通过).map(group => `${group.区域}：${group.未通过.join('、')}`).join('；'),
    未过帧: rows.map(item => item.路径),
  });
}
const diagnosis = {
  状态: cases.length ? 'A 静止线：有未过帧' : 'A 静止线：全部通过',
  汇总: report.汇总,
  阈值: '沿用阈值.json，未修改',
  参照说明: '静止线使用 Chrome 整图参照。对原参照 7439/7522，差别来自 Chrome 合成层，见 HANDOFF。',
  编译命令: 'SVG_RENDER_CACHE=/private/tmp/svg-render-mac-cache node tools/scene/build.mjs out/mac/scene',
  素材: cases,
  帧: report.未过线,
};
await fs.writeFile(path.join(directory, '未过线.json'), JSON.stringify(diagnosis, null, 2) + '\n');
const section = `<section id="handoff"><h2>未过线素材</h2><p>${escape(diagnosis.状态)}。阈值保持原值。<a href="未过线.json">未过帧与复现命令</a>。</p>${cases.map(item => `<details><summary>${escape(item.素材)} · ${item.未过帧数} 帧 · ${escape(item.代表帧)}</summary><p>${escape(item.原因)}</p><div class="pictures pair"><figure><img loading="lazy" src="${item.文件.Chrome}" alt="Chrome"><figcaption>Chrome</figcaption></figure><figure><img loading="lazy" src="${item.文件.Skia}" alt="Skia"><figcaption>Skia</figcaption></figure></div><pre>${escape(item.复现命令.join('\n'))}</pre></details>`).join('')}</section>`;
const file = path.join(directory, 'index.html');
let html = await fs.readFile(file, 'utf8');
html = html.replace(/<section id="handoff">[\s\S]*?<\/section>/, '');
html = html.replace('<h2>未过线帧</h2>', section + '<h2>未过线帧</h2>');
await fs.writeFile(file, html);
console.log(JSON.stringify({素材: cases.length, 未过帧: report.未过线.length}));
