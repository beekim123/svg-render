// 真Chrome实体输入/统一XML加载回归；仅在独立产物目录写证据。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {root,cache} from '../setup/paths.mjs';
import {resvgRevision} from '../setup/install.mjs';
import {createReferenceSession} from '../ref/index.mjs';
import {setSvgContent} from './svg.mjs';
import {PNG} from 'pngjs';
import {compareImages} from '../compare/metrics.mjs';

const option=name=>process.argv.find(arg=>arg.startsWith(name+'='))?.slice(name.length+1);
const out=path.resolve(root,option('--out')||'out/entity-loading');
const reportFile=option('--report');
const save=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');};
const sourceRoot=path.join(cache,'tests/resvg',resvgRevision,'crates/resvg/tests/tests/structure/svg');
const sources=[];
for(const [name,title,group]of [['elements-via-ENTITY-reference-1','Elements via ENTITY reference (1)',true],['attribute-value-via-ENTITY-reference','Attribute value via ENTITY reference',false]]){
 const rect='<rect id="rect1" x="20" y="20" width="160" height="160" fill="green"/>';
 sources.push({name,svg:await fs.readFile(path.join(sourceRoot,name+'.svg'),'utf8'),plain:`<svg id="svg1" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><title>${title}</title>${group?'<g id="g1">'+rect+'</g>':rect}<rect id="frame" x="1" y="1" width="198" height="198" fill="none" stroke="black"/></svg>`});
}
const session=await createReferenceSession();
try{
 if(process.argv.includes('--size-probe')){
  const rows=[],testsRoot=path.dirname(path.dirname(sourceRoot));
  for(const relative of ['structure/svg/negative-size.svg','structure/svg/zero-size.svg','structure/svg/no-size.svg','filters/feMorphology/radius-larger-than-region.svg','filters/feMorphology/centered-kernel.svg','filters/feMorphology/fractional-radius.svg']){
   const svg=await fs.readFile(path.join(testsRoot,relative),'utf8');
   await setSvgContent(session.browser,svg,source=>`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style>${source}`,relative);
   const measured=await session.browser.evaluate(`(()=>{const s=document.querySelector('svg'),v=s.viewBox.baseVal,width=v.width||s.width.baseVal.value,height=v.height||s.height.baseVal.value;return {width,height,valid:Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0,viewBox:s.getAttribute('viewBox'),widthAttribute:s.getAttribute('width'),heightAttribute:s.getAttribute('height'),formula:'v.width || s.width.baseVal.value；v.height || s.height.baseVal.value'};})()`);
   rows.push({file:relative,...measured});
  }
  if(reportFile)await save(path.resolve(root,reportFile),rows);console.log(JSON.stringify(rows,null,2));
 }else if(process.argv.includes('--probe')){
  await session.browser.setHtml('<!doctype html><meta charset="utf-8"><style>body{margin:0}svg{display:block}</style>');
  const rows=[];
  for(const source of [...sources,{name:'malformed',svg:'<svg xmlns="http://www.w3.org/2000/svg"><g></svg>'},{name:'valid-svg-parsererror',svg:'<svg xmlns="http://www.w3.org/2000/svg"><parsererror id="literal"/></svg>'}]){
   const value=await session.browser.evaluate(`(()=>{const xml=new DOMParser().parseFromString(${JSON.stringify(source.svg)},'image/svg+xml'),root=xml.documentElement;const result={root:{name:root?.localName,namespace:root?.namespaceURI,type:root?.constructor.name},rects:xml.getElementsByTagNameNS('http://www.w3.org/2000/svg','rect').length,parsererrors:[...xml.getElementsByTagName('parsererror')].map(e=>({name:e.localName,namespace:e.namespaceURI,parent:e.parentElement?.localName,text:e.textContent})),xml:new XMLSerializer().serializeToString(xml)};if(root instanceof SVGSVGElement){document.body.replaceChildren(document.importNode(root,true));const rect=document.getElementById('rect1');result.fill=rect?getComputedStyle(rect).fill:null;result.fillAttribute=rect?.getAttribute('fill');}return result;})()`);
   rows.push({name:source.name,...value});
  }
  if(reportFile)await save(path.resolve(root,reportFile),rows);console.log(JSON.stringify(rows,null,2));
 }else if(process.argv.includes('--smoke')){
  const manifest=JSON.parse(await fs.readFile(path.join(root,'素材/清单.json'),'utf8')),rows=[];
  for(const item of [{id:'现有游戏/ui_heart',action:'gain',time:455.0066},{id:'现有游戏/ui_rainbow_slot',action:'light',time:100,color:'#E3263A'},{id:'现有游戏/ui_rule_sign',action:'flip',time:200},{id:'复杂测试图/char_golem',action:'受击',time:50},{id:'复杂测试图/char_golem',action:'受击',time:50,triggerTime:1234}]){
   const asset=manifest.find(asset=>asset.id===item.id),action=asset.动作.find(action=>action.名字===item.action),svg=await fs.readFile(path.join(root,asset.文件),'utf8');
   const frame=await session.render({svg,action,time:item.time,triggerTime:item.triggerTime||1000,color:item.color,id:item.id});
   const comparison=compareImages(PNG.sync.read(frame.png),PNG.sync.read(frame.livePng)),ssim=comparison.分组.find(group=>group.区域==='全图').指标.ssim;
   const key=item.id.replaceAll('/','-')+'-'+item.action+'-'+(item.triggerTime||1000),row={...item,相似度:ssim,冻结复核:frame.verification,通过:frame.verification.通过&&ssim>=.95};rows.push(row);
   await save(path.join(out,key+'.png'),frame.png);await save(path.join(out,key+'-live.png'),frame.livePng);await save(path.join(out,key+'.svg'),frame.svg);await save(path.join(out,key+'.json'),{...row,值:frame.values,冻结值:frame.frozenValues});console.log(`${row.通过?'通过':'失败'}：${key}；SSIM=${ssim}；值复核=${frame.verification.通过}`);
  }
  if(reportFile)await save(path.resolve(root,reportFile),{通过:rows.every(row=>row.通过),结果:rows});assert(rows.every(row=>row.通过),'统一XML加载后的UI/golem代表帧冒烟失败');
 }else{
  const rows=[];
  for(const source of sources)for(const scale of [1,2]){
   const plain=await session.render({svg:source.plain,scale,id:'entity/plain/'+source.name});
   const frame=await session.render({svg:source.svg,scale,id:'entity/'+source.name});
   const dom=await session.browser.evaluate(`(()=>{const s=document.body.firstElementChild,r=document.getElementById('rect1');return {documentType:document.contentType,root:s?.localName,namespace:s?.namespaceURI,rects:s?.getElementsByTagNameNS('http://www.w3.org/2000/svg','rect').length,fill:r?getComputedStyle(r).fill:null,fillAttribute:r?.getAttribute('fill')};})()`);
   const key=source.name+'@'+scale+'x';await save(path.join(out,key+'.png'),frame.png);await save(path.join(out,key+'-live.png'),frame.livePng);await save(path.join(out,key+'-plain.png'),plain.png);await save(path.join(out,key+'.svg'),frame.svg);
   const row={name:source.name,scale,dom,PNG相同:frame.png.equals(plain.png),活图相同:frame.livePng.equals(plain.livePng),冻结复核:frame.verification};row.通过=dom.rects===2&&dom.fill==='rgb(0, 128, 0)'&&row.PNG相同&&row.活图相同&&frame.verification.通过;rows.push(row);console.log(`${row.通过?'通过':'失败'}：${key}；rect=${dom.rects}；fill=${dom.fill}；冻结PNG相同=${row.PNG相同}；活图相同=${row.活图相同}`);
  }
  const result={通过:rows.every(row=>row.通过),结果:rows};if(reportFile)await save(path.resolve(root,reportFile),result);assert.equal(result.通过,true,'真实DTD实体元素/属性未正确加载并匹配展开等价图');
  for(const [id,svg]of [['literal-parsererror','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><parsererror id="literal"/><rect width="5" height="5"/></svg>'],['foreign-namespace','<svg xmlns="http://www.w3.org/2000/svg" xmlns:u="urn:custom" viewBox="0 0 10 10"><u:box id="foreign"/><rect width="5" height="5"/></svg>']]){
   await session.prepare({svg,id});const actual=await session.browser.evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id==='literal-parsererror'?'literal':'foreign')});return {name:e.localName,namespace:e.namespaceURI};})()`);
   assert.deepEqual(actual,id==='literal-parsererror'?{name:'parsererror',namespace:'http://www.w3.org/2000/svg'}:{name:'box',namespace:'urn:custom'});console.log(`通过：合法XML的${id}原样保留，不伪造输入错误或特性归类。`);
  }
  for(const [id,svg]of [['bad-xml','<svg xmlns="http://www.w3.org/2000/svg"><g></svg>'],['wrong-root','<wrong xmlns="urn:custom"/>']]){
   await assert.rejects(()=>session.prepare({svg,id}),error=>error.code==='SVG_INPUT_INVALID'&&error.source===id&&Boolean(error.details),`${id}应保留明确XML验证输入错误码及完整原因`);console.log(`通过：${id}具有SVG_INPUT_INVALID及来源/完整原因。`);
  }
  const protocol=new Error('回归夹具：XML解析失败字样来自CDP异常');
  await assert.rejects(()=>setSvgContent({setHtml:async()=>{},evaluate:async()=>{throw protocol;}},'<svg/>',svg=>svg,'protocol-fixture'),error=>error.code!=='SVG_INPUT_INVALID'&&error.message.includes('CDP异常'),'实现/协议异常不能被误当输入错误');
  console.log('通过：协议异常即使含XML解析失败字样，也保持普通阻塞错误。');
 }
}finally{await session.close();}
