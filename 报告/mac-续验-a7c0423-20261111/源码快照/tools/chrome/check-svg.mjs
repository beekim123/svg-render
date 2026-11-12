// 真 Chrome 回归：XML 前缀 SVG 仍须在 HTML 页面里扫描、冻结和重载。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {cache} from '../setup/paths.mjs';
import {resvgRevision} from '../setup/install.mjs';
import {createReferenceSession} from '../ref/index.mjs';

const fixture=path.join(cache,'tests/resvg',resvgRevision,'crates/resvg/tests/tests/structure/svg/explicit-svg-namespace.svg');
const prefixed=await fs.readFile(fixture,'utf8');
// 与公开原件同一几何/颜色，使用默认SVG namespace；不改原件。
const ordinary='<svg id="svg1" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><title>Explicit `svg` namespace</title><rect id="rect1" x="20" y="20" width="160" height="160" fill="green"/><rect id="frame" x="1" y="1" width="198" height="198" fill="none" stroke="black"/></svg>';
const childPrefixed='<svg id="svg1" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg"><svg:title>Explicit `svg` namespace</svg:title><svg:rect id="rect1" x="20" y="20" width="160" height="160" fill="green"/><svg:rect id="frame" x="1" y="1" width="198" height="198" fill="none" stroke="black"/></svg>';
const nestedOrdinary='<svg id="outer" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><svg id="inner" width="20" height="20"><rect x="1" y="1" width="18" height="18" fill="blue"/></svg><rect id="outside" x="40" y="40" width="50" height="50" fill="red"/></svg>';
const nestedPrefixed='<s:svg id="outer" xmlns:s="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><svg id="inner" width="20" height="20"><rect x="1" y="1" width="18" height="18" fill="blue"/></svg><s:rect id="outside" x="40" y="40" width="50" height="50" fill="red"/></s:svg>';
const session=await createReferenceSession();
try{
 for(const scale of [1,2]){
  const plain=await session.render({svg:ordinary,scale,id:'namespace/plain'});
  let actual;
  try{actual=await session.render({svg:prefixed,scale,id:'namespace/prefixed'});}
  catch(cause){assert.fail(`真实XML前缀SVG在${scale}倍HTML内嵌/冻结路径失败（${fixture}）：${cause.message}`);}
  assert.deepEqual(actual.png,plain.png,`${scale}倍前缀/普通SVG的真实冻结PNG不同`);
  assert.deepEqual(actual.livePng,plain.livePng,`${scale}倍前缀/普通SVG的真实活图不同`);
  assert.equal(actual.verification.通过,true);
  const context=await session.frozen.evaluate(`(()=>{const s=document.querySelector('svg');return {html:document.contentType,svg:s instanceof SVGSVGElement,namespace:s?.namespaceURI,viewBox:s?.getAttribute('viewBox'),lowercase:s?.hasAttribute('viewbox'),box:s?[s.viewBox.baseVal.width,s.viewBox.baseVal.height]:null,fill:getComputedStyle(document.getElementById('rect1')).fill,display:getComputedStyle(s).display,margin:getComputedStyle(document.body).marginTop,fontFaces:[...document.fonts].filter(f=>f.family.replaceAll('"','').replaceAll("'",'')==='Noto Sans CJK SC').length,loaded:document.fonts.check('400 16px "Noto Sans CJK SC"')&&document.fonts.check('700 16px "Noto Sans CJK SC"')};})()`);
  assert.deepEqual(context,{html:'text/html',svg:true,namespace:'http://www.w3.org/2000/svg',viewBox:'0 0 200 200',lowercase:false,box:[200,200],fill:'rgb(0, 128, 0)',display:'block',margin:'0px',fontFaces:2,loaded:true});
  // render已经真实冻结并载入乙页；再把该冻结文本送回完整入口，验证第二轮序列化/重载。
  const reloaded=await session.render({svg:actual.svg,scale,id:'namespace/frozen-reload'});
  assert.deepEqual(reloaded.png,actual.png,`${scale}倍冻结文本再载入丢失SVG语义`);
  assert.equal(reloaded.verification.通过,true);
  console.log(`通过：${scale}倍真实前缀/普通SVG的活图与冻结PNG逐字节一致；冻结再载入保持namespace/viewBox和HTML字体样式上下文。`);
  const children=await session.render({svg:childPrefixed,scale,id:'namespace/child-prefixed'});
  assert.equal(children.png.equals(plain.png),true,`${scale}倍普通SVG根/带前缀子元素的真实冻结PNG不同`);
  assert.equal(children.livePng.equals(plain.livePng),true,`${scale}倍普通SVG根/带前缀子元素的真实活图不同`);
  assert.equal(children.verification.通过,true);
  const childContext=await session.frozen.evaluate(`(()=>{const s=document.querySelector('svg'),r=document.getElementById('rect1');return {root:s instanceof SVGSVGElement,rect:r instanceof SVGRectElement,namespace:r?.namespaceURI,localName:r?.localName,viewBox:s?.getAttribute('viewBox')};})()`);
  assert.deepEqual(childContext,{root:true,rect:true,namespace:'http://www.w3.org/2000/svg',localName:'rect',viewBox:'0 0 200 200'});
  const childReloaded=await session.render({svg:children.svg,scale,id:'namespace/child-prefixed-reload'});
  assert.equal(childReloaded.png.equals(children.png),true,`${scale}倍带前缀子元素的冻结文本再载入不同`);
  assert.equal(childReloaded.livePng.equals(children.livePng),true,`${scale}倍带前缀子元素的冻结文本再载入活图不同`);
  console.log(`通过：${scale}倍普通SVG根/带前缀子元素与普通SVG的活图、冻结PNG逐字节一致；子元素namespace和冻结再载入均正确。`);
  const nestedPlain=await session.render({svg:nestedOrdinary,scale,id:'namespace/nested-plain'});
  const nestedActual=await session.render({svg:nestedPrefixed,scale,id:'namespace/nested-prefixed'});
  assert.equal(nestedActual.png.equals(nestedPlain.png),true,`${scale}倍前缀外根/普通嵌套svg的真实冻结PNG不同，可能误选内层根`);
  assert.equal(nestedActual.livePng.equals(nestedPlain.livePng),true,`${scale}倍前缀外根/普通嵌套svg的真实活图不同`);
  assert.equal(nestedActual.metadata.width,200*scale);
  assert.equal(nestedActual.metadata.height,200*scale);
  const nestedContext=await session.frozen.evaluate(`(()=>{const root=document.body.firstElementChild,inner=document.getElementById('inner'),outside=document.getElementById('outside');return {root:root instanceof SVGSVGElement,id:root?.id,viewBox:root?.getAttribute('viewBox'),inner:inner instanceof SVGSVGElement,outside:outside instanceof SVGRectElement};})()`);
  assert.deepEqual(nestedContext,{root:true,id:'outer',viewBox:'0 0 200 200',inner:true,outside:true});
  const nestedReloaded=await session.render({svg:nestedActual.svg,scale,id:'namespace/nested-prefixed-reload'});
  assert.equal(nestedReloaded.png.equals(nestedActual.png),true,`${scale}倍前缀外根的冻结文本再载入丢失外层图元`);
  assert.equal(nestedReloaded.livePng.equals(nestedActual.livePng),true,`${scale}倍前缀外根的冻结文本再载入活图不同`);
  console.log(`通过：${scale}倍前缀外根/普通嵌套svg与普通等价图的活图、冻结PNG及冻结重载逐字节一致；正确保留200×200外根及外层图元。`);
 }
 for(const [id,svg,reason]of [
  ['fixture/malformed-prefixed.svg','<s:svg xmlns:s="http://www.w3.org/2000/svg"><s:rect></s:svg>','XML解析失败'],
  ['fixture/not-svg.xml','<not-svg/>','XML根不是SVG命名空间中的svg元素'],
  ['fixture/wrong-namespace.svg','<s:svg xmlns:s="urn:not-svg"/>','XML根不是SVG命名空间中的svg元素']
 ]){
  await assert.rejects(()=>session.prepare({svg,id}),error=>error.message.includes(`来源：${id}`)&&error.message.includes(reason),`${id}未给出可定位的真实解析错误`);
  assert.equal(await session.browser.evaluate(`document.querySelector('svg') instanceof SVGSVGElement`),false);
  console.log(`通过：${id}明确拒绝，并保留来源和解析原因。`);
 }
}finally{await session.close();}
