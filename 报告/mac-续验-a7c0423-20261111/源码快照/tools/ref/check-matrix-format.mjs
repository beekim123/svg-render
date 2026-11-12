// 展示字段保留4位，完整局部矩阵另存全精度；不能以展示舍入放宽0.001复核。
import assert from 'node:assert/strict';
import {createReferenceSession} from './index.mjs';
import {verifyValues} from './verify.mjs';

const rounded=matrix=>matrix.map(value=>+value.toFixed(4));
function finiteSix(value,label){assert(Array.isArray(value)&&value.length===6&&value.every(Number.isFinite),`${label}必须是6个有限数值`);}
function verifyFullMatrixMatching(){
 const row={节点号:3,元素id:'format',属性:'transform',来自:'css',值:'matrix(1, 0, 0, 1, 0, 0)',局部矩阵:[1,0,0,1,0,0]};
 const live={...row,完整局部矩阵:[1,0,0,1,.000041,0]};
 const drift={...row,局部矩阵:[1,0,0,1,.001,0],完整局部矩阵:[1,0,0,1,.001049,0]};
 const driftResult=verifyValues([live],[drift]);
 assert.equal(driftResult.通过,false,'四位展示差为0.001、完整差为0.001008时必须按完整矩阵拒绝');
 const driftError=driftResult.错误.find(error=>error.节点号===3&&error.属性==='transform');
 assert(driftError,'完整矩阵漂移须有对应轨道错误');
 assert.equal(driftError.来自,'css','错误诊断必须保留来源域');
 assert.deepEqual(driftError.活完整矩阵,live.完整局部矩阵,'错误诊断必须保留活值完整矩阵');
 assert.deepEqual(driftError.冻结完整矩阵,drift.完整局部矩阵,'错误诊断必须保留冻结完整矩阵');
 assert.equal(verifyValues([live],[{...row}]).通过,false,'仅活值有完整矩阵时不能退回展示字段放行');
 assert.equal(verifyValues([{...row}],[live]).通过,false,'仅冻结值有完整矩阵时不能退回展示字段放行');
 assert.equal(verifyValues([{...row}],[{...row}]).通过,true,'双方没有完整字段的旧格式须兼容');
 assert.equal(verifyValues([{...row,完整局部矩阵:[1,0,0,1,0,0]}],[{...row,局部矩阵:[1,0,0,1,.001,0],完整局部矩阵:[1,0,0,1,.001,0]}]).通过,true,'完整矩阵差恰为0.001仍沿用原容差');
 // 删除六数/有限校验或把null当作双方缺项，都必须被这些边界拒绝。
 for(const [label,matrix]of [
  ['null',null],
  ['空数组',[]],
  ['五个数',[1,0,0,1,0]],
  ['七个数',[1,0,0,1,0,0,0]],
  ['NaN',[1,0,0,1,Number.NaN,0]],
  ['正无穷',[1,0,0,1,Infinity,0]],
  ['负无穷',[1,0,0,1,-Infinity,0]]
 ]){
  const invalid={...row,完整局部矩阵:matrix};
  for(const [side,a,b]of [['活值',invalid,live],['冻结值',live,invalid],['双方',invalid,invalid]]){
   const result=verifyValues([a],[b]);
   assert.equal(result.通过,false,`${side}完整矩阵为${label}时必须拒绝，不能退回四位展示字段`);
   const detail=result.错误.find(error=>error.节点号===3&&error.属性==='transform');
   assert(detail,`${side}完整矩阵为${label}须有轨道错误`);
   assert.equal(detail.来自,'css',`${label}诊断丢失来源域`);
   assert(Object.hasOwn(detail,'活完整矩阵')&&Object.hasOwn(detail,'冻结完整矩阵'),`${label}诊断须有两侧完整矩阵字段`);
   assert.deepEqual(detail.活完整矩阵,a.完整局部矩阵,`${label}诊断未保留活值原始完整矩阵`);
   assert.deepEqual(detail.冻结完整矩阵,b.完整局部矩阵,`${label}诊断未保留冻结值原始完整矩阵`);
   assert.equal(typeof detail.原因,'string',`${label}诊断缺少明确拒绝原因`);
  }
 }
 console.log('通过：完整矩阵优先、单边缺失拒绝、双旧兼容、0.001边界不变；任一侧或双方null/非六数/非有限数均拒绝，诊断保留来源与两侧完整矩阵。');
}

async function verifyRealFormat(){
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>@keyframes format-test{from,to{transform:translate(12.3456789px,7.654321px) rotate(.4deg) scale(1.016)}}#format{transform-origin:25px 35px;animation:format-test 1s linear both}</style><g id="format"><rect x="10" y="10" width="30" height="20" fill="red"/></g></svg>';
 const session=await createReferenceSession();
 console.log(JSON.stringify({测试:'矩阵格式',ChromePID:session.browser.pid,临时目录:session.browser.tmp}));
 try{
  const frame=await session.render({svg,time:200,id:'matrix-format/actual-css'});
  const value=frame.values.find(row=>row.元素id==='format'&&row.属性==='transform');assert(value,'缺少真实CSS变换轨');
  console.log(JSON.stringify({测试:'真实CSS变换字段',局部矩阵:value.局部矩阵,完整局部矩阵:value.完整局部矩阵??null,冻结通过:frame.verification.通过},null,2));
  finiteSix(value.局部矩阵,'局部矩阵');
  assert.deepEqual(value.局部矩阵,rounded(value.局部矩阵),'局部矩阵展示字段必须按需求保留4位小数');
  finiteSix(value.完整局部矩阵,'完整局部矩阵');
  assert.deepEqual(value.局部矩阵,rounded(value.完整局部矩阵),'展示字段应与完整局部矩阵的4位结果一致');
  assert(value.完整局部矩阵.some((number,index)=>number!==value.局部矩阵[index]),'此夹具含真实高精度系数，完整字段不能也被舍入');
  const native=await session.browser.evaluate(`(()=>{const e=document.getElementById('format'),p=e.parentNode.getCTM(),m=p.inverse().multiply(e.getCTM());return [m.a,m.b,m.c,m.d,m.e,m.f];})()`);
  for(let index=0;index<6;index++)assert(Math.abs(value.完整局部矩阵[index]-native[index])<1e-12,'完整字段须保留浏览器原始局部CTM精度');
  assert.equal(frame.verification.通过,true,'该合法CSS矩阵冻结不应因展示格式恢复而失真');
  const samples=await session.sampleValues({svg,duration:40,id:'matrix-format/samples'});
  const track=samples.轨.find(row=>row.元素id==='format'&&row.属性==='transform');assert(track);
  assert.deepEqual(samples.时刻,[0,20,40]);
  assert.equal(track.局部矩阵.length,3);assert.equal(track.完整局部矩阵?.length,3,'完整矩阵必须按20ms逐时刻存数组');
  for(let time=0;time<3;time++){
   finiteSix(track.局部矩阵[time],'值表局部矩阵');finiteSix(track.完整局部矩阵[time],'值表完整局部矩阵');
   assert.deepEqual(track.局部矩阵[time],rounded(track.完整局部矩阵[time]));
   for(let index=0;index<6;index++)assert(Math.abs(track.完整局部矩阵[time][index]-native[index])<1e-12,'恒定动画的20ms完整值表不应丢失精度');
  }
  console.log('通过：真实CSS变换的四位展示/全精度辅助字段与逐20ms值表格式均正确。');
 }finally{await session.close();console.log('清理：矩阵格式测试的Chrome和临时profile已关闭。');}
}

try{
 if(process.argv.includes('--unit'))verifyFullMatrixMatching();
 else{await verifyRealFormat();verifyFullMatrixMatching();}
}catch(error){console.error(`失败：矩阵格式回归\n${error.stack}`);process.exitCode=1;}
