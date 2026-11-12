// 真实扫描输入错误回归：只在临时仓库运行，不改正式清单或原件。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,cache} from '../setup/paths.mjs';
import {resvgRevision} from '../setup/install.mjs';
import {chromePath} from '../chrome/index.mjs';
import {selectRegistered,assessRegistered} from './selection.mjs';
const option=name=>process.argv.find(arg=>arg.startsWith(name+'='))?.slice(name.length+1);
const reportDir=option('--report-dir')?path.resolve(root,option('--report-dir')):null;
async function record(name,value){if(!reportDir)return;await fs.mkdir(reportDir,{recursive:true});await fs.writeFile(path.join(reportDir,name),JSON.stringify(value,null,2)+'\n');}
function verifySelection(){
 const reason='SVG加载失败（来源：bad）：XML解析失败；完整行列号与原生解析原因';
 const asset={id:'bad',批:'公开测试集',候选:true,动作:[{名字:'待机',种类:'循环'}]},scan={id:'bad',状态:'输入无效',动作:[],分类:{},输入错误:{code:'SVG_INPUT_INVALID',kind:'XML_PARSE_ERROR',source:'bad',message:reason,details:'完整行列号与原生解析原因'}};
 const selected=selectRegistered([asset],[scan]);assert.equal(selected.registered.length,0);assert.deepEqual(selected.excluded[0].原因,[reason],'输入失败不能被误写成非静态或未分类特性');assert.deepEqual(selected.excluded[0].输入错误,scan.输入错误);
 for(const formal of [{...asset,批:'现有游戏',候选:undefined},{...asset,候选:undefined}]){const result=selectRegistered([formal],[scan]);assert.equal(result.registered.length,1,'正式来源输入错误不能静默剔除');assert.deepEqual(assessRegistered(result.registered,[scan]).未完成,['bad']);}
 console.log('通过：候选输入解析错误保留完整单一原因；非公开及未重筛正式公开来源保留为阻塞缺项。');
}
if(process.argv.includes('--unit'))verifySelection();
else{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'svg-render-input-test-'));
 const write=async(file,value)=>{const target=path.join(temp,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,value);};
 try{
  await write('package.json','{"type":"module"}');
  for(const file of ['tools/scan/cli.mjs','tools/scan/page.mjs','tools/scan/path.mjs','tools/scan/path-data.mjs','tools/scan/selection.mjs','tools/chrome/index.mjs','tools/chrome/svg.mjs'])await write(file,await fs.readFile(path.join(root,file)));
  await write('支持范围.json',await fs.readFile(path.join(root,'支持范围.json')));
  await write('素材/invalid.svg','<svg xmlns="http://www.w3.org/2000/svg"><g></svg>');
  await write('素材/ordinary.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="10" height="10"/></svg>');
  await write('素材/entity.svg',await fs.readFile(path.join(cache,'tests/resvg',resvgRevision,'crates/resvg/tests/tests/structure/svg/elements-via-ENTITY-reference-1.svg')));
  for(const name of ['negative-size','zero-size','no-size'])await write('素材/'+name+'.svg',await fs.readFile(path.join(cache,'tests/resvg',resvgRevision,'crates/resvg/tests/tests/structure/svg',name+'.svg')));
  const asset=(id,file,batch='公开测试集',candidate=true)=>({id,文件:file,批:batch,...(candidate?{候选:true}:{}),动作:[{名字:'待机',种类:'循环'}]});
  async function run(name,assets,env={},args=[]){
   const original=JSON.stringify(assets);await write('素材/清单.json',original);await write('报告/素材登记.json','{"公开测试集":{"状态":"已筛选"},"分批数量":{}}');
   const child=spawnSync(process.execPath,['tools/scan/cli.mjs',...args],{cwd:temp,env:{...process.env,...env},encoding:'utf8',maxBuffer:1024*1024});
   const report=JSON.parse(await fs.readFile(path.join(temp,'报告/素材登记.json'),'utf8')),after=await fs.readFile(path.join(temp,'素材/清单.json'),'utf8');
   const result={退出码:child.status,stdout:child.stdout,stderr:child.stderr,报告:report,清单:JSON.parse(after),清单未修改:after===original};await record(name+'.json',result);return result;
  }
  const publicResult=await run('候选解析错误',[asset('public-invalid','素材/invalid.svg'),asset('public-negative','素材/negative-size.svg'),asset('public-zero','素材/zero-size.svg'),asset('public-no-size','素材/no-size.svg'),asset('public-entity','素材/entity.svg'),asset('ordinary','素材/ordinary.svg','现有游戏',false)]);
  console.log(`候选解析错误真实扫描：退出${publicResult.退出码}，状态=${publicResult.报告.状态}`);
  assert.equal(publicResult.退出码,0,'公开候选明确输入错误应记录排除并继续，而非阻塞后续合法输入');assert.deepEqual(publicResult.清单.map(asset=>asset.id),['public-no-size','public-entity','ordinary'],'负/零采样尺寸候选须明确排除，Chrome给正值的no-size保留');
  const rejected=publicResult.报告.输入解析排除;assert.equal(rejected?.length,1);assert.equal(rejected[0].输入错误.code,'SVG_INPUT_INVALID');assert(rejected[0].输入错误.details.includes('line'));assert.equal(rejected[0].原因.length,1);assert(!rejected[0].原因[0].includes('不是静态图'));
  const sizes=publicResult.报告.采样尺寸排除;assert.deepEqual(sizes.map(item=>item.id),['public-negative','public-zero']);for(const item of sizes){assert.equal(item.采样尺寸错误.code,'SVG_SAMPLE_SIZE_INVALID');assert.equal(item.原因.length,1);assert(!item.原因[0].includes('不是静态图'));assert.equal(item.输入错误,undefined);}
  const noSize=JSON.parse(await fs.readFile(path.join(temp,'out',process.platform==='darwin'?'mac':'linux','scan/public-no-size.json'),'utf8'));assert(noSize.采样尺寸.width>0&&noSize.采样尺寸.height>0);await record('无显式尺寸合法结果.json',noSize);
  const entity=JSON.parse(await fs.readFile(path.join(temp,'out',process.platform==='darwin'?'mac':'linux','scan/public-entity.json'),'utf8'));assert.equal(entity.特性计数['元素/rect'],2,'真实扫描仍丢失实体展开的rect');await record('实体扫描结果.json',entity);
  for(const [name,batch]of [['非公开解析错误','现有游戏'],['正式公开解析错误','公开测试集']]){const result=await run(name,[asset('formal-invalid','素材/invalid.svg',batch,false)]);assert.equal(result.退出码,2);assert.equal(result.报告.状态,'待验证');assert.equal(result.报告.Chrome验证.输入错误.code,'SVG_INPUT_INVALID');assert.equal(result.清单未修改,true,'正式来源不能被静默剔除');console.log(`通过：${name}真实阻塞并保留原清单。`);}
  for(const [name,batch,file]of [['非公开采样尺寸错误','现有游戏','negative-size'],['正式公开采样尺寸错误','公开测试集','zero-size']]){const result=await run(name,[asset('formal-size','素材/'+file+'.svg',batch,false)]);assert.equal(result.退出码,2);assert.equal(result.报告.Chrome验证.采样尺寸错误.code,'SVG_SAMPLE_SIZE_INVALID');assert.equal(result.报告.Chrome验证.输入错误,undefined);assert.equal(result.清单未修改,true);console.log(`通过：${name}单独记录尺寸前提阻塞，保留原清单。`);}
  const revision='a'.repeat(40),fakeCache=path.join(temp,'rescreen-cache'),publicRoot=path.join(fakeCache,'tests/resvg',revision),testRoot=path.join(publicRoot,'crates/resvg/tests');
  await fs.mkdir(testRoot,{recursive:true});await fs.writeFile(path.join(testRoot,'bad.svg'),'<svg xmlns="http://www.w3.org/2000/svg"><g></svg>');await fs.writeFile(path.join(testRoot,'good.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="10" height="10"/></svg>');
  const rescreen=await run('显式公开重筛',[asset('公开测试集/bad',`cache:tests/resvg/${revision}/crates/resvg/tests/bad.svg`,'公开测试集',false),asset('ordinary','素材/ordinary.svg','现有游戏',false)],{SVG_RENDER_CACHE:fakeCache,SVG_RENDER_CHROME:chromePath()},['--register-public',publicRoot]);
  assert.equal(rescreen.退出码,0);assert.deepEqual(rescreen.报告.公开测试集.重新筛选已有登记,['公开测试集/bad']);assert.equal(rescreen.报告.输入解析排除[0].id,'公开测试集/bad');assert.deepEqual(rescreen.清单.map(item=>item.id).sort(),['ordinary','公开测试集/good'].sort());console.log('通过：显式公开重筛记录已有登记来源，输入错误有完整排除证据，不等同于未授权剔除正式来源。');
  const failedBrowser=await run('浏览器错误不得伪装输入错误',[asset('ordinary','素材/ordinary.svg','现有游戏',false)],{SVG_RENDER_CHROME:path.join(temp,'missing-Chrome')});assert.equal(failedBrowser.退出码,2);assert.equal(failedBrowser.报告.Chrome验证.输入错误,undefined);assert.equal(failedBrowser.清单未修改,true);console.log('通过：浏览器启动错误保持阻塞，不赋SVG_INPUT_INVALID。');
  verifySelection();console.log('通过：真实候选输入排除、实体计数、正式来源阻塞及错误域区分。');
 }finally{await fs.rm(temp,{recursive:true,force:true});}
}
