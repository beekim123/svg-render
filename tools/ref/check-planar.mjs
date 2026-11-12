// 真实Chrome数值平面精度回归：is2D容器标志不能代替16项数值判定。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {PNG} from 'pngjs';
import {root} from '../setup/paths.mjs';
import {createReferenceSession} from './index.mjs';
import {runBatch} from './batch.mjs';
import {compareImages} from '../compare/metrics.mjs';

const option=name=>process.argv.find(arg=>arg.startsWith(name+'='))?.slice(name.length+1);
const out=path.resolve(root,option('--out')||'out/planar-ui-door');
const reportFile=option('--report');
const save=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n');};
const manifest=JSON.parse(await fs.readFile(path.join(root,'素材/清单.json'),'utf8'));
const asset=structuredClone(manifest.find(asset=>asset.id==='现有游戏/ui_door'));assert(asset);asset.动作=asset.动作.filter(action=>action.名字==='open');assert.equal(asset.动作.length,1);
const action=asset.动作[0],svg=await fs.readFile(path.join(root,asset.文件),'utf8'),times=[0,300,599.5];
if(process.argv.includes('--batch')){
 const result=await runBatch({manifest:[asset],out,concurrency:1,cache:false});if(reportFile)await save(path.resolve(root,reportFile),result);
 console.log(JSON.stringify({输出:out,通过:result.通过,动作数:result.动作.length,帧数:result.动作[0]?.帧.length,最低相似度:Math.min(...(result.动作[0]?.帧.map(frame=>frame.相似度)||[])),错误:result.错误},null,2));
 assert.equal(result.动作.length,1);assert.equal(result.动作[0]?.帧.length,34);assert.equal(result.通过,true,'ui_door/open完整两倍率仍有失败');
}else{
 const session=await createReferenceSession();
 try{
  if(process.argv.includes('--probe')){
   const rows=[];await session.prepare({svg,action,id:asset.id});
   for(const time of times){
    await session.browser.evaluate(`__ref.seek(${1000+time})`);
    const values=await session.browser.evaluate(`['leaf','door_ring'].map(id=>{const e=document.getElementById(id),typed=e.computedStyleMap().get('transform'),m=typed.toMatrix();return {id,css:getComputedStyle(e).transform,is2D:m.is2D,matrix:Array.from(m.toFloat64Array()),components:[...typed].map(component=>{const value={type:component.constructor.name,text:String(component),is2D:component.is2D};try{const matrix=component.toMatrix();value.matrix=Array.from(matrix.toFloat64Array());value.matrixIs2D=matrix.is2D;}catch(error){value.error=error.message;}return value;})};})`);
    rows.push({时刻:time,值:values});
   }
   const result={Chrome:session.browser.gpuInfo,参数:session.browser.flags,素材:asset.文件,探针:rows};if(reportFile)await save(path.resolve(root,reportFile),result);console.log(JSON.stringify(result,null,2));
  }else{
   const rows=[];
   for(const scale of [1,2])for(const time of times){
    try{
     const frame=await session.render({svg,action,scale,time,id:asset.id}),comparison=compareImages(PNG.sync.read(frame.png),PNG.sync.read(frame.livePng),{scale}),ssim=comparison.分组.find(group=>group.区域==='全图').指标.ssim;
     const row={时刻:time,倍率:scale,相似度:ssim,冻结复核:frame.verification,通过:frame.verification.通过&&ssim>=.95};rows.push(row);
     const stem=path.join(out,`${time}@${scale}x`);await save(stem+'.png',frame.png);await save(stem+'-live.png',frame.livePng);await save(stem+'.svg',frame.svg);await save(stem+'.json',{...row,值:frame.values,冻结值:frame.frozenValues});console.log(`${row.通过?'通过':'失败'}：ui_door/open ${time}ms @${scale}x；SSIM=${ssim}；值复核=${frame.verification.通过}`);
    }catch(error){rows.push({时刻:time,倍率:scale,通过:false,错误:error.message});console.error(`失败：ui_door/open ${time}ms @${scale}x；${error.message}`);}
   }
   const result={通过:rows.every(row=>row.通过),帧:rows};if(reportFile)await save(path.resolve(root,reportFile),result);assert.equal(rows.length,6);assert.equal(result.通过,true,'实际纯2D函数列插值不能因容器is2D=false被拒');
   for(const transform of ['rotateY(20deg)','translateZ(1px)','perspective(500px)','translateZ(0.000000000001px)']){
    const input=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>@keyframes reject{from,to{transform:${transform}}}#nonplanar{animation:reject 1s linear both}</style><g id="nonplanar"><rect width="20" height="20"/></g></svg>`;
    await assert.rejects(()=>session.render({svg:input,time:200,id:'planar/reject-'+transform}),error=>error.message.includes('不是支持范围内的2D矩阵'),`真正非平面${transform}未被拒绝`);
    console.log(`通过：严格拒绝真正非平面${transform}，未使用近似epsilon。`);
   }
  }
 }finally{await session.close();}
}
