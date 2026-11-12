// 显式preserve-layers候选回归；默认value-only对照见check-freeze-policy，不代表候选已获批准。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {PNG} from 'pngjs';
import {root} from '../setup/paths.mjs';
import {createReferenceSession} from './index.mjs';
import {runBatch} from './batch.mjs';
import {compareImages} from '../compare/metrics.mjs';

const option=name=>process.argv.find(arg=>arg.startsWith(name+'='))?.slice(name.length+1);
const out=path.resolve(root,option('--out')||'out/composite-regression');
const reportFile=option('--report');
const save=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');};
const manifest=JSON.parse(await fs.readFile(path.join(root,'素材/清单.json'),'utf8'));
const selected=[['现有游戏/ui_heart','gain'],['现有游戏/ui_rainbow_slot','light'],['现有游戏/ui_rule_sign','flip']];
const sessionOptions={freezePolicy:'preserve-layers'};
if(process.argv.includes('--additive')){
 const session=await createReferenceSession(sessionOptions);
 try{
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="additive" style="will-change:scroll-position"><animateTransform attributeName="transform" type="translate" values="0 0;10 6" dur="100ms" fill="freeze"/><animateTransform attributeName="transform" type="scale" values="1;2" additive="sum" dur="100ms" fill="freeze"/><rect x="10" y="10" width="20" height="20" fill="red"/></g></svg>';
  const frame=await session.render({svg,time:50,id:'composite/smil-additive'}),rows=frame.values.filter(row=>row.元素id==='additive'&&row.属性==='transform');
  assert.equal(rows.length,1,'同来源additive SMIL应合并最终animVal，不能拆成互相覆盖的轨');assert.equal(rows[0].来自,'smil');assert.equal(rows[0].写回,'attribute');
  const numbers=(rows[0].值.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[]).map(Number);assert.deepEqual(numbers,[1.5,0,0,1.5,5,3]);
  assert.equal(frame.verification.通过,true);assert.deepEqual(frame.metadata.冻结合成提示,[],'仅SMIL动画不能伪造CSS来源合成提示');
  const state=await session.frozen.evaluate(`({css:document.getAnimations().length,smil:document.querySelectorAll('animateTransform').length,hint:getComputedStyle(document.getElementById('additive')).willChange})`);
  assert.deepEqual(state,{css:0,smil:0,hint:'scroll-position'});
  const comparison=compareImages(PNG.sync.read(frame.png),PNG.sync.read(frame.livePng));const ssim=comparison.分组.find(group=>group.区域==='全图').指标.ssim;assert(ssim>=.95);
  if(reportFile)await save(path.resolve(root,reportFile),{通过:true,值:rows,冻结值:frame.frozenValues,冻结复核:frame.verification,冻结状态:state,相似度:ssim});
  console.log(`通过：两个同来源SMIL additive合并为最终animVal矩阵，值复核通过、SSIM=${ssim}、冻结无动画，未添加CSS合成提示并保留原hint。`);
 }finally{await session.close();}
}else if(process.argv.includes('--batch')||process.argv.includes('--golem')){
 const pairs=process.argv.includes('--golem')?[['复杂测试图/char_golem','受击']]:selected;
 const assets=pairs.map(([id,name])=>{const asset=structuredClone(manifest.find(item=>item.id===id));assert(asset,`缺实际素材：${id}`);asset.动作=asset.动作.filter(action=>action.名字===name);assert.equal(asset.动作.length,1);return asset;});
 const result=await runBatch({manifest:assets,out,concurrency:1,cache:false,sessionOptions});
 if(reportFile)await save(path.resolve(root,reportFile),result);
 const frames=result.动作.flatMap(action=>action.帧),summary={输出:out,通过:result.通过,动作:result.动作.map(action=>({id:action.素材,动作:action.动作,帧数:action.帧.length,通过:action.通过})),帧数:frames.length,最差相似度:Math.min(...frames.map(frame=>frame.相似度)),错误:result.错误};
 console.log(JSON.stringify(summary,null,2));
 if(process.argv.includes('--golem')){assert.equal(result.动作.length,2);assert.equal(frames.length,52,'受击及switch1234应各26帧');}else assert.equal(result.动作.length,4,'应包含三个UI动作和rainbow两种染色，共四个实际case');
 assert.equal(result.通过,true,'实际动作仍有值/像素失败');
}else{
 const targets=[
  {id:'现有游戏/ui_heart',name:'gain',time:455.0066,scale:1},
  {id:'现有游戏/ui_rainbow_slot',name:'light',time:50,scale:2,color:'#3FE3F0'},
  {id:'现有游戏/ui_rainbow_slot',name:'light',time:100,scale:1,color:'#E3263A'},
  ...[150,200,250].map(time=>({id:'现有游戏/ui_rule_sign',name:'flip',time,scale:1}))
 ];
 const session=await createReferenceSession(sessionOptions),rows=[];
 try{
  for(const target of targets){
   const asset=manifest.find(item=>item.id===target.id),action=asset.动作.find(item=>item.名字===target.name),svg=await fs.readFile(path.join(root,asset.文件),'utf8');
   const frame=await session.render({svg,action,...target});
   const comparison=compareImages(PNG.sync.read(frame.png),PNG.sync.read(frame.livePng),{scale:target.scale}),ssim=comparison.分组.find(group=>group.区域==='全图').指标.ssim;
   const animations=await session.frozen.evaluate(`({css:document.getAnimations().length,smil:document.querySelectorAll('svg animate,svg animateTransform,svg animateMotion,svg set').length})`);
   const key=target.id+(target.color?'@'+target.color.slice(1):'')+'/'+target.name+'/'+target.time+'@'+target.scale+'x';
   await save(path.join(out,key+'.png'),frame.png);await save(path.join(out,key+'-live.png'),frame.livePng);await save(path.join(out,key+'.svg'),frame.svg);
   const row={...target,相似度:ssim,冻结复核:frame.verification,冻结动画:animations,值:frame.values,冻结值:frame.frozenValues,元数据:frame.metadata,通过:frame.verification.通过&&ssim>=.95&&animations.css===0&&animations.smil===0};
   rows.push(row);await save(path.join(out,key+'.json'),row);console.log(`${row.通过?'通过':'失败'}：${target.id}/${target.name} ${target.time}ms @${target.scale}x ${target.color||''}；SSIM=${ssim}；值复核=${frame.verification.通过}；冻结动画=${animations.css}/${animations.smil}`);
  }
  const result={容差:.001,相似度线:.95,通过:rows.every(row=>row.通过),帧:rows};
  if(reportFile)await save(path.resolve(root,reportFile),result);
  assert.equal(rows.length,6);assert.equal(result.通过,true,'六个实际UI失败帧尚未全部通过原判据');
  // 原computed hint必须合并保留，且真实冻结页仍无动画。
  const hinted='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>@keyframes pulse{from{transform:scale(.8);opacity:.5}to{transform:scale(1.1);opacity:1}}#target{will-change:filter;animation:pulse 1s linear both;transform-origin:50px 50px}</style><g id="target"><rect x="20" y="20" width="60" height="60" fill="red"/></g></svg>';
  const hintFrame=await session.render({svg:hinted,time:200,id:'composite/original-hint'});
  const preserved=await session.frozen.evaluate(`({hint:getComputedStyle(document.getElementById('target')).willChange,animations:document.getAnimations().length})`);
  assert(preserved.hint.split(',').map(value=>value.trim()).includes('filter'),'原有filter提示被覆盖');assert(preserved.hint.includes('transform'));assert(preserved.hint.includes('opacity'));assert.equal(preserved.animations,0);assert.equal(hintFrame.verification.通过,true);
  console.log('通过：原computed will-change:filter与transform/opacity提示合并，冻结无动画且值复核通过。');
 }finally{await session.close();}
}
