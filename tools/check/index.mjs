// 聚合验收：失败、未运行和通过分开记录，任何缺项都不能变成通过。
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root} from '../setup/paths.mjs';
import {checkReadonly} from '../setup/readonly.mjs';
import {openChrome} from '../chrome/index.mjs';
import {checkCoverage,verifyRepeatability} from '../ref/audit.mjs';
const platform=process.platform==='darwin'?'mac':'linux',out=path.join(root,'out',platform),rows=[];
const commit=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
async function read(file){return JSON.parse(await fs.readFile(file,'utf8'));}
async function check(number,name,fn){try{const result=await fn();rows.push({序号:number,检查:name,状态:result.通过?'通过':'未通过',...result});}catch(e){rows.push({序号:number,检查:name,状态:'未运行或出错',通过:false,原因:e.message});}}
function command(file,args=[]){const r=spawnSync(process.execPath,[file,...args],{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});return {通过:r.status===0,退出码:r.status,日志:(r.stdout+r.stderr).slice(-16000),错误:r.error?.message};}
let browserAvailable=false;
await check(1,'环境',async()=>{if(process.argv.includes('--离线'))throw new Error('明确选择离线检查；Chrome环境未运行，不能验收通过。已知socket EPERM由独立排查继续检查。');const b=await openChrome();try{browserAvailable=true;const config=await read(path.join(root,'参照版本.json'));const {createHash}=await import('node:crypto');for(const [name,hash] of Object.entries(config.字体指纹)){const actual=createHash('sha256').update(await fs.readFile(path.join(root,'素材/字体',name))).digest('hex');if(actual!==hash)throw new Error(`字体指纹变化：${name}`);}return {通过:true,浏览器:b.gpuInfo,完整启动参数:b.flags};}finally{await b.close();}});
await check(2,'对照工具自测',async()=>command('tools/compare/self-test.mjs',['--4k',`--结果=${path.join(out,'报告/对照自测.json')}`]));
await check(3,'覆盖',()=>checkCoverage({out}));
await check(4,'可重复性',async()=>{if(!browserAvailable)throw new Error('浏览器环境检查失败，没有运行两遍参照');return verifyRepeatability({out:path.join(out,'repeat'),full:process.argv.includes('--全部')});});
await check(5,'冻结正确',async()=>{const r=await read(path.join(out,'报告/参照.json'));if(!r.通过||!r.动作?.length)throw new Error('参照批处理没有完整通过；冻结值和图像不能判通过');return {通过:r.动作.every(a=>a.通过),动作数:r.动作.length};});
await check(6,'特性清单',async()=>{const r=await read(path.join(root,'报告/素材登记.json'));return {通过:r.状态==='完成',详情:r};});
await check(7,'指令记录',async()=>{const assets=await read(path.join(root,'素材/清单.json'));const missing=[];for(const asset of assets)for(const id of asset.染色?['E3263A','3FE3F0'].map(c=>asset.id+'@'+c):[asset.id]){const a={id};try{const f=await read(path.join(out,'oplog',a.id+'.json'));if(!Array.isArray(f)||!f.length)throw new Error('空指令');}catch(e){missing.push(a.id);}}return {通过:missing.length===0,缺少:missing};});
await check(8,'实验4、5、6',async()=>{const micro=await read(path.join(out,'micro/result.json'));const text=await read(path.join(out,'text/result.json'));const targets=platform==='mac'?['mac-arm64','mac-x64']:['linux-x64','wasm'];const sizes=await Promise.all(targets.map(t=>read(path.join(out,'skia',t,'link-result.json'))));return {通过:micro.及格===true&&text.及格===true&&sizes.every(s=>s.build_pass===true&&(s.target.startsWith('mac-')?s.bytes<=6000000:true)),实验4:sizes,实验5:micro,实验6:text};});
await check(9,'只读目录',checkReadonly);
await check(10,'Mac验证',async()=>{if(platform==='mac')return {通过:true,说明:'本项表示正在Mac原生运行，其余九项仍须全部通过；最终验收还要核对用户提交回来的报告。'};const r=await read(path.join(root,'报告/mac/验收.json'));return {通过:r.提交===commit&&r.全部通过===true,要求提交:commit,报告提交:r.提交,说明:'Mac报告必须对应本次代码提交；缺报告或不匹配均不通过。'};});
const result={提交:commit,测试时工作区有修改:Boolean(spawnSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).stdout.trim()),平台:process.platform,架构:process.arch,时间:new Date().toISOString(),全部通过:rows.every(x=>x.通过),检查:rows};
await fs.mkdir(path.join(out,'报告'),{recursive:true});await fs.writeFile(path.join(out,'报告/验收.json'),JSON.stringify(result,null,2)+'\n');
await fs.mkdir(path.join(root,'报告',platform),{recursive:true});await fs.writeFile(path.join(root,'报告',platform,'验收.json'),JSON.stringify(result,null,2)+'\n');
console.log(rows.map(x=>`${x.序号}. ${x.检查}：${x.状态}`).join('\n'));process.exitCode=result.全部通过?0:1;
