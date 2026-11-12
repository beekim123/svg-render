// 真 Chrome 精度探针与回归；仅处理实际 fx_overkill/play，所有 Chrome 串行。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {PNG} from 'pngjs';
import {root} from '../setup/paths.mjs';
import {createReferenceSession} from './index.mjs';
import {runBatch} from './batch.mjs';
import {compareImages} from '../compare/metrics.mjs';

const option=name=>process.argv.find(arg=>arg.startsWith(name+'='))?.slice(name.length+1);
const output=path.resolve(root,option('--out')||'out/precision-fx-overkill');
const reportFile=option('--report');
const save=async(file,data)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data,null,2)+'\n');};
const manifest=JSON.parse(await fs.readFile(path.join(root,'素材/清单.json'),'utf8'));
const asset=structuredClone(manifest.find(item=>item.id==='现有游戏/fx_overkill'));
assert(asset,'实际清单缺少fx_overkill');asset.动作=asset.动作.filter(action=>action.名字==='play');assert.equal(asset.动作.length,1);
const action=asset.动作[0],svg=await fs.readFile(path.join(root,asset.文件),'utf8'),times=[200,550,700,750,850];
if(process.argv.includes('--batch')){
 const result=await runBatch({manifest:[asset],out:output,concurrency:1,cache:false});
 if(reportFile)await save(path.resolve(root,reportFile),result);
 console.log(JSON.stringify({输出:output,动作数:result.动作.length,帧数:result.动作[0]?.帧.length,通过:result.通过,错误:result.错误},null,2));
 assert.equal(result.动作[0]?.帧.length,50,'实际play动作必须完整跑50帧');assert.equal(result.通过,true,'实际play完整50帧未全部通过');
}else{
 const session=await createReferenceSession();
 try{
  if(process.argv.includes('--probe')){
   const rows=[];await session.prepare({svg,action,id:asset.id});
   for(const time of times){
    await session.browser.evaluate(`__ref.seek(${1000+time})`);
    const values=await session.browser.evaluate(`['burst_outer','gem_shards_a','gem_shards_b'].map(id=>{const e=document.getElementById(id),typed=e.computedStyleMap().get('transform'),self=e.getCTM(),parent=e.parentNode.getCTM(),m=parent.inverse().multiply(self);let numeric=null,error=null;try{const t=typed.toMatrix();numeric=[t.a,t.b,t.c,t.d,t.e,t.f];}catch(cause){error=cause.message;}return {id,css:getComputedStyle(e).transform,typedClass:typed.constructor.name,typedString:String(typed),numeric,error,local:[m.a,m.b,m.c,m.d,m.e,m.f]};})`);
    rows.push({时刻:time,值:values});
   }
   await session.prepare({svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="none"/><g id="percent" style="transform:translate(50%,0)"><rect width="10" height="10"/></g></svg>',id:'precision/boundaries'});
   const boundaries=await session.browser.evaluate(`['none','percent'].map(id=>{const e=document.getElementById(id),typed=e.computedStyleMap().get('transform');let numeric=null,error=null;try{const m=typed.toMatrix();numeric=[m.a,m.b,m.c,m.d,m.e,m.f];}catch(cause){error=cause.message;}return {id,css:getComputedStyle(e).transform,typedClass:typed.constructor.name,typedString:String(typed),numeric,error};})`);
   const result={Chrome:session.browser.gpuInfo,参数:session.browser.flags,素材:asset.文件,探针:rows,边界:boundaries};
   if(reportFile)await save(path.resolve(root,reportFile),result);console.log(JSON.stringify(result,null,2));
  }else if(process.argv.includes('--boundaries')){
   const switching='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>@keyframes precision-switch{0%,20%{transform:none}40%,60%{transform:translate(50%,0)}80%,100%{transform:translate(12px,0)}}#switching{animation:precision-switch 100ms steps(1,end) both}</style><g id="switching"><rect width="10" height="10" fill="red"/></g></svg>';
   const samples=await session.sampleValues({svg:switching,duration:100,id:'precision/source-switch'});
   const track=samples.轨.find(row=>row.属性==='transform');assert(track);
   assert.equal(track.变换精度.length,samples.时刻.length);
   // 取真实动画的稳定采样；steps恰落关键帧时可能仍处于前一分段。
   assert.equal(track.变换精度[0].来源,'Typed OM none');
   assert.equal(track.变换精度[3].来源,'CSSOM回退');
   assert.equal(track.变换精度.at(-1).来源,'CSS Typed OM');
   const none=await session.render({svg:switching,time:0,id:'precision/none'});
   assert.equal(none.values.find(row=>row.属性==='transform').值,'none');assert.equal(none.verification.通过,true);
   const percent=await session.render({svg:switching,time:60,id:'precision/percent'});
   assert.equal(percent.verification.通过,true,'可准确冻结的translate(50%)不应变成新错误');
   const percentValue=percent.values.find(row=>row.属性==='transform');assert.equal(percentValue.变换精度.来源,'CSSOM回退');assert.equal(percentValue.变换精度.精确矩阵,false);assert(percentValue.变换精度.原因.includes('px'));
   const driftSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 240"><style>@keyframes drift{from,to{transform:translate(50%,0) scale(1.016) rotate(.4deg)}}#drift{transform-origin:240px 120px;transform-box:view-box;animation:drift 1s linear both}</style><g id="drift"><rect x="10" y="10" width="100" height="100" fill="red"/></g></svg>';
   const drift=await session.render({svg:driftSvg,time:200,id:'precision/percent-drift'});
   assert.equal(drift.values.find(row=>row.属性==='transform').变换精度.来源,'CSSOM回退');
   assert.equal(drift.verification.通过,false,'CSSOM回退仍须捕捉超过0.001的真实矩阵漂移');
   assert(drift.verification.错误.some(error=>error.属性==='transform'&&error.活值===error.冻结值),'应在CSS字符串相等时仍拒绝局部矩阵漂移');
   const result={通过:true,采样:samples,none:none.verification,百分比:{值:percentValue,复核:percent.verification},百分比漂移:{值:drift.values,复核:drift.verification}};
   if(reportFile)await save(path.resolve(root,reportFile),result);
   console.log('通过：none原样、合法translate(50%)兼容回退；CSS字符串相等但完整CTM漂移超过0.001仍拒绝；逐20ms来源数组记录none→CSSOM回退→Typed OM。');
  }else{
   const rows=[];
   for(const scale of [1,2])for(const time of times){
    const frame=await session.render({svg,action,time,scale,id:asset.id});
    const comparison=compareImages(PNG.sync.read(frame.png),PNG.sync.read(frame.livePng),{scale});
    const ssim=comparison.分组.find(group=>group.区域==='全图').指标.ssim;
    const stem=path.join(output,`${time}@${scale}x`);
    await save(stem+'.png',frame.png);await save(stem+'-live.png',frame.livePng);await save(stem+'.svg',frame.svg);
    const row={时刻:time,倍率:scale,冻结复核:frame.verification,相似度:ssim,值:frame.values,冻结值:frame.frozenValues,通过:frame.verification.通过&&ssim>=.95};
    await save(stem+'.json',row);rows.push(row);console.log(`${row.通过?'通过':'失败'}：${time}ms @${scale}x；冻结复核=${frame.verification.通过}；SSIM=${ssim}`);
   }
   const result={输出:output,容差:.001,相似度线:.95,通过:rows.every(row=>row.通过),帧:rows};
   if(reportFile)await save(path.resolve(root,reportFile),result);
   assert.equal(rows.length,10);assert.equal(result.通过,true,'实际fx_overkill/play的10个精度回归帧未全部通过');
  }
 }finally{await session.close();}
}
