// 串行真实子进程回归；不启动 Chrome，不下载或构建 Skia。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRunner} from './runner.mjs';

const temp=await fs.mkdtemp(path.join(os.tmpdir(),'svg-render-mac-runner-'));
const tests=[];
const env={...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1',NUMEXPR_NUM_THREADS:'1'};
let serial=0;
const exists=async file=>fs.access(file).then(()=>true,()=>false);
const node=(runner,source,...args)=>runner.command(process.execPath,['-e',source,...args]);
const effect=(runner,file)=>node(runner,"require('node:fs').writeFileSync(process.argv[1], 'ran')",file);
function test(name,fn){tests.push({name,fn});}

// 这些用例会捕捉“只认退出3、忽略关键步骤其他失败”的分支错误。
for(const [label,action,expected] of [
 ['退出2',runner=>node(runner,'process.exit(2)'),{退出码:2}],
 ['退出1',runner=>node(runner,'process.exit(1)'),{退出码:1}],
 ['退出3',runner=>node(runner,'process.exit(3)'),{退出码:3}],
 ['SIGTERM',runner=>node(runner,"process.kill(process.pid, 'SIGTERM')"),{退出码:null,信号:'SIGTERM'}],
 ['启动错误',runner=>runner.command(path.join(temp,'not-an-executable'),[]),{启动错误:'ENOENT'}]
]){
 test(`实验5${label}后不启动实验6或后续命令`,async()=>{
  const runner=createRunner({cwd:temp,env}),id=String(++serial);
  const text=path.join(temp,`${id}-text`),later=path.join(temp,`${id}-later`);
  assert.equal(await runner.step('实验5微场景',()=>action(runner),{stopOnFailure:true}),false);
  await runner.step('实验6文字轮廓',()=>effect(runner,text));
  await runner.step('完整验收',()=>effect(runner,later));
  assert.equal(await exists(text),false,'实验5失败仍实际启动了实验6');
  assert.equal(await exists(later),false,'实验5失败仍实际启动了后续验收');
  assert.equal(runner.tasks[0].成功,false);
  for(const [key,value] of Object.entries(expected))assert.equal(runner.tasks[0][key],value);
  assert.equal(runner.tasks[1].状态,'停止后未运行');
  assert.equal(runner.tasks[2].状态,'停止后未运行');
  assert.equal(runner.tasks[1].停止步骤,'实验5微场景');
 });
}
for(const code of [1,2])test(`普通步骤退出${code}仍继续收集后续信息`,async()=>{
 const runner=createRunner({cwd:temp,env}),file=path.join(temp,`${++serial}-continued`);
 await runner.step('普通检查',()=>node(runner,`process.exit(${code})`));
 assert.equal(await runner.step('后续诊断',()=>effect(runner,file)),true);
 assert.equal(await exists(file),true);
 assert.equal(runner.tasks[0].成功,false);
});
test('实验6阈值不及格仍执行后续诊断',async()=>{
 const runner=createRunner({cwd:temp,env}),file=path.join(temp,`${++serial}-text-failed`);
 await runner.step('实验5微场景',()=>node(runner,'process.exit(0)'),{stopOnFailure:true});
 await runner.step('实验6文字轮廓',()=>node(runner,'process.exit(1)'));
 await runner.step('素材登记',()=>effect(runner,file));
 assert.equal(await exists(file),true);
 assert.equal(runner.tasks[1].成功,false);
});
test('任意步骤退出3仍执行第9节停止',async()=>{
 const runner=createRunner({cwd:temp,env}),file=path.join(temp,`${++serial}-rule9`);
 await runner.step('Skia动态库体积',()=>node(runner,'process.exit(3)'));
 await runner.step('后续工作',()=>effect(runner,file));
 assert.equal(await exists(file),false);
 assert.equal(runner.tasks[1].状态,'停止后未运行');
});
test('关键步骤成功后继续，且逐步保留结果',async()=>{
 const snapshots=[],runner=createRunner({cwd:temp,env,onChange:async()=>snapshots.push(JSON.parse(JSON.stringify(runner.tasks)))});
 const file=path.join(temp,`${++serial}-success`);
 assert.equal(await runner.step('实验5微场景',()=>node(runner,'process.exit(0)'),{stopOnFailure:true}),true);
 assert.equal(await runner.step('实验6文字轮廓',()=>effect(runner,file)),true);
 assert.equal(await exists(file),true);
 assert.equal(snapshots[0]?.[0]?.状态,'运行中');
 assert.equal(snapshots.at(-1)?.length,2);
 assert.equal(snapshots.at(-1)?.every(row=>row.成功),true);
});
let failed=0;
try{
 for(const {name,fn} of tests)try{await fn();console.log(`通过：${name}`);}catch(error){failed++;console.error(`失败：${name}\n${error.stack}`);}
}finally{await fs.rm(temp,{recursive:true,force:true});}
console.log(`${tests.length-failed}/${tests.length} 项通过；子进程串行执行。`);
process.exitCode=failed?1:0;
