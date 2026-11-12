// 真Chrome扫描原始公开fixture：其他XML namespace的rect不能冒充SVG rect，也不能崩整批。
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {openChrome} from '../chrome/index.mjs';
import {setSvgContent} from '../chrome/svg.mjs';
import {cache} from '../setup/paths.mjs';
import {resvgRevision} from '../setup/install.mjs';
import {scanPage} from './page.mjs';
import {countPathSegments} from './path-data.mjs';
import {classify,scanExitCode} from './cli.mjs';
import {selectRegistered,assessRegistered} from './selection.mjs';
const scope=JSON.parse(await fs.readFile(new URL('../../支持范围.json',import.meta.url)));
const file=path.join(cache,'tests/resvg',resvgRevision,'crates/resvg/tests/tests/structure/svg/xmlns-validation.svg');
const browser=await openChrome();
try{
 const svg=await fs.readFile(file,'utf8');
 await setSvgContent(browser,svg,s=>`<!doctype html><style>body{margin:0}</style>${s}`,file);
 const snapshot=await browser.evaluate(`(${scanPage.toString()})(${countPathSegments.toString()})`);
 const foreign='元素命名空间/http://www.example.org/notsvg/rect';
 assert.equal(snapshot.特性计数[foreign],1);
 assert.equal(snapshot.特性计数['元素/rect'],2,'只能计入两个真正SVG namespace的rect');
 const result={id:'namespace',状态:'完成',分类:Object.fromEntries(Object.keys(snapshot.特性计数).map(k=>[k,classify(k,scope)])),动作:[snapshot]};
 assert.equal(result.分类[foreign],'没登记');
 const asset={id:'namespace',批:'公开测试集',动作:[{静态:true}]};
 const selected=selectRegistered([asset],[result]);
 assert.equal(selected.registered.length,0);
 assert(selected.excluded[0].原因.some(s=>s.includes(foreign)));
 assert.equal(assessRegistered(selected.registered,[result]).状态,'完成','排除候选不污染登记验收');
 const assessment=assessRegistered([{...asset,批:'现有游戏'}],[result]);
 assert(assessment.待人工决定.some(x=>x.特性===foreign));
 assert.equal(scanExitCode({状态:'待验证',待人工决定:assessment.待人工决定}),3,'正式清单未知仍须停');
 console.log('通过：真实xmlns-validation保留其他namespace未知，SVG矩形计数正确；公开候选有理由排除，正式登记未知返回3。');
}finally{await browser.close();}
