// 一次性诊断：不修改生产源码、Chrome参数、阈值或素材。
import fs from 'node:fs/promises';
import path from 'node:path';
import {PNG} from 'pngjs';
import {root} from '../../../tools/setup/paths.mjs';
import {createReferenceSession,commandLog,sha256} from '../../../tools/ref/index.mjs';
import {installTimeline} from '../../../tools/ref/page.mjs';
import {verifyValues} from '../../../tools/ref/verify.mjs';
import {compareImages} from '../../../tools/compare/metrics.mjs';

const out=import.meta.dirname;
const save=async(file,value)=>{const target=path.join(out,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');};
const code={};for(const file of ['tools/ref/page.mjs','tools/ref/index.mjs','参照版本.json'])code[file]=sha256(await fs.readFile(path.join(root,file)));
const manifest=JSON.parse(await fs.readFile(path.join(root,'素材/清单.json'),'utf8'));
const cases=[{key:'rule-sign-200-1x',id:'现有游戏/ui_rule_sign',action:'flip',time:200,scale:1},{key:'rainbow-red-100-1x',id:'现有游戏/ui_rainbow_slot',action:'light',time:100,scale:1,color:'#E3263A'}];
const full=m=>m?[m.a,m.b,m.c,m.d,m.e,m.f]:null;
function snapshot(){
 const full=m=>m?[m.a,m.b,m.c,m.d,m.e,m.f]:null;
 const number=value=>typeof value==='number'?String(value):value&&typeof value.value==='number'?String(value.value)+(value.unit==='number'?'':value.unit):String(value);
 const component=value=>{
  const type=value.constructor.name,record={type,text:String(value)};
  for(const key of ['x','y','z','angle','ax','ay'])if(key in value)record[key]=typeof value[key]==='number'?value[key]:{value:value[key].value,unit:value[key].unit};
  try{record.matrix=full(value.toMatrix());}catch(error){record.matrixError=error.message;}
  if(type==='CSSScale'&&value.is2D)record.preciseFunction=`scale(${number(value.x)}, ${number(value.y)})`;
  else if(type==='CSSRotate'&&value.is2D)record.preciseFunction=`rotate(${number(value.angle)})`;
  else if(type==='CSSTranslate'&&value.is2D)record.preciseFunction=`translate(${number(value.x)}, ${number(value.y)})`;
  else if(type==='CSSSkew')record.preciseFunction=`skew(${number(value.ax)}, ${number(value.ay)})`;
  else if(type==='CSSSkewX')record.preciseFunction=`skewX(${number(value.ax)})`;
  else if(type==='CSSSkewY')record.preciseFunction=`skewY(${number(value.ay)})`;
  else if(type==='CSSMatrixComponent'&&value.is2D)record.preciseFunction=`matrix(${full(value.matrix).join(', ')})`;
  return record;
 };
 const root=document.body.firstElementChild,nodes=[root,...root.querySelectorAll('*')];
 return {documentType:document.contentType,visibility:document.visibilityState,nodes:nodes.map((element,index)=>{
  const style=getComputedStyle(element),typed=element.computedStyleMap().get('transform');
  const components=typed&&typeof typed[Symbol.iterator]==='function'?[...typed].map(component):null;
  const record={index,node:element.getAttribute('data-svg-render-node'),id:element.id,tag:element.localName,ctm:full(element.getCTM?.()),screenCTM:full(element.getScreenCTM?.()),attributes:{style:element.getAttribute('style'),transform:element.getAttribute('transform')},style:{transform:style.transform,origin:style.transformOrigin,box:style.transformBox,filter:style.filter,opacity:style.opacity,willChange:style.willChange,color:style.color,fill:style.fill,stroke:style.stroke,isolation:style.isolation,blendMode:style.mixBlendMode,animation:style.animationName},typed:{type:typed?.constructor.name,text:String(typed),components}};
  if(String(typed)==='none')record.preciseFunction='none';
  else if(components?.every(item=>item.preciseFunction))record.preciseFunction=components.map(item=>item.preciseFunction).join(' ');
  return record;
 })};
}
function ctmDifference(live,frozen){
 const byNode=new Map(frozen.nodes.map(node=>[Number(node.node??node.index),node]));
 const rows=[];for(const node of live.nodes){const other=byNode.get(node.index);if(!node.ctm||!other?.ctm)continue;const differences=node.ctm.map((value,index)=>Math.abs(value-other.ctm[index]));rows.push({node:node.index,id:node.id,max:Math.max(...differences),live:node.ctm,frozen:other.ctm});}
 return {max:Math.max(0,...rows.map(row=>row.max)),nodes:rows};
}
function imageDifference(live,frozen,scale){const result=compareImages(PNG.sync.read(frozen),PNG.sync.read(live),{scale});delete result.差异图;const ssim=result.分组.find(group=>group.区域==='全图').指标.ssim;return {ssim,原相似度线通过:ssim>=.95,四指标:result.分组};}
const summary={时间:new Date().toISOString(),源码:code,实验边界:'仅诊断两帧及两类可逆冻结变体；不改变生产源码/Chrome参数/阈值/原件。',案例:[]};
let session;
try{
 session=await createReferenceSession();summary.Chrome=session.browser.gpuInfo;summary.参数=session.browser.flags;
 for(const item of cases){
  const asset=manifest.find(asset=>asset.id===item.id),action=asset.动作.find(action=>action.名字===item.action),svg=await fs.readFile(path.join(root,asset.文件),'utf8');
  const frame=await session.render({svg,action,time:item.time,scale:item.scale,color:item.color,id:item.id});
  const clip={x:0,y:0,width:frame.metadata.width,height:frame.metadata.height};
  await save(item.key+'/live.png',frame.livePng);await save(item.key+'/baseline.png',frame.png);await save(item.key+'/baseline.svg',frame.svg);
  const live=await session.browser.evaluate(`(${snapshot.toString()})()`),baseline=await session.frozen.evaluate(`(${snapshot.toString()})()`);
  await session.frozen.evaluate(`window.__diagnosticBaseline=document.body.firstElementChild.cloneNode(true)`);
  await save(item.key+'/live.json',live);await save(item.key+'/baseline.json',baseline);await save(item.key+'/values.json',{live:frame.values,frozen:frame.frozenValues,verification:frame.verification,metadata:frame.metadata});
  await save(item.key+'/live.oplog.json',await commandLog(session.browser));await save(item.key+'/baseline.oplog.json',await commandLog(session.frozen));
  const result={...item,baseline:{...imageDifference(frame.livePng,frame.png,item.scale),复核:frame.verification,CTM:ctmDifference(live,baseline)},变体:[]};
  console.log(`${item.key} 基线 SSIM=${result.baseline.ssim}，CTM最大差=${result.baseline.CTM.max}，值复核=${frame.verification.通过}`);
  const transformRows=frame.values.filter(row=>row.来自==='css'&&row.属性==='transform').map(row=>{const node=live.nodes[row.节点号];if(!node?.preciseFunction)throw new Error(`无法按Typed OM组件保留函数序列：${row.节点号}/${row.元素id}`);return {node:row.节点号,value:node.preciseFunction};});
  const animatedNodes=[...new Set(frame.values.filter(row=>row.来自==='css'&&['transform','opacity'].includes(row.属性)).map(row=>row.节点号))];
  for(const variant of ['typed-functions','will-change']){
   await session.frozen.evaluate(`(()=>{document.body.firstElementChild.replaceWith(window.__diagnosticBaseline.cloneNode(true));const root=document.body.firstElementChild;${variant==='typed-functions'?`for(const row of ${JSON.stringify(transformRows)}){const e=root.getAttribute('data-svg-render-node')===String(row.node)?root:root.querySelector('[data-svg-render-node="'+row.node+'"]');e.setAttribute('style',(e.getAttribute('style')||'')+';transform:'+row.value+' !important;');}`:`for(const node of ${JSON.stringify(animatedNodes)}){const e=root.getAttribute('data-svg-render-node')===String(node)?root:root.querySelector('[data-svg-render-node="'+node+'"]');e.setAttribute('style',(e.getAttribute('style')||'')+';will-change:transform, opacity !important;');}`}})()`);
   await session.frozen.evaluate(`(${installTimeline.toString()})()`);await session.frozen.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
   const png=await session.frozen.shot(clip),state=await session.frozen.evaluate(`(${snapshot.toString()})()`),values=await session.frozen.evaluate(`__ref.read(${JSON.stringify(frame.values)})`);
   const verification=verifyValues(frame.values,values),row={类型:variant,...imageDifference(frame.livePng,png,item.scale),复核:verification,CTM:ctmDifference(live,state),变换函数:variant==='typed-functions'?transformRows:null};
   row.按原两项通过=row.原相似度线通过&&verification.通过;
   result.变体.push(row);await save(item.key+'/'+variant+'.png',png);await save(item.key+'/'+variant+'.json',{state,values,result:row});await save(item.key+'/'+variant+'.svg',await session.frozen.evaluate(`new XMLSerializer().serializeToString(document.body.firstElementChild)`));await save(item.key+'/'+variant+'.oplog.json',await commandLog(session.frozen));
   console.log(`${item.key} ${variant} SSIM=${row.ssim}，CTM最大差=${row.CTM.max}，值复核=${verification.通过}`);
  }
  summary.案例.push(result);await save('summary.json',summary);
 }
}catch(error){summary.错误=error.stack;throw error;}
finally{if(session)await session.close();summary.结束时间=new Date().toISOString();for(const file of Object.keys(code))if(sha256(await fs.readFile(path.join(root,file)))!==code[file])summary.源码运行中变化=(summary.源码运行中变化||[]).concat(file);await save('summary.json',summary);}
