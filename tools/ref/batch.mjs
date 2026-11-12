// 批量参照：缓存只认可完整、已复核的产物，不把缺失或出错记为通过。
import fs from 'node:fs/promises';
import {resolveAssetPath} from '../scan/path.mjs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {VERSION} from '../chrome/index.mjs';
import {createReferenceSession,sha256,TOOL_VERSION,triggersAction,validateFreezePolicy,resolveFreezePolicy} from './index.mjs';
import {frameTimes,scaleTimes} from './schedule.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const json=async p=>JSON.parse(await fs.readFile(p,'utf8'));
export async function saveJson(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2));}
export function safeRelative(value){if(typeof value!=='string'||!value||path.isAbsolute(value)||value.split(/[\\/]/).some(p=>!p||p==='.'||p==='..'))throw new Error(`不安全的输出名称：${value}`);return value;}
export function normalizeManifest(data){const list=Array.isArray(data)?data:data.素材??data.assets;if(!Array.isArray(list)||!list.length)throw new Error('清单必须包含非空素材数组');const seen=new Set();for(const a of list){safeRelative(a.id);if(seen.has(a.id))throw new Error(`重复素材 id：${a.id}`);seen.add(a.id);if(typeof a.文件!=='string'||!a.文件)throw new Error(`${a.id} 缺少文件路径`);if(!Array.isArray(a.动作)||!a.动作.length)throw new Error(`${a.id} 缺少动作`);const names=new Set();for(const action of a.动作){safeRelative(action.名字);if(names.has(action.名字))throw new Error(`重复动作：${a.id}/${action.名字}`);names.add(action.名字);if(!['循环','播一次','播完停住','进场后循环'].includes(action.种类)&&!(action.种类===null&&action.分类状态==='待验证'))throw new Error(`未知动作种类：${a.id}/${action.种类}`);if(action.种类!=='循环'&&!(Number.isFinite(action.毫秒)&&action.毫秒>0))throw new Error(`${a.id}/${action.名字} 缺少正数毫秒`);}}return list;}
// 实验 2 第 2 条（2026-11-11 用户定）：冻结图对活图，原图相似度 ≥ 0.95，或两张图各模糊 1 像素后 ≥ 0.95。
// 活图里有动画的元素在合成层上先光栅再缩放会发虚，冻结图反而是对的；模糊后发虚的差基本消掉，写错属性的差还在。
export async function freezeAgainstLive(refFile,liveFile){
 const thresholds=JSON.parse(await fs.readFile(path.join(ROOT,'阈值.json'),'utf8')).冻结对活图??{ssim:.95,模糊sigma:1};
 const {compareFiles,loadPng}=await import('../compare/cli.mjs');const {compareImages}=await import('../compare/metrics.mjs');const {gaussianBlur}=await import('../compare/blur.mjs');
 const similarity=(await compareFiles(refFile,liveFile)).分组.find(g=>g.区域==='全图').指标.ssim;
 if(similarity>=thresholds.ssim)return {similarity,blurred:null,passed:true};
 const [a,b]=await Promise.all([loadPng(refFile),loadPng(liveFile)]);const result=compareImages(gaussianBlur(a,thresholds.模糊sigma),gaussianBlur(b,thresholds.模糊sigma));
 const blurred=result.分组.find(g=>g.区域==='全图').指标.ssim;return {similarity,blurred,passed:blurred>=thresholds.ssim};
}
export function jobsForAsset(asset){const jobs=[];for(const color of asset.染色?['#E3263A','#3FE3F0']:[null])for(const action of asset.动作){const id=asset.id+(color?'@'+color.slice(1):'');jobs.push({id,color,action,triggerTime:1000,actionName:action.名字});if(triggersAction(action)&&(/(^|\/)(试验图|char_golem|mon_chest)$/.test(asset.id)))jobs.push({id,color,action,triggerTime:1234,actionName:action.名字+'@switch1234'});}return jobs;}
export async function toolFingerprint(){const files=['index.mjs','page.mjs','schedule.mjs','verify.mjs','batch.mjs','../chrome/index.mjs','../chrome/svg.mjs','../scan/path.mjs'];return sha256(Buffer.concat(await Promise.all(files.map(f=>fs.readFile(path.join(import.meta.dirname,f))))));}
export function referenceIdentity(session){return {平台:process.platform,架构:process.arch,冻结策略:validateFreezePolicy(session.freezePolicy),Chrome:session.browser.gpuInfo,参数:session.browser.flags.map(f=>f.startsWith('--user-data-dir=')?'--user-data-dir=<临时目录>':f),字体:session.fonts};}
export async function referenceConfigFingerprint(){try{return sha256(await fs.readFile(path.join(ROOT,'参照版本.json')));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export function actionCacheKey({svg,job,reference,fingerprint}){validateFreezePolicy(reference?.冻结策略);return sha256(JSON.stringify({源:sha256(svg),job,reference,fingerprint}));}
export async function refreshReferenceIdentity(recorded,mode='cpu',expectedFreezePolicy){
 const policy=validateFreezePolicy(recorded?.冻结策略),expected=await resolveFreezePolicy(expectedFreezePolicy);if(policy!==expected)throw new Error(`参照冻结策略不符：记录${policy}，要求${expected}；不能混用候选或默认参照。`);
 if(!recorded||recorded.Chrome?.browser?.split('/')[1]!==VERSION)throw new Error('参照Chrome版本证据缺失或已经变化');
 const raster=recorded.Chrome.rasterization;if(mode==='cpu'?raster!=='disabled_software':!['enabled','enabled_force'].includes(raster))throw new Error('参照光栅模式证据不符');
 const fonts={};for(const weight of ['Regular','Bold']){const name=`NotoSansCJKsc-${weight}.otf`;fonts[name]=sha256(await fs.readFile(path.join(ROOT,'素材/字体',name)));}
 return {...recorded,平台:process.platform,架构:process.arch,字体:fonts,参照配置指纹:await referenceConfigFingerprint()};
}
async function cacheHit(file,key,out,freezePolicy){try{const entry=await json(file);if(entry.reference?.冻结策略!==freezePolicy||entry.summary?.冻结策略!==freezePolicy||entry.key!==key||!entry.通过||!entry.files?.length)return null;for(const f of entry.files)if(sha256(await fs.readFile(path.join(out,safeRelative(f.path))))!==f.hash)return null;return entry;}catch(e){if(['ENOENT','ENOTDIR'].includes(e.code)||e instanceof SyntaxError)return null;throw e;}}
export async function runBatch({manifest=path.join(ROOT,'素材/清单.json'),out=path.join(ROOT,'out',process.platform==='darwin'?'mac':'linux'),mode='cpu',cache=true,concurrency=1,ids,sessionOptions={},sessionFactory=createReferenceSession}={}){
 const start=performance.now(),freezePolicy=await resolveFreezePolicy(sessionOptions.freezePolicy);const list=normalizeManifest(typeof manifest==='string'?await json(manifest):manifest).filter(a=>!ids||ids.includes(a.id));if(!list.length)throw new Error('所选素材为空');if(!Number.isInteger(concurrency)||concurrency<1||concurrency>16)throw new Error('并行数必须为1到16的整数');
 out=path.resolve(out);await fs.mkdir(out,{recursive:true});const fingerprint=await toolFingerprint();const report={工具版本:TOOL_VERSION,代码指纹:fingerprint,模式:mode,冻结策略:freezePolicy,素材数:list.length,开始:new Date().toISOString(),通过:false,浏览器:[],动作:[],错误:[]};let cursor=0;
 const worker=async()=>{let session;
 // 工作进程用的 Chrome 断了：关掉旧会话、重开一个，这个动作重试一次；再失败照实记错。
 const openSession=async()=>{const s=await sessionFactory({...sessionOptions,mode,freezePolicy});const r=referenceIdentity(s);if(r.冻结策略!==freezePolicy)throw new Error(`会话实际冻结策略${r.冻结策略}与请求${freezePolicy}不一致`);r.参照配置指纹=await referenceConfigFingerprint();report.浏览器.push({...r,完整启动参数:s.browser.flags});await saveJson(path.join(out,'reference',`process-${s.browser.pid}.json`),{...r,完整启动参数:s.browser.flags});return {s,r};};
 try{session=await sessionFactory({...sessionOptions,mode,freezePolicy});let reference=referenceIdentity(session);if(reference.冻结策略!==freezePolicy)throw new Error(`会话实际冻结策略${reference.冻结策略}与请求${freezePolicy}不一致`);reference.参照配置指纹=await referenceConfigFingerprint();report.浏览器.push({...reference,完整启动参数:session.browser.flags});await saveJson(path.join(out,'reference',`process-${session.browser.pid}.json`),{...reference,完整启动参数:session.browser.flags});while(cursor<list.length){const asset=list[cursor++];let svg;try{svg=await fs.readFile(resolveAssetPath(asset),'utf8');}catch(e){report.错误.push({素材:asset.id,错误:e.message});continue;}for(const job of jobsForAsset(asset))for(let attempt=0;;attempt++){const base={svg,id:job.id,action:job.action,color:job.color,triggerTime:job.triggerTime};const cacheFile=path.join(out,'cache',job.id,job.actionName+'.json');const key=actionCacheKey({svg,job,reference,fingerprint});try{const hit=cache?await cacheHit(cacheFile,key,out,freezePolicy):null;if(hit){report.动作.push({...hit.summary,缓存:true});break;}
 const size=await session.prepare(base);const state=await session.browser.evaluate('({period:__ref.period(),animated:__ref.hasAnimations()})');let kind=job.action.种类;let period=job.action.周期毫秒??state.period;
 // 清单可将旧 stay 标为待判定，是否还有无限循环以进场结束时的浏览器状态为准。
 if(job.action.stay===true||job.action.需判定停住||job.action.种类===null&&job.action.分类状态==='待验证'){await session.browser.evaluate(`__ref.seek(${job.triggerTime+job.action.毫秒})`);const remaining=await session.browser.evaluate('__ref.period()');kind=remaining>0?'进场后循环':'播完停住';period=remaining;}
 if(kind==='循环'&&state.animated&&!(period>0))throw new Error('循环动作存在动画，但没有可确定的无限循环周期；需要核对清单');
 const duration=kind==='循环'?period:job.action.毫秒;const times=frameTimes({id:asset.id,kind,duration,period,animated:state.animated});const files=[],frames=[];const write=async(rel,data)=>{const dest=path.join(out,rel);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,data);files.push({path:rel,hash:sha256(data)});};
 for(const scale of [1,2])for(const time of scaleTimes(times,size.width,scale)){const frame=await session.render({...base,scale,time,oplog:scale===1&&time===0});if(frame.metadata?.冻结策略!==freezePolicy)throw new Error('帧元数据冻结策略与会话实际策略不一致');if(scale===1&&time===0&&(!Array.isArray(frame.oplog)||!frame.oplog.length&&frame.空图!==true))throw new Error('0毫秒1倍帧缺少非空Chrome指令记录');const stem=`${job.id}/${job.actionName}/${time}@${scale}x`;await write(`ref/${stem}.png`,frame.png);await write(`live/${stem}.png`,frame.livePng);const meta={...frame.metadata,时间表:job.triggerTime===1234?'switch1234':'默认',动作种类:kind};await write(`ref/${stem}.json`,JSON.stringify(meta,null,2));await write(`live/${stem}.json`,JSON.stringify(meta,null,2));await write(`ref/${job.id}/${job.actionName}/${time}${scale===1?'':`@${scale}x`}.svg`,frame.svg);if(frame.oplog){await write(`oplog/${job.id}/${job.actionName}.json`,JSON.stringify(frame.oplog,null,2));if(job.action.名字==='待机'||!asset.动作.some(a=>a.名字==='待机')&&job.action===asset.动作[0]&&job.triggerTime===1000)await write(`oplog/${job.id}.json`,JSON.stringify(frame.oplog,null,2));}
 const {similarity,blurred,passed}=await freezeAgainstLive(path.join(out,`ref/${stem}.png`),path.join(out,`live/${stem}.png`));frames.push({时刻:time,倍率:scale,文件:`ref/${stem}.png`,冻结复核:frame.verification,相似度:similarity,相似度_模糊后:blurred,通过:frame.verification.通过&&passed});}
 const valueDuration=kind==='进场后循环'?duration+period:duration;const values=await session.sampleValues({...base,duration:state.animated?valueDuration:0});await write(`values/${job.id}/${job.actionName}.json`,JSON.stringify(values,null,2));
 const summary={素材:job.id,冻结策略:freezePolicy,源文件指纹:sha256(svg),首帧指令:`oplog/${job.id}/${job.actionName}.json`,动作:job.actionName,种类:kind,触发毫秒:job.triggerTime,周期毫秒:period,值表范围:state.animated?valueDuration:0,期望时刻:times,帧:frames,通过:frames.length>0&&frames.every(f=>f.通过),缓存:false};report.动作.push(summary);await saveJson(cacheFile,{key,reference,planningEvidence:{size,state,kind,period,duration},通过:summary.通过,files,summary});break;
 }catch(e){
  if(session.browser.alive?.()===false){
   report.浏览器重开??=[];report.浏览器重开.push({素材:job.id,动作:job.actionName,第几次:attempt+1,原因:e.message});
   try{await session.close();}catch{}
   session=null;const opened=await openSession();session=opened.s;reference=opened.r;
   if(attempt===0)continue;
  }
  report.错误.push({素材:job.id,动作:job.actionName,错误:e.stack||e.message});break;
 }}
 }}catch(e){report.错误.push({阶段:'浏览器/工作进程',错误:e.stack||e.message});}finally{if(session)try{await session.close();}catch(e){report.错误.push({阶段:'关闭浏览器',错误:e.message});}}};
 await Promise.all(Array.from({length:Math.min(concurrency,list.length)},worker));report.动作.sort((a,b)=>(a.素材+'/'+a.动作).localeCompare(b.素材+'/'+b.动作));report.耗时毫秒=performance.now()-start;report.期望动作数=list.reduce((n,a)=>n+jobsForAsset(a).length,0);report.通过=!report.错误.length&&report.动作.length===report.期望动作数&&report.动作.every(a=>a.通过);await saveJson(path.join(out,'报告/参照.json'),report);return report;
}
export async function main(argv=process.argv.slice(2)){const options={};for(let i=0;i<argv.length;i++){const a=argv[i];if(a==='--no-cache')options.cache=false;else if(a==='--gpu')options.mode='gpu';else if(['--manifest','--out','--concurrency','--id'].includes(a)){const v=argv[++i];if(!v)throw new Error(`${a} 缺少参数`);if(a==='--id')(options.ids??=[]).push(v);else options[a.slice(2)]=a==='--concurrency'?Number(v):v;}else throw new Error(`未知参数 ${a}`);}const r=await runBatch(options);console.log(JSON.stringify({通过:r.通过,动作数:r.动作.length,错误:r.错误,耗时毫秒:r.耗时毫秒},null,2));return r.通过?0:1;}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)try{process.exitCode=await main();}catch(e){console.error(e.stack);process.exitCode=2;}
