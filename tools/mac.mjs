// Mac首次试跑与最终验收共用入口。不会把尚缺Linux参照或人工校准的实验标为通过。
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,cache} from './setup/paths.mjs';
import {preflight} from './setup/preflight.mjs';
import {install,resvgRevision} from './setup/install.mjs';
const commit=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
const reportDir=path.join(root,'报告/mac');await fs.mkdir(reportDir,{recursive:true});
const logFile=path.join(reportDir,'运行日志.txt');await fs.writeFile(logFile,`提交：${commit}\n`);
const tasks=[];let halted=false;
async function log(s){console.log(s);await fs.appendFile(logFile,s+'\n');}
async function step(name,fn){if(halted){tasks.push({步骤:name,成功:false,状态:'停止后未运行',原因:'第9节要求先询问用户'});return false;}await log(`开始：${name}`);try{await fn();tasks.push({步骤:name,成功:true});await log(`完成：${name}`);return true;}catch(e){if(e.message.includes('STOP_RULE_9'))halted=true;tasks.push({步骤:name,成功:false,原因:e.message});await log(`失败：${name}；${e.message}`);return false;}}
async function command(name,args){const p=spawnSync(name,args,{cwd:root,env:{...process.env,SVG_RENDER_CACHE:cache,npm_config_cache:path.join(cache,'npm')},encoding:'utf8',maxBuffer:64*1024*1024});await log((p.stdout||'')+(p.stderr||''));if(p.status===3)throw new Error('STOP_RULE_9：命令报告需求第9节停止条件，停止后续工作，先询问用户；具体原因见本步骤日志。');if(p.error||p.status!==0)throw new Error(p.error?.message||`${name} ${args.join(' ')} 退出码 ${p.status}`);}
await log(`本次代码提交：${commit}\n缓存：${cache}\n首次下载：Chrome约187.48MiB压缩包、Skia及必要依赖原需求预估超过1GB、resvg原始测试内容约14.02MiB，另有GN/Ninja小工具。已缓存内容复用。\n时间：首次暂估1–4小时；全量素材首次尚未实测，可能更长。中断后再次执行会复用下载、构建和完整帧缓存。`);
const ready=preflight({mac:true});await fs.writeFile(path.join(reportDir,'环境.json'),JSON.stringify({提交:commit,...ready},null,2)+'\n');
if(!ready.通过){await log(JSON.stringify(ready,null,2));await log('环境缺项，未开始下载或构建。按上面的命令补齐后重跑 npm run mac。');process.exitCode=2;}else{
 const installed=await step('固定依赖下载',()=>install({tests:true}));
 if(installed){
  await step('固定npm依赖',()=>command('npm',['ci','--ignore-scripts']));
  for(const target of ['mac-arm64','mac-x64']){const built=await step(`Skia ${target} 编译`,()=>command(process.execPath,['实验/skia/build.mjs',target]));if(built)await step(`Skia ${target} 动态库和体积`,()=>command(process.execPath,['实验/skia/link.mjs',target]));}
  await step('实验5微场景',()=>command(process.execPath,['实验/micro/run.mjs']));
  await step('实验6文字轮廓',()=>command(process.execPath,['实验/text/run.mjs']));
  await step('素材登记',()=>command('python3',['tools/scan/register.py']));
  const scan=await step('Chrome特性扫描及公开测试集筛选',()=>command(process.execPath,['tools/scan/cli.mjs','--register-public',path.join(cache,'tests/resvg',resvgRevision)]));
  // 扫描未通过也要尝试本地已有清单；待分类项由浏览器实际判定。
  await step('参照、值表、冻结检查及指令',()=>command(process.execPath,['tools/ref/batch.mjs','--out','out/mac']));
  await step('Chrome自己的差',()=>command(process.execPath,['tools/ref/audit.mjs','noise','--out','out/mac/noise']));
  const linux=process.env.SVG_RENDER_LINUX_REF||path.join(root,'out/linux/ref');
  await step('Linux对Mac逐帧四项指标',()=>command(process.execPath,['tools/ref/audit.mjs','cross','--linux',linux,'--mac','out/mac/ref','--out','out/mac/报告/Linux对Mac']));
  await step('完整验收',()=>command(process.execPath,['tools/check/index.mjs','--全部']));
 }
}
// 只复制可读汇总，不复制完整PNG、二进制或out目录；始终保留失败记录。
for(const [src,dest] of [['out/mac/micro/result.json','实验5.json'],['out/mac/text/result.json','实验6.json'],['out/mac/skia/mac-arm64/link-result.json','Skia-arm64.json'],['out/mac/skia/mac-x64/link-result.json','Skia-x86_64.json'],['out/mac/noise/报告/自身差/结果.json','Chrome自己的差.json'],['out/mac/报告/Linux对Mac/结果.json','Linux对Mac.json']]){
 try{const data=JSON.parse(await fs.readFile(path.join(root,src),'utf8'));await fs.writeFile(path.join(reportDir,dest),JSON.stringify({提交:commit,...data},null,2)+'\n');}catch(e){if(e.code!=='ENOENT')await log(`汇总复制失败 ${src}：${e.message}`);}
}
await fs.writeFile(path.join(reportDir,'步骤.json'),JSON.stringify({提交:commit,环境:ready,步骤:tasks,全部步骤成功:ready.通过&&tasks.length>0&&tasks.every(t=>t.成功)},null,2)+'\n');
const failures=tasks.filter(t=>!t.成功);await log(`本次失败步骤：${failures.length?failures.map(t=>t.步骤).join('、'):'无（仍以验收.json的实际项目为准）'}\n请提交并推送 报告/mac/ 到 stage-0；不要提交 out/。`);
if(!ready.通过||failures.length)process.exitCode=1;
