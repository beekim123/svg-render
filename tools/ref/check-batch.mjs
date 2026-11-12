// 只验证编排和缓存的模拟测试；不会把模拟图片作为浏览器参照产物。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import {runBatch,normalizeManifest,jobsForAsset} from './batch.mjs';
import {checkCoverage,verifyRepeatability,measureNoise,measureCrossPlatform} from './audit.mjs';
import {sha256} from './index.mjs';
import {compareFiles} from '../compare/cli.mjs';
import {equivalent,verifyValues} from './verify.mjs';
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'svg-ref-offline-'));
const fonts={};for(const weight of ['Regular','Bold']){const name=`NotoSansCJKsc-${weight}.otf`;fonts[name]=sha256(await fs.readFile(path.resolve(import.meta.dirname,'../../素材/字体',name)));}
let sessions=0,renders=0;const factory=async({mode,freezePolicy})=>{sessions++;return {freezePolicy,browser:{pid:process.pid,gpuInfo:{browser:'Chrome/157.0.8103.50',rasterization:mode==='cpu'?'disabled_software':'enabled'},flags:['--user-data-dir=/tmp/test'],evaluate:async()=>({period:0,animated:false})},fonts,prepare:async()=>({width:4,height:4}),render:async({scale,time,id,action,oplog})=>{renders++;const image=new PNG({width:4*scale,height:4*scale});image.data.fill(0);const png=PNG.sync.write(image);return {png,livePng:png,svg:'<svg/>',verification:{通过:true,轨道数:0,错误:[]},metadata:{素材:id,动作:action.名字,时刻:time,倍率:scale,冻结策略:freezePolicy,文字区域:[{x:0,y:0,width:2*scale,height:4*scale}]},...(oplog?{oplog:[{commands:[{method:'drawRect',action:action.名字}]}]}:{})};},sampleValues:async({id,action})=>({id,动作:action.名字,步长毫秒:20,时刻:[0],轨:[]}),close:async()=>{}};};
try{
 const source=path.join(tmp,'fixture.svg');await fs.writeFile(source,'<svg viewBox="0 0 4 4"/>');const manifest=[{id:'试验图/试验图',文件:source,染色:false,动作:[{名字:'待机',种类:'循环'}]}];
 assert.throws(()=>normalizeManifest([]));assert.throws(()=>normalizeManifest([{...manifest[0],id:'../escape'}]));assert.equal(jobsForAsset({...manifest[0],染色:true,动作:[{名字:'施法',种类:'播一次',毫秒:1200,触发:{class:'cast'}}]}).length,4);
 assert(equivalent('matrix(1, 0, 0, 1, 0, 0)','matrix(1.0005, 0, 0, 1, 0, 0)'));assert(!equivalent('1px','1%'));assert(!equivalent(1,1.01));assert(!verifyValues([{节点号:0,属性:'x',值:1}],[{节点号:0,属性:'x',值:2}]).通过);
 const out=path.join(tmp,'batch');let report=await runBatch({manifest,out,sessionFactory:factory});assert(report.通过,JSON.stringify(report.错误));assert.equal(renders,2);assert((await checkCoverage({manifest,out})).通过);
 report=await runBatch({manifest,out,sessionFactory:factory});assert(report.通过);assert(report.动作[0].缓存);assert.equal(renders,2);
 await fs.writeFile(path.join(out,'ref/试验图/试验图/待机/0@1x.png'),'损坏');assert(!(await checkCoverage({manifest,out})).通过);report=await runBatch({manifest,out,sessionFactory:factory});assert(report.通过);assert.equal(renders,4);
 const before=sessions;const repeat=await verifyRepeatability({manifest,out:path.join(tmp,'repeat'),sessionFactory:factory});assert(repeat.通过,JSON.stringify(repeat));assert.equal(sessions-before,2);
 const noise=await measureNoise({manifest,out:path.join(tmp,'noise'),cpuOut:path.join(tmp,'noise/cpu'),sessionFactory:factory});assert(noise.完成,JSON.stringify(noise));assert.equal(noise.CPU对GPU.length,2);
 const key='试验图/试验图/待机/0@1x.png';assert(noise.帧[key].全图);assert(noise.帧[key].非文字);const gpuCompare=await compareFiles(path.join(tmp,'noise/cpu/ref',key),path.join(tmp,'noise/gpu/ref',key),{line:'GPU',baseline:noise.帧[key]});assert(gpuCompare.通过);
 const cross=await measureCrossPlatform({linux:path.join(tmp,'noise/cpu/ref'),mac:path.join(tmp,'noise/gpu/ref'),out:path.join(tmp,'cross')});assert(cross.完成);assert.equal(cross.帧.length,2);assert(!('通过' in cross));
 const changedImage=new PNG({width:4,height:4});changedImage.data.fill(255);await fs.writeFile(path.join(tmp,'noise/gpu/ref',key),PNG.sync.write(changedImage));const different=await measureCrossPlatform({linux:path.join(tmp,'noise/cpu/ref'),mac:path.join(tmp,'noise/gpu/ref'),out:path.join(tmp,'cross-different')});assert(different.完成);assert(different.帧.some(f=>f.指标.ssim<.995));
 await fs.unlink(path.join(tmp,'noise/gpu/ref',key));const missing=await measureCrossPlatform({linux:path.join(tmp,'noise/cpu/ref'),mac:path.join(tmp,'noise/gpu/ref'),out:path.join(tmp,'cross-missing')});assert(!missing.完成);
 const withCast=[{...manifest[0],染色:true,动作:[...manifest[0].动作,{名字:'施法',种类:'播一次',毫秒:100,触发:{class:'cast'}}]}];const tintedOut=path.join(tmp,'tinted');const tinted=await runBatch({manifest:withCast,out:tintedOut,sessionFactory:factory});assert(tinted.通过);assert((await checkCoverage({manifest:withCast,out:tintedOut})).通过);for(const color of ['E3263A','3FE3F0'])assert(JSON.parse(await fs.readFile(path.join(tintedOut,`oplog/试验图/试验图@${color}.json`))).length>0);
 const noIdle=[{id:'复杂测试图/fx_explosion',文件:source,染色:true,动作:[{名字:'爆炸',种类:'播一次',毫秒:1000,触发:{class:'act-explode'}},{名字:'闪电',种类:'播一次',毫秒:600,触发:{class:'act-lightning'}}]}];const noIdleOut=path.join(tmp,'no-idle');const noIdleReport=await runBatch({manifest:noIdle,out:noIdleOut,sessionFactory:factory});assert(noIdleReport.通过);assert.equal(noIdleReport.动作.length,4);assert(noIdleReport.动作.every(a=>a.动作!=='待机'));for(const color of ['E3263A','3FE3F0']){const log=JSON.parse(await fs.readFile(path.join(noIdleOut,`oplog/复杂测试图/fx_explosion@${color}.json`)));assert.equal(log[0].commands[0].action,'爆炸');}assert((await checkCoverage({manifest:noIdle,out:noIdleOut})).通过);
 const changedDuration=structuredClone(withCast);changedDuration[0].动作[1].毫秒=200;assert(!(await checkCoverage({manifest:changedDuration,out:tintedOut})).通过);const changedTrigger=structuredClone(withCast);changedTrigger[0].动作[1].触发.class='other';assert(!(await checkCoverage({manifest:changedTrigger,out:tintedOut})).通过);
 const blocked=await runBatch({manifest,out:path.join(tmp,'blocked'),sessionFactory:async()=>{throw new Error('测试启动失败');}});assert(!blocked.通过);assert.equal(blocked.错误.length,1);
 await fs.writeFile(source,'<svg viewBox="0 0 5 5"/>');assert(!(await checkCoverage({manifest,out})).通过);
 console.log('离线模拟测试通过：清单校验、路径限制、switch1234、值容差、缓存命中/损坏、覆盖、两进程编排、GPU基准直接消费、跨平台无画质线、染色首帧指令、无待机首动作回退、同名动作时长/触发变更、失败传播。');
}finally{await fs.rm(tmp,{recursive:true,force:true});}
