// Mac首次试跑与最终验收共用入口。不会把尚缺Linux参照或人工校准的实验标为通过。
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {root,cache} from './setup/paths.mjs';
import {preflight} from './setup/preflight.mjs';
import {install,resvgRevision} from './setup/install.mjs';
import {createRunner} from './mac/runner.mjs';
function git(args){const p=spawnSync('git',args,{cwd:root,encoding:'utf8'});if(p.error||p.status!==0)throw new Error(p.error?.message||p.stderr);return p.stdout;}
const hash=value=>createHash('sha256').update(value).digest('hex');
const commit=git(['rev-parse','HEAD']).trim(),started=new Date().toISOString();
const status=git(['status','--porcelain=v1']),patch=git(['diff','--binary','HEAD','--','.',':!报告/**']);
const untracked={};for(const file of git(['ls-files','--others','--exclude-standard','-z','--','.',':!报告/**']).split('\0').filter(Boolean))untracked[file]=hash(await fs.readFile(path.join(root,file)));
const provenance={提交:commit,测试时工作区有修改:Boolean(status.trim()),代码工作区有修改:Boolean(patch||Object.keys(untracked).length),工作区记录时点:'运行开始',工作区状态:status,源码补丁SHA256:hash(patch),未跟踪源码SHA256:untracked,开始时间:started};
const reportDir=path.join(root,'报告/mac');
// 保留整份旧报告；本轮已知汇总先写“未运行”，避免中断时混入旧结论。
let archive;try{if((await fs.readdir(reportDir)).length){archive=reportDir+'-归档-'+started.replace(/[:.]/g,'-');await fs.cp(reportDir,archive,{recursive:true,force:false,errorOnExist:true});}}catch(e){if(e.code!=='ENOENT')throw e;}
if(archive)provenance.历史报告归档=archive;
await fs.mkdir(reportDir,{recursive:true});
const summaries=[
 ['实验5微场景','out/mac/micro/result.json','实验5.json'],
 ['实验6文字轮廓','out/mac/text/result.json','实验6.json'],
 ['Skia mac-arm64 动态库和体积','out/mac/skia/mac-arm64/link-result.json','Skia-arm64.json'],
 ['Skia mac-x64 动态库和体积','out/mac/skia/mac-x64/link-result.json','Skia-x86_64.json'],
 ['Chrome自己的差','out/mac/noise/报告/自身差/结果.json','Chrome自己的差.json'],
 ['Linux对Mac逐帧四项指标','out/mac/报告/Linux对Mac/结果.json','Linux对Mac.json'],
 ['完整验收','out/mac/报告/验收.json','验收.json']
];
const before=new Map();
for(const [name,src,dest]of summaries){
 try{const s=await fs.stat(path.join(root,src));before.set(src,[s.mtimeMs,s.ctimeMs,s.size].join(':'));}catch(e){if(e.code!=='ENOENT')throw e;}
 await fs.writeFile(path.join(reportDir,dest),JSON.stringify({...provenance,本轮状态:'未运行',步骤:name,...(dest==='验收.json'?{全部通过:false,检查:[]}:{} )},null,2)+'\n');
}
const logFile=path.join(reportDir,'运行日志.txt');await fs.writeFile(logFile,`提交：${commit}\n代码工作区有修改：${provenance.代码工作区有修改}；源码补丁SHA256：${provenance.源码补丁SHA256}\n`);
async function log(s){console.log(s);await fs.appendFile(logFile,s+'\n');}
let ready=null,finished=false;
const runner=createRunner({cwd:root,env:{...process.env,SVG_RENDER_CACHE:cache,npm_config_cache:path.join(cache,'npm')},log,onChange:writeSteps});
const {tasks,step,command}=runner;
async function writeSteps(){await fs.writeFile(path.join(reportDir,'步骤.json'),JSON.stringify({...provenance,运行状态:finished?'已结束':'进行中',环境:ready,步骤:tasks,后续已停止:runner.halted,全部步骤成功:finished&&ready?.通过&&tasks.length>0&&tasks.every(t=>t.成功)},null,2)+'\n');}
await writeSteps();
await log(`本次代码提交：${commit}\n缓存：${cache}\n首次下载：Chrome约187.48MiB压缩包、Skia及必要依赖原需求预估超过1GB、resvg原始测试内容约14.02MiB，另有GN/Ninja小工具。已缓存内容复用。\n时间：首次暂估1–4小时；全量素材首次尚未实测，可能更长。中断后再次执行会复用下载、构建和完整帧缓存。`);
ready=preflight({mac:true});await fs.writeFile(path.join(reportDir,'环境.json'),JSON.stringify({...ready,...provenance},null,2)+'\n');await writeSteps();
if(!ready.通过){await log(JSON.stringify(ready,null,2));await log('环境缺项，未开始下载或构建。按上面的命令补齐后重跑 npm run mac。');process.exitCode=2;}else{
 const installed=await step('固定依赖下载',()=>install({tests:true}));
 if(installed){
  await step('固定npm依赖',()=>command('npm',['ci','--ignore-scripts']));
  for(const target of ['mac-arm64','mac-x64']){const built=await step(`Skia ${target} 编译`,()=>command(process.execPath,['实验/skia/build.mjs',target]));if(built)await step(`Skia ${target} 动态库和体积`,()=>command(process.execPath,['实验/skia/link.mjs',target]));}
  await step('实验5微场景',()=>command(process.execPath,['实验/micro/run.mjs']),{stopOnFailure:true});
  await step('实验6文字轮廓',()=>command(process.execPath,['实验/text/run.mjs']));
  await step('素材登记',()=>command('python3',['tools/scan/register.py']));
  const scan=await step('Chrome特性扫描及公开测试集筛选',()=>command(process.execPath,['tools/scan/cli.mjs','--register-public',path.join(cache,'tests/resvg',resvgRevision)]));
  // 扫描未通过也要尝试本地已有清单；待分类项由浏览器实际判定。
  await step('参照、值表、冻结检查及指令',()=>command(process.execPath,['tools/ref/batch.mjs','--out','out/mac']));
  await step('Chrome自己的差',()=>command(process.execPath,['tools/ref/audit.mjs','noise','--out','out/mac/noise']));
  const linux=process.env.SVG_RENDER_LINUX_REF||path.join(root,'out/linux/ref');
  // 2026-11-11 用户定：整个项目不再用 Linux（云端 Linux 跑不了 Chrome），只以用户的 Mac 为准。有 Linux 参照目录时照常测。
   const hasLinux=await fs.stat(linux).then(s=>s.isDirectory(),()=>false);
   if(hasLinux)await step('Linux对Mac逐帧四项指标',()=>command(process.execPath,['tools/ref/audit.mjs','cross','--linux',linux,'--mac','out/mac/ref','--out','out/mac/报告/Linux对Mac']));
   else await step('Linux对Mac：不做（项目只用Mac，用户定）',async()=>{});
  await step('完整验收',()=>command(process.execPath,['tools/check/index.mjs','--全部']));
 }
}
// 只复制可读汇总，不复制完整PNG、二进制或out目录；始终保留失败记录。
for(const [name,src,dest]of summaries){
 const task=tasks.find(t=>t.步骤===name);if(!task||task.状态==='停止后未运行')continue;
 try{
  const s=await fs.stat(path.join(root,src)),fingerprint=[s.mtimeMs,s.ctimeMs,s.size].join(':');
  if(fingerprint===before.get(src)){await log(`未复制旧汇总 ${src}：本轮未更新。`);continue;}
  const data=JSON.parse(await fs.readFile(path.join(root,src),'utf8'));
  if(data.提交&&data.提交!==commit){await log(`未复制不同提交的汇总 ${src}：${data.提交}`);continue;}
  await fs.writeFile(path.join(reportDir,dest),JSON.stringify({...data,...provenance,本轮状态:task.成功?'已运行':'运行失败',来源文件:src},null,2)+'\n');
 }catch(e){if(e.code!=='ENOENT')await log(`汇总复制失败 ${src}：${e.message}`);}
}
finished=true;await writeSteps();
const failures=tasks.filter(t=>t.状态==='失败'),skipped=tasks.filter(t=>t.状态==='停止后未运行');
await log(`本次失败步骤：${failures.length?failures.map(t=>t.步骤).join('、'):ready.通过?'无（仍以验收.json的实际项目为准）':'环境检查'}\n停止后未运行：${skipped.map(t=>t.步骤).join('、')||'无'}\n本轮报告：${reportDir}\n请提交并推送本轮报告到 stage-0；不要提交 out/。`);
if(!ready.通过||failures.length)process.exitCode=1;
