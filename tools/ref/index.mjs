import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {openChrome,VERSION} from '../chrome/index.mjs';
import {setSvgContent} from '../chrome/svg.mjs';
import {verifyValues} from './verify.mjs';
import {installTimeline} from './page.mjs';
const root=path.resolve(import.meta.dirname,'../..');
export const TOOL_VERSION='stage0-ref-3';
export function validateFreezePolicy(policy){if(!['value-only','preserve-layers'].includes(policy))throw new Error(`未知或缺失的冻结策略：${policy}`);return policy;}
export async function resolveFreezePolicy(explicit){if(explicit!==undefined)return validateFreezePolicy(explicit);const config=JSON.parse(await fs.readFile(path.join(root,'参照版本.json'),'utf8'));return validateFreezePolicy(config.冻结策略===undefined?'value-only':config.冻结策略);}
export const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
export const triggersAction=action=>Boolean(action&&(action.触发||action.smil||action.名字&&action.名字!=='待机'));
const frames='new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))';
async function fontServer(){const files=new Map();for(const weight of ['Regular','Bold']){const name=`NotoSansCJKsc-${weight}.otf`;files.set('/'+name,await fs.readFile(path.join(root,'素材/字体',name)));}const server=http.createServer((req,res)=>{const b=files.get(req.url);res.setHeader('Access-Control-Allow-Origin','*');if(!b){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','font/otf');res.end(b);});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});return {url:`http://127.0.0.1:${server.address().port}`,hashes:Object.fromEntries([...files].map(([k,b])=>[k.slice(1),sha256(b)])),close:()=>new Promise((r,j)=>server.close(e=>e?j(e):r()))};}
export async function commandLog(page){let layers=[];const off=page.on(m=>{if(m.method==='LayerTree.layerTreeDidChange')layers=m.params.layers||[];});await page.send('LayerTree.enable');try{await page.evaluate(frames);await page.shot({x:0,y:0,width:1,height:1});await page.evaluate(frames);const result=[];for(const layer of layers.filter(l=>l.drawsContent&&l.width>0&&l.height>0)){const {snapshotId}=await page.send('LayerTree.makeSnapshot',{layerId:layer.layerId});try{const {commandLog}=await page.send('LayerTree.snapshotCommandLog',{snapshotId});result.push({layerId:layer.layerId,width:layer.width,height:layer.height,commands:commandLog});}finally{await page.send('LayerTree.releaseSnapshot',{snapshotId});}}if(!result.length)throw new Error('未捕获到绘图层，指令记录不能为空');return result;}finally{off();await page.send('LayerTree.disable');}}
export async function createReferenceSession(options={}){
 const freezePolicy=await resolveFreezePolicy(options.freezePolicy),timelineOptions=JSON.stringify({freezePolicy});
 const {freezePolicy:requestedPolicy,...browserOptions}=options;
 const browser=await openChrome(browserOptions);let fonts;try{fonts=await fontServer();}catch(e){await browser.close();throw e;}let frozen;try{frozen=await browser.newPage();}catch(e){await browser.close();await fonts.close();throw e;}
 const html=svg=>`<!doctype html><meta charset="utf-8"><style>@font-face{font-family:'Noto Sans CJK SC';font-weight:400;src:url('${fonts.url}/NotoSansCJKsc-Regular.otf')}@font-face{font-family:'Noto Sans CJK SC';font-weight:700;src:url('${fonts.url}/NotoSansCJKsc-Bold.otf')}html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`;
 const load=async(page,svg,scale,source)=>{await setSvgContent(page,svg,html,source);const size=await page.evaluate(`(()=>{const s=document.querySelector('svg');const v=s.viewBox.baseVal;const w=(v.width||s.width.baseVal.value)*${scale},h=(v.height||s.height.baseVal.value)*${scale};if(!(w>0&&h>0))throw new Error('SVG 尺寸无效');s.setAttribute('width',w);s.setAttribute('height',h);return {width:w,height:h};})()`);await page.viewport(size.width,size.height);await page.evaluate(`Promise.all([document.fonts.load('400 16px "Noto Sans CJK SC"'),document.fonts.load('700 16px "Noto Sans CJK SC"')]).then(()=>document.fonts.ready)`);await page.evaluate(frames);return size;};
 const prepare=async({svg,scale=1,action,triggerTime=1000,color,id=''})=>{const size=await load(browser,svg,scale,id||'参照SVG');if(color)await browser.evaluate(`document.querySelector('svg').style.color=${JSON.stringify(color)}`);await browser.evaluate(`(${installTimeline.toString()})(${timelineOptions})`);if(triggersAction(action)){await browser.evaluate(`__ref.seek(${triggerTime});__ref.trigger(${JSON.stringify(action)});`);}return size;};
 const render=async({svg,scale=1,time=0,action,triggerTime=1000,color,oplog=false,id='',...rest})=>{const size=await prepare({svg,scale,action,triggerTime,color,id});const globalTime=time+(triggersAction(action)?triggerTime:0);await browser.evaluate(`__ref.seek(${globalTime})`);await browser.evaluate(frames);const data=await browser.evaluate('__ref.freeze()'),textBoxes=await browser.evaluate('__ref.textBoxes()');const clip={x:0,y:0,...size};const livePng=await browser.shot(clip);await load(frozen,data.svg,1,`${id||'参照SVG'} 冻结SVG`);await frozen.viewport(size.width,size.height); // 冻结 SVG 已经带有显示尺寸，不再按 viewBox 缩放。
 await frozen.evaluate(`(()=>{const s=document.querySelector('svg');s.setAttribute('width',${size.width});s.setAttribute('height',${size.height});})()`);await frozen.evaluate(frames);const png=await frozen.shot(clip);await frozen.evaluate(`(${installTimeline.toString()})(${timelineOptions})`);const frozenValues=await frozen.evaluate(`__ref.read(${JSON.stringify(data.values)})`);const verification=verifyValues(data.values,frozenValues);if(data.freezePolicy!==freezePolicy)throw new Error('页面冻结策略与会话实际策略不一致');return {png,livePng,svg:data.svg,values:data.values,frozenValues,verification,metadata:{素材:id,动作:action?.名字||'待机',时刻:time,全局时刻:globalTime,倍率:scale,Chrome版本:VERSION,完整启动参数:browser.flags,光栅信息:browser.gpuInfo,源文件指纹:sha256(svg),文字区域:textBoxes,工具版本:TOOL_VERSION,字体指纹:fonts.hashes,冻结策略:freezePolicy,冻结复核:verification,冻结合成提示:data.compositeHints||[],...size},...(oplog?{oplog:await commandLog(frozen)}:{})};};
 const sampleValues=async({svg,scale=1,action,triggerTime=1000,color,duration=0,id=''})=>{
  await prepare({svg,scale,action,triggerTime,color});const times=[];for(let t=0;t<=duration;t+=20)times.push(t);
  const rows=[];for(const time of times){await browser.evaluate(`__ref.seek(${time+(triggersAction(action)?triggerTime:0)})`);rows.push(await browser.evaluate('__ref.read()'));}
  const tracks=new Map(),sampleFields=['局部矩阵','完整局部矩阵','变换精度'];
  for(let index=0;index<rows.length;index++)for(const row of rows[index]){
   const key=`${row.节点号}/${row.属性}/${row.来自??''}`;
   if(!tracks.has(key)){const track={...row,值:Array(times.length).fill(null)};for(const field of sampleFields)if(Object.hasOwn(row,field))track[field]=Array(times.length).fill(null);tracks.set(key,track);}
   const track=tracks.get(key);track.值[index]=row.值;
   for(const field of sampleFields)if(Object.hasOwn(row,field)){if(!Array.isArray(track[field]))track[field]=Array(times.length).fill(null);track[field][index]=row[field];}
  }
  return {id,动作:action?.名字||'待机',步长毫秒:20,时刻:times,轨:[...tracks.values()]};
 };
 return {browser,frozen,prepare,render,freezePolicy,fonts:fonts.hashes,close:async()=>{try{await browser.close();}finally{await fonts.close();}},sampleValues};
}
export async function captureStatic({svg,scale=1,output,oplog=false,...options}){const s=await createReferenceSession(options);try{const r=await s.render({svg,scale,oplog});if(output){await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,r.png);const stem=output.replace(/\.png$/,'');await fs.writeFile(stem+'.json',JSON.stringify(r.metadata,null,2));await fs.writeFile(stem+'.svg',r.svg);if(oplog)await fs.writeFile(stem+'.oplog.json',JSON.stringify(r.oplog,null,2));}return r;}finally{await s.close();}}
