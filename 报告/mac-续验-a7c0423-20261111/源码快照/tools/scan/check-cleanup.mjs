// 已发现未知特性时，即使本次Chrome清理失败，也必须保留第9节停止码。
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'svg-render-scan-test-'));
const recorded=path.join(temp,'profile.json');
async function write(p,value){await fs.mkdir(path.dirname(path.join(temp,p)),{recursive:true});await fs.writeFile(path.join(temp,p),value);}
try{
 await write('package.json','{"type":"module"}');
 for(const file of ['tools/scan/cli.mjs','tools/scan/page.mjs','tools/scan/path.mjs','tools/scan/path-data.mjs','tools/scan/selection.mjs','tools/chrome/index.mjs'])await write(file,await fs.readFile(path.join(root,file)));
 try{await write('tools/chrome/svg.mjs',await fs.readFile(path.join(root,'tools/chrome/svg.mjs')));}catch(e){if(e.code!=='ENOENT')throw e;}
 await write('素材/fixture.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="12" height="12"/></svg>');
 await write('素材/清单.json',JSON.stringify([{id:'试验图/fixture',批:'试验图',文件:'素材/fixture.svg',动作:[{名字:'待机',种类:'循环'}]}]));
 await write('支持范围.json','{"特性":{},"通配规则":[]}');
 await write('报告/素材登记.json','{"公开测试集":{"状态":"已筛选"},"分批数量":{}}');
 const preload=path.join(temp,'fail-delete.mjs');
 await fs.writeFile(preload,`import fs from 'node:fs/promises';import path from 'node:path';const original=fs.rm.bind(fs);fs.rm=async(t,o)=>{if(path.basename(String(t)).startsWith('svg-render-chrome-')){await fs.writeFile(${JSON.stringify(recorded)},JSON.stringify(String(t)));throw new Error('回归测试：本次扫描profile清理失败');}return original(t,o);};`);
 const p=spawnSync(process.execPath,['--import',preload,'tools/scan/cli.mjs'],{cwd:temp,env:process.env,encoding:'utf8',maxBuffer:1024*1024});
 const r=JSON.parse(await fs.readFile(path.join(temp,'报告/素材登记.json')));
 assert(r.待人工决定.length>0,'测试前提：实际SVG扫描发现未知特性');
 assert.equal(p.status,3,`清理错误覆盖了第9节停止码：${p.stderr}`);
 assert(r.Chrome清理错误,'清理错误必须保留在报告中');
 console.log('通过：真实扫描发现未知特性且清理失败时，仍退出3并保留清理错误。');
}finally{
 const profile=await fs.readFile(recorded,'utf8').then(JSON.parse,()=>null);
 if(profile&&path.dirname(profile)===os.tmpdir()&&path.basename(profile).startsWith('svg-render-chrome-'))await fs.rm(profile,{recursive:true,force:true});
 await fs.rm(temp,{recursive:true,force:true});
}
