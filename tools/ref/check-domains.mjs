// 来源域回归：CSS transform与SVG transform属性不能互相覆盖；只开一个真实Chrome。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {root} from '../setup/paths.mjs';
import {createReferenceSession} from './index.mjs';
import {verifyValues} from './verify.mjs';

function verifyDomainMatching(){
 const local=[1,0,0,1,9,5];
 const css={节点号:7,元素id:'same-node',属性:'transform',来自:'css',值:'matrix(1, 0, 0, 1, 9, 5)',局部矩阵:local,写回:'style'};
 const smil={节点号:7,元素id:'same-node',属性:'transform',来自:'smil',值:'matrix(1 0 0 1 2 3)',局部矩阵:local,写回:'attribute'};
 assert.equal(verifyValues([css,smil],[{...smil},{...css}]).通过,true,'同节点同属性的两个来源反序后仍须各自匹配，不能按元素/属性覆盖');
 assert.equal(verifyValues([css,smil],[{...css},{...smil,值:'matrix(1 0 0 1 20 3)'}]).通过,false,'SMIL属性域错误不能借CSS域结果通过');
 assert.equal(verifyValues([css,smil],[{...css,值:'matrix(1, 0, 0, 1, 19, 5)'},{...smil}]).通过,false,'CSS样式域错误不能借SMIL域结果通过');
 assert.equal(verifyValues([css,smil],[{...css}]).通过,false,'缺少一个来源域必须拒绝');
 console.log('通过：verifyValues按节点/属性/来源匹配，反序兼容、各域错误及缺域均正确处理。');
}

const domains=(rows,id)=>rows.filter(row=>row.元素id===id&&row.属性==='transform');
const brief=rows=>rows.map(row=>({元素id:row.元素id,来自:row.来自,写回:row.写回,值:Array.isArray(row.值)?row.值.at(-1):row.值}));
const numbers=value=>(String(value).match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[]).map(Number);

async function verifyRealDomains(){
 const manifest=JSON.parse(await fs.readFile(path.join(root,'素材/清单.json'),'utf8'));
 const asset=manifest.find(row=>row.id==='复杂测试图/char_golem');
 assert(asset,'实际清单缺少char_golem');
 const action=asset.动作.find(row=>row.名字==='受击');assert(action,'实际清单缺少受击动作');
 const svg=await fs.readFile(path.join(root,asset.文件),'utf8');
 const session=await createReferenceSession();
 console.log(JSON.stringify({测试:'来源域',ChromePID:session.browser.pid,临时目录:session.browser.tmp}));
 try{
  const frame=await session.render({svg,action,time:50,scale:1,id:asset.id});
  const selected=['golem_main_body','debris_0'];
  console.log(JSON.stringify({测试:'char_golem受击50ms',来源域:brief(selected.flatMap(id=>domains(frame.values,id))),冻结通过:frame.verification.通过,首个冻结错误:frame.verification.错误[0]},null,2));
  for(const id of selected){
   const rows=domains(frame.values,id);
   assert.deepEqual(rows.map(row=>row.来自).sort(),['css','smil'],`${id}的CSS transform与SMIL transform属性必须同时保留`);
   assert.equal(rows.find(row=>row.来自==='css').写回,'style');
   assert.equal(rows.find(row=>row.来自==='smil').写回,'attribute');
  }
  assert.equal(frame.verification.通过,true,'真实受击50ms冻结应保留CSS旋转并通过值/矩阵复核');
  const frozen=await session.frozen.evaluate(`(()=>{const e=document.getElementById('golem_main_body'),p=e.parentNode.getCTM(),m=p.inverse().multiply(e.getCTM());return {style:e.style.getPropertyValue('transform'),matrix:[m.a,m.b,m.c,m.d,m.e,m.f],animations:document.getAnimations().length};})()`);
  assert(frozen.style&&frozen.style!=='none','冻结SVG缺少CSS transform样式');
  assert(Math.abs(frozen.matrix[1])>.001||Math.abs(frozen.matrix[2])>.001,'冻结SVG丢失实际CSS旋转，只剩SMIL平移');
  assert.equal(frozen.animations,0,'冻结图仍有活CSS动画，不能靠动画继续运行维持外观');
  const samples=await session.sampleValues({svg,action,duration:60,id:asset.id});
  console.log(JSON.stringify({测试:'sampleValues来源域',时刻:samples.时刻,来源域:brief(selected.flatMap(id=>domains(samples.轨,id)))},null,2));
  for(const id of selected){
   const rows=domains(samples.轨,id);
   assert.deepEqual(rows.map(row=>row.来自).sort(),['css','smil'],`${id}的20ms值表丢失来源域`);
   for(const row of rows)assert.equal(row.值.length,samples.时刻.length);
   const css=numbers(rows.find(row=>row.来自==='css').值.at(-1));
   const smil=numbers(rows.find(row=>row.来自==='smil').值.at(-1));
   assert.equal(css.length,6);assert.equal(smil.length,6);
   assert(Math.abs(css[1])>.001||Math.abs(css[2])>.001,`${id}的CSS值表未保留旋转`);
   assert.equal(smil[1],0);assert.equal(smil[2],0);
  }
  console.log('通过：真实char_golem受击50ms的CSS/SMIL两域、冻结旋转及逐20ms两域值表均保留。');
 }finally{await session.close();console.log('清理：来源域测试的Chrome和临时profile已关闭。');}
}

try{
 if(process.argv.includes('--unit'))verifyDomainMatching();
 else{await verifyRealDomains();verifyDomainMatching();}
}catch(error){console.error(`失败：来源域回归\n${error.stack}`);process.exitCode=1;}
