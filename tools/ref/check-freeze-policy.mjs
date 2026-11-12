// 两帧两策略真实对照；默认像素失败是决策证据，不能当作默认通过。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {PNG} from 'pngjs';
import {root} from '../setup/paths.mjs';
import {createReferenceSession} from './index.mjs';
import {verifyValues} from './verify.mjs';
import {compareImages} from '../compare/metrics.mjs';

const option=name=>process.argv.find(arg=>arg.startsWith(name+'='))?.slice(name.length+1);
const out=path.resolve(root,option('--out')||'out/freeze-policy-comparison');
const reportFile=option('--report');
const save=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');};
const manifest=JSON.parse(await fs.readFile(path.join(root,'素材/清单.json'),'utf8'));
const targets=[{key:'rule-sign-200-1x',id:'现有游戏/ui_rule_sign',action:'flip',time:200},{key:'rainbow-red-100-1x',id:'现有游戏/ui_rainbow_slot',action:'light',time:100,color:'#E3263A'}];
const results=[],frames=new Map();
for(const policy of ['value-only','preserve-layers']){
 const session=await createReferenceSession(policy==='value-only'?{}:{freezePolicy:policy});
 try{
  for(const target of targets){
   const asset=manifest.find(asset=>asset.id===target.id),action=asset.动作.find(action=>action.名字===target.action),svg=await fs.readFile(path.join(root,asset.文件),'utf8');
   const frame=await session.render({svg,action,time:target.time,color:target.color,id:target.id});frames.set(policy+'/'+target.key,frame);
   const comparison=compareImages(PNG.sync.read(frame.png),PNG.sync.read(frame.livePng)),ssim=comparison.分组.find(group=>group.区域==='全图').指标.ssim;
   const state=await session.frozen.evaluate(`({cssAnimations:document.getAnimations().length,smil:document.querySelectorAll('animate,animateTransform,animateMotion,set').length})`);
   const byKey=new Map(frame.frozenValues.map(row=>[row.节点号+'/'+row.属性+'/'+row.来自,row]));
   const differences=frame.values.filter(row=>row.完整局部矩阵).flatMap(row=>row.完整局部矩阵.map((value,index)=>Math.abs(value-byKey.get(row.节点号+'/'+row.属性+'/'+row.来自).完整局部矩阵[index])));
   const result={case:target.key,请求策略:policy,实际策略:session.freezePolicy??null,元数据策略:frame.metadata.冻结策略??null,相似度:ssim,按原像素线通过:ssim>=.95,PNG逐字节相同:frame.png.equals(frame.livePng),冻结复核:frame.verification,冻结状态:state,最大完整矩阵差:Math.max(0,...differences),冻结合成提示:frame.metadata.冻结合成提示};
   results.push(result);const stem=path.join(out,policy,target.key);await save(stem+'.png',frame.png);await save(stem+'-live.png',frame.livePng);await save(stem+'.svg',frame.svg);await save(stem+'.json',{...result,值:frame.values,冻结值:frame.frozenValues});console.log(`${policy} ${target.key}：SSIM=${ssim}；原像素线=${result.按原像素线通过}；值复核=${frame.verification.通过}；PNG逐字节相同=${result.PNG逐字节相同}`);
  }
 }finally{await session.close();}
}
if(reportFile)await save(path.resolve(root,reportFile),{默认策略:'value-only',候选状态:'preserve-layers待用户/Fable决定',结果:results});
for(const target of targets){
 const baseline=results.find(row=>row.请求策略==='value-only'&&row.case===target.key),candidate=results.find(row=>row.请求策略==='preserve-layers'&&row.case===target.key);
 assert.equal(baseline.冻结复核.通过,true);assert.equal(baseline.按原像素线通过,false,'默认只固化值应如实保留已知像素失败，不能暗中补合成hint');
 assert.equal(candidate.冻结复核.通过,true);assert.equal(candidate.PNG逐字节相同,true);assert.equal(candidate.按原像素线通过,true);
 for(const row of [baseline,candidate]){assert.equal(row.实际策略,row.请求策略);assert.equal(row.元数据策略,row.请求策略);assert.deepEqual(row.冻结状态,{cssAnimations:0,smil:0});assert(row.最大完整矩阵差<=.001);}
 assert.deepEqual(baseline.冻结合成提示,[]);
 assert.equal(verifyValues(frames.get('value-only/'+target.key).values,frames.get('preserve-layers/'+target.key).values).通过,true,'候选不能改变原活值/来源/完整CTM');
 assert.equal(verifyValues(frames.get('value-only/'+target.key).frozenValues,frames.get('preserve-layers/'+target.key).frozenValues).通过,true,'两策略的冻结值/完整CTM应一致');
}
console.log('对照通过：默认两帧值通过但像素未过线；显式候选两帧仍无动画、CTM不变且PNG逐字节相同。候选未成为默认验收标准。');
