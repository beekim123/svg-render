import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {openChrome} from '../chrome/index.mjs';
import {setSvgContent} from '../chrome/svg.mjs';
import {exportScene} from './export-page.mjs';

const html = () => '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style>';

export async function exportFrozenSvg(page, svg, {source = '冻结SVG', layers = false, tracks = []} = {}) {
  await setSvgContent(page, svg, html, source);
  const size = await page.evaluate('(()=>{const svg=document.querySelector("svg");return {width:svg.width.baseVal.value,height:svg.height.baseVal.value};})()');
  await page.viewport(size.width, size.height);
  return page.evaluate(`(${exportScene.toString()})(document.querySelector('svg'), ${JSON.stringify({layers, tracks})})`);
}

export async function createSceneExportSession({browser: suppliedBrowser, ...options} = {}) {
  const browser = suppliedBrowser || await openChrome(options);
  return {
    browser,
    export: ({svg, ...settings}) => exportFrozenSvg(browser, svg, settings),
    close: () => suppliedBrowser ? Promise.resolve() : browser.close()
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('用法：node tools/scene/export.mjs INPUT.svg OUTPUT.json');
  const session = await createSceneExportSession();
  try {
    const scene = await session.export({svg: await fs.readFile(input, 'utf8'), source: input});
    await fs.mkdir(path.dirname(path.resolve(output)), {recursive: true});
    await fs.writeFile(output, JSON.stringify(scene, null, 2) + '\n');
    console.log(`场景已导出：${output} (${scene.width}×${scene.height})`);
  } finally {
    await session.close();
  }
}
