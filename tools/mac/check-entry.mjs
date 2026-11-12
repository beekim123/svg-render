// 执行真实 mac 入口，替换下载/大编译边界；用文件副作用确认实验5失败后不启动后续。
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'svg-render-entry-test-'));
async function write(file,value){await fs.mkdir(path.dirname(path.join(temp,file)),{recursive:true});await fs.writeFile(path.join(temp,file),value);}
function git(...args){const p=spawnSync('git',args,{cwd:temp,encoding:'utf8'});assert.equal(p.status,0,p.stderr);return p.stdout;}
try{
 await write('package.json','{"type":"module"}');
 for(const file of ['tools/mac/runner.mjs','tools/setup/paths.mjs','tools/setup/preflight.mjs'])await write(file,await fs.readFile(path.join(root,file)));
 const original=process.argv.includes('--baseline')?spawnSync('git',['show','a7c042326f4c9f11271d6b5e2a3095e076210ac8:tools/mac.mjs'],{cwd:root,encoding:'utf8'}).stdout:await fs.readFile(path.join(root,'tools/mac.mjs'),'utf8');
 await write('tools/mac.mjs',original);
 await write('tools/setup/install.mjs','export const resvgRevision="fixture"; export async function install(){return true;}');
 await write('bin/npm','#!/bin/sh\nexit 0\n');await fs.chmod(path.join(temp,'bin/npm'),0o755);
 await write('实验/skia/build.mjs','');await write('实验/skia/link.mjs','');
 await write('实验/micro/run.mjs',`import fs from 'node:fs';fs.mkdirSync('out/mac/micro',{recursive:true});fs.writeFileSync('out/mac/micro/result.json',JSON.stringify({及格:false,本次输出:true}));process.exit(2);`);
 await write('实验/text/run.mjs',`import fs from 'node:fs';fs.writeFileSync('should-not-start-text','started');`);
 await write('报告/mac/旧记录.txt','必须保留');
 await write('报告/mac/验收.json','{"全部通过":true,"旧记录":true}');
 await write('out/mac/text/result.json','{"及格":true,"旧记录":true}');
 git('init','-q');git('add','.');git('-c','user.name=入口回归','-c','user.email=entry-test@example.invalid','commit','-qm','测试夹具');
 const p=spawnSync(process.execPath,['tools/mac.mjs'],{cwd:temp,encoding:'utf8',env:{...process.env,PATH:path.join(temp,'bin')+path.delimiter+process.env.PATH,SVG_RENDER_CACHE:path.join(temp,'cache'),PYTHONDONTWRITEBYTECODE:'1'},maxBuffer:4*1024*1024});
 assert.equal(await fs.access(path.join(temp,'should-not-start-text')).then(()=>true,()=>false),false,'真实mac入口仍启动了实验6');
 assert.equal(p.status,1,p.stdout+p.stderr);
 const steps=JSON.parse(await fs.readFile(path.join(temp,'报告/mac/步骤.json')));
 assert.equal(steps.步骤.find(t=>t.步骤==='实验5微场景').退出码,2);
 assert.equal(steps.步骤.find(t=>t.步骤==='实验6文字轮廓').状态,'停止后未运行');
 assert.equal(steps.全部步骤成功,false);
 const acceptance=JSON.parse(await fs.readFile(path.join(temp,'报告/mac/验收.json')));
 assert.equal(acceptance.全部通过,false);assert.equal(acceptance.本轮状态,'未运行');
 const text=JSON.parse(await fs.readFile(path.join(temp,'报告/mac/实验6.json')));
 assert.equal(text.本轮状态,'未运行');assert.equal(text.旧记录,undefined);
 const old=steps.历史报告归档;
 assert.equal(await fs.readFile(path.join(old,'旧记录.txt'),'utf8'),'必须保留');
 assert.equal(JSON.parse(await fs.readFile(path.join(old,'验收.json'))).全部通过,true);
 assert.equal(JSON.parse(await fs.readFile(path.join(temp,'out/mac/text/result.json'))).旧记录,true);
 console.log('通过：真实mac入口在退出2后停止；旧报告已归档，未运行的步骤没有摘要。');
}finally{await fs.rm(temp,{recursive:true,force:true});}
