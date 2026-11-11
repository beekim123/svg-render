import fs from 'node:fs/promises';
import path from 'node:path';
import {openChrome,VERSION} from '../chrome/index.mjs';
import {scanPage} from './page.mjs';
import {resolveAssetPath} from './path.mjs';
import {countPathSegments} from './path-data.mjs';
import {selectRegistered,assessRegistered} from './selection.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const write=async(p,v)=>{await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n');};
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function classify(key,scope,verifiedCSS=[]){
 if(Object.hasOwn(scope.特性,key))return scope.特性[key];
 for(const rule of scope.通配规则||[]){
  if(!key.startsWith(rule.前缀))continue;
  const property=key.slice(rule.前缀.length),standard=property.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
  if((rule.排除前缀||[]).some(p=>standard.startsWith(p))||(rule.排除属性||[]).includes(standard))continue;
  if(rule.前缀==='CSS属性/'&&verifiedCSS.includes(property))return rule.分类;
 }
 return '没登记';
}
async function main(){
 const assets=await read('素材/清单.json'),scope=await read('支持范围.json'),report=await read('报告/素材登记.json');
 const publicIndex=process.argv.indexOf('--register-public');
 const publicRoot=publicIndex>=0?path.resolve(process.argv[publicIndex+1]||''):null;
 if(publicRoot){
  const commit=path.basename(publicRoot);if(!/^[0-9a-f]{40}$/.test(commit))throw new Error('公开集目录末段必须是固定提交哈希');
  const walk=async dir=>{const files=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())files.push(...await walk(p));else if(entry.name.endsWith('.svg'))files.push(p);}return files;};
  for(const file of (await walk(path.join(publicRoot,'crates/resvg/tests'))).sort()){const id='公开测试集/'+path.relative(path.join(publicRoot,'crates/resvg/tests'),file).slice(0,-4);if(!assets.some(a=>a.id===id))assets.push({id,批:'公开测试集',文件:'cache:tests/resvg/'+commit+'/'+path.relative(publicRoot,file).split(path.sep).join('/'),动作:[{名字:'待机',种类:'循环'}],染色:false,候选:true,来源提交:commit});}
  report.公开测试集={状态:'待Chrome筛选',提交:commit,候选数:assets.filter(a=>a.批==='公开测试集').length,目录:publicRoot,条件:'仅静态且每项特性均为支持才登记；不确定的路径语法另列待验证'};
 }
 const out=path.join(root,'out',process.platform==='darwin'?'mac':'linux','scan');
 let chrome;const results=[];
 try{
  chrome=await openChrome();await chrome.send('Network.enable');await chrome.send('Network.setBlockedURLs',{urls:['http://*','https://*','file://*']});
  for(const asset of assets){
   const svg=await fs.readFile(resolveAssetPath(asset),'utf8');const combined={id:asset.id,Chrome版本:VERSION,状态:'完成',特性计数:{},动作:[]};
   for(const action of asset.动作){
    await chrome.setHtml(`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>body{margin:0}</style>${svg}`);
    await chrome.evaluate(`(()=>{const svg=document.querySelector('svg');svg.pauseAnimations();svg.setCurrentTime(0);const a=${JSON.stringify(action)};if(a.触发?.class)svg.classList.add(a.触发.class);if(a.触发?.attr)svg.setAttribute(...a.触发.attr);svg.getBoundingClientRect();if(a.名字!=='待机'){const nodes=a.smil?a.smil.map(q=>svg.querySelector(q)):[...svg.querySelectorAll('[begin="indefinite"]')];for(const n of nodes){if(!n||typeof n.beginElement!=='function')throw new Error('动作SMIL选择器无效');n.beginElement();}}for(const x of document.getAnimations()){x.pause();x.currentTime=0;}})()`);
    const snapshot=await chrome.evaluate(`(${scanPage.toString()})(${countPathSegments.toString()})`);
    if(action.名字==='待机'){
     const animated=snapshot.明细.CSS动画.length>0||snapshot.明细.SMIL.some(x=>x.begin!=='indefinite');
     action.动画验证='已由Chrome检查';action.静态=!animated;if(!animated)action.毫秒=0;
    }
    if(action.分类状态==='待验证'){
     const ending=await chrome.evaluate(`(()=>{const svg=document.querySelector('svg');svg.setCurrentTime(${action.毫秒}/1000);for(const a of document.getAnimations()){a.pause();a.currentTime=${action.毫秒};}svg.getBoundingClientRect();const css=document.getAnimations().filter(a=>a.effect.getTiming().iterations===Infinity&&a.effect.getComputedTiming().progress!==null).length;let smil=0,uncertain=0;for(const a of svg.querySelectorAll('animate,animateTransform,animateMotion,set')){if(a.getAttribute('repeatCount')!=='indefinite'&&a.getAttribute('repeatDur')!=='indefinite')continue;if(['end','min','max','restart'].some(p=>a.hasAttribute(p))||(a.hasAttribute('repeatDur')&&a.getAttribute('repeatDur')!=='indefinite')){uncertain++;continue;}try{const start=a.getStartTime(),duration=a.getSimpleDuration(),now=svg.getCurrentTime();if(now>=start&&Number.isFinite(duration))smil++;else if(!Number.isFinite(duration))uncertain++;}catch{uncertain++;}}return {css,smil,uncertain};})()`);
     action.Chrome判断=ending;
     if(!ending.uncertain){action.种类=ending.css+ending.smil>0?'进场后循环':'播完停住';action.分类状态='已验证';delete action.待验证原因;}
    }
    for(const [k,v] of Object.entries(snapshot.特性计数))combined.特性计数[k]=Math.max(combined.特性计数[k]||0,v);
    combined.动作.push({名字:action.名字,...snapshot});if(snapshot.未完成.length)combined.状态='待验证';
   }
   combined.分类=Object.fromEntries(Object.keys(combined.特性计数).map(k=>[k,classify(k,scope,[...new Set(combined.动作.flatMap(a=>a.已验证CSS属性||[]))])]));
   await write(path.join(out,asset.id+'.json'),combined);results.push(combined);
  }
  const {registered,excluded}=selectRegistered(assets,results);
  const assessment=assessRegistered(registered,results);
  for(const a of registered)delete a.候选;
  await write(path.join(root,'素材/清单.json'),registered);
  if(publicRoot){report.公开测试集.状态='已筛选';report.公开测试集.登记数=registered.filter(a=>a.批==='公开测试集').length;report.公开测试集.排除数=excluded.length;report.公开测试集.排除明细=excluded;}
  report.数量=registered.length;report.分批数量.公开测试集=registered.filter(a=>a.批==='公开测试集').length;
  const allVerifiedCSS=[...new Set(results.flatMap(r=>r.动作.flatMap(a=>a.已验证CSS属性||[])))];
  const summaryClass=k=>classify(k,scope,allVerifiedCSS);
  const keys=[...new Set(results.flatMap(r=>Object.keys(r.特性计数)))].sort((a,b)=>{const rank=k=>['不支持','没登记'].includes(summaryClass(k))?0:1;return rank(a)-rank(b)||a.localeCompare(b);});
  await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>SVG特性清单</title><style>table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px}.bad{background:#ffd6d6}th{position:sticky;top:0;background:white}</style><h1>SVG特性清单</h1><p>各动作取最大出现次数，不支持与没登记排在最上面。待验证项目不能作为验收通过。</p><table><tr><th>特性</th><th>分类</th>${results.map(r=>`<th>${escape(r.id)}</th>`).join('')}</tr>${keys.map(k=>`<tr class="${['不支持','没登记'].includes(summaryClass(k))?'bad':''}"><td>${escape(k)}</td><td>${summaryClass(k)}</td>${results.map(r=>`<td>${r.特性计数[k]||''}</td>`).join('')}</tr>`).join('')}</table>`);
  report.Chrome验证={状态:assessment.状态,登记集合检查:assessment,版本:VERSION,扫描数量:results.length,报告目录:path.relative(root,out)};
  report.stay待Chrome分类=registered.flatMap(a=>a.动作.filter(x=>x.分类状态==='待验证').map(x=>`${a.id}/${x.名字}`));
  report.静态及周期判断='静态已检查；循环周期由参照工具量取';
  // 公开集缺失、未分类动作或未登记特性都不能记成通过。
  const bad=assessment.状态!=='完成';
  report.待人工决定=results.flatMap(r=>Object.entries(r.分类).filter(([,v])=>v==='没登记').map(([特性])=>({id:r.id,特性,原因:'未修改支持范围，需按需求第9节请用户决定'})));
  if(report.待人工决定.length)console.error('发现没登记特性，已列入报告；必须请用户决定，不能自动扩支持范围。');
  report.状态=bad||report.stay待Chrome分类.length||!['已筛选'].includes(report.公开测试集.状态)?'待验证':'完成';
  await write(path.join(root,'报告/素材登记.json'),report);if(report.状态!=='完成')process.exitCode=1;
 }catch(e){report.Chrome验证={状态:'阻塞',版本:VERSION,原因:e.message,已扫描数量:results.length};report.状态='待验证';await write(path.join(root,'报告/素材登记.json'),report);console.error(e.message);process.exitCode=2;}
 finally{await chrome?.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename)await main();
