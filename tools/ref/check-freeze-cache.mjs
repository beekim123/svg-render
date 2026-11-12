// 离线缓存/覆盖隔离单元回归（用受控PNG，不开Chrome）。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import {root} from '../setup/paths.mjs';
import {createReferenceSession,sha256} from './index.mjs';
import {runBatch,referenceIdentity,actionCacheKey,refreshReferenceIdentity} from './batch.mjs';
import {checkCoverage} from './audit.mjs';

const option=name=>process.argv.find(arg=>arg.startsWith(name+'='))?.slice(name.length+1),reportFile=option('--report');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'svg-freeze-policy-cache-')),rows=[];
let renders=0,pid=900;
const fonts={};for(const weight of ['Regular','Bold']){const name=`NotoSansCJKsc-${weight}.otf`;fonts[name]=sha256(await fs.readFile(path.join(root,'素材/字体',name)));}
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>',source=path.join(temp,'source.svg');await fs.writeFile(source,svg);
const manifest=[{id:'试验图/policy',文件:source,染色:false,动作:[{名字:'待机',种类:'循环'}]}];
function session(freezePolicy='value-only'){
 return {freezePolicy,fonts,browser:{pid:pid++,gpuInfo:{browser:'Chrome/157.0.8103.50',rasterization:'disabled_software'},flags:['--disable-gpu','--user-data-dir=/unit-profile'],evaluate:async()=>({period:0,animated:false})},prepare:async()=>({width:4,height:4}),render:async({scale})=>{renders++;const png=PNG.sync.write(new PNG({width:4*scale,height:4*scale}));return {png,livePng:png,svg,verification:{通过:true,轨道数:0,错误:[]},metadata:{倍率:scale,冻结策略:freezePolicy,文字区域:[],width:4*scale,height:4*scale},oplog:[{commands:[{method:'drawRect'}]}]};},sampleValues:async()=>({步长毫秒:20,时刻:[0],轨:[]}),close:async()=>{}};
}
const factory=async({freezePolicy})=>session(freezePolicy);
async function test(name,fn){try{await fn();rows.push({测试:name,通过:true});console.log(`通过：${name}`);}catch(error){rows.push({测试:name,通过:false,错误:error.stack});console.error(`失败：${name}\n${error.stack}`);}}
try{
 await test('参照身份与缓存键包含实际策略，缺策略不能补默认',async()=>{
  const one=referenceIdentity(session('value-only')),two=referenceIdentity(session('preserve-layers'));
  assert.equal(one.冻结策略,'value-only');assert.equal(two.冻结策略,'preserve-layers');
  assert.notEqual(actionCacheKey({svg,job:{},reference:one,fingerprint:'fixed'}),actionCacheKey({svg,job:{},reference:two,fingerprint:'fixed'}));
  assert.throws(()=>referenceIdentity({...session(),freezePolicy:undefined}),/策略/);assert.throws(()=>actionCacheKey({svg,job:{},reference:{},fingerprint:'fixed'}),/策略/);
 });
 await test('未知策略在尝试启动Chrome前拒绝',async()=>{await assert.rejects(()=>createReferenceSession({freezePolicy:'invalid-policy',executable:path.join(temp,'must-not-start-Chrome')}),error=>error.message.includes('冻结策略')&&!error.message.includes('ENOENT'));});
 await test('候选和默认跨策略缓存不能命中',async()=>{
  const out=path.join(temp,'switch');let result=await runBatch({manifest,out,sessionFactory:factory,sessionOptions:{freezePolicy:'preserve-layers'}});assert(result.通过);const before=renders;
  result=await runBatch({manifest,out,sessionFactory:factory,sessionOptions:{freezePolicy:'value-only'}});assert(result.通过);assert.equal(renders,before+2);assert.equal(result.动作[0].缓存,false);
 });
 await test('默认覆盖拒候选，显式候选覆盖才允许',async()=>{
  const out=path.join(temp,'candidate');const result=await runBatch({manifest,out,sessionFactory:factory,sessionOptions:{freezePolicy:'preserve-layers'}});assert(result.通过);
  assert.equal((await checkCoverage({manifest,out})).通过,false);assert.equal((await checkCoverage({manifest,out,expectedFreezePolicy:'preserve-layers'})).通过,true);
  const recorded=result.浏览器[0];await assert.rejects(()=>refreshReferenceIdentity(recorded,'cpu'),/策略/);assert.equal((await refreshReferenceIdentity(recorded,'cpu','preserve-layers')).冻结策略,'preserve-layers');
 });
 await test('无策略旧缓存即使保留当前key也不能命中或覆盖通过',async()=>{
  const out=path.join(temp,'legacy');assert((await runBatch({manifest,out,sessionFactory:factory,sessionOptions:{freezePolicy:'value-only'}})).通过);
  const cacheFile=path.join(out,'cache/试验图/policy/待机.json'),entry=JSON.parse(await fs.readFile(cacheFile,'utf8'));delete entry.reference.冻结策略;await fs.writeFile(cacheFile,JSON.stringify(entry));
  assert.equal((await checkCoverage({manifest,out})).通过,false);const before=renders;assert((await runBatch({manifest,out,sessionFactory:factory,sessionOptions:{freezePolicy:'value-only'}})).通过);assert.equal(renders,before+2);
 });
 await test('工厂实际策略缺失或与请求不一致时拒绝，不能重新贴标签',async()=>{for(const policy of [undefined,'preserve-layers']){const result=await runBatch({manifest,out:path.join(temp,policy?'mismatch':'missing'),sessionFactory:async()=>{const result=session('value-only');result.freezePolicy=policy;return result;},sessionOptions:{freezePolicy:'value-only'}});assert.equal(result.通过,false);assert(result.错误.some(error=>String(error.错误).includes('策略')));}});
 await test('帧元数据实际策略与会话不符也不能写为当前缓存',async()=>{const result=await runBatch({manifest,out:path.join(temp,'frame-mismatch'),sessionFactory:async()=>{const result=session('value-only'),render=result.render;result.render=async args=>{const frame=await render(args);frame.metadata.冻结策略='preserve-layers';return frame;};return result;},sessionOptions:{freezePolicy:'value-only'}});assert.equal(result.通过,false);assert(result.错误.some(error=>String(error.错误).includes('帧元数据冻结策略')));});
}finally{
 if(reportFile){const target=path.resolve(root,reportFile);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify({类型:'离线缓存/覆盖隔离单元测试',通过:rows.every(row=>row.通过),测试:rows},null,2)+'\n');}
 await fs.rm(temp,{recursive:true,force:true});
}
process.exitCode=rows.every(row=>row.通过)?0:1;
