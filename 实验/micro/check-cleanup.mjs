// 真实24帧完成后让本次profile删除失败，验证失败撤销放行；不影响其他Chrome。
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'svg-render-cleanup-test-'));
const recorded=path.join(temp,'profile.json'),preload=path.join(temp,'fail-profile-delete.mjs'),output=path.join(temp,'output');
await fs.writeFile(preload,`import fs from 'node:fs/promises';import path from 'node:path';const original=fs.rm.bind(fs);fs.rm=async function(target,options){if(path.basename(String(target)).startsWith('svg-render-chrome-')){await fs.writeFile(${JSON.stringify(recorded)},JSON.stringify(String(target)));throw new Error('回归测试：本次Chrome profile删除失败');}return original(target,options);};`);
try{
 const p=spawnSync(process.execPath,['--import',preload,'实验/micro/run.mjs',`--output=${output}`],{cwd:root,env:process.env,encoding:'utf8',maxBuffer:1024*1024});
 const r=JSON.parse(await fs.readFile(path.join(output,'result.json')));
 assert.equal(r.像素及格,true,'测试前提：真实24帧像素须全部达标');
 assert.equal(r.指令已校准,true,'测试前提：当前指令须已校准');
 assert.equal(r.及格,false,'清理失败仍将实验5标为通过');
 assert.equal(p.status,2,'清理失败仍返回成功');
 assert(r.阻塞.some(s=>s.includes('profile删除失败')));
 console.log('通过：像素/校准均通过后，清理异常仍撤销整体通过并返回2，保留原技术结果。');
}finally{
 const profiles=await fs.readFile(recorded,'utf8').then(s=>[JSON.parse(s)],()=>[]);
 for(const dir of profiles)if(path.dirname(dir)===os.tmpdir()&&path.basename(dir).startsWith('svg-render-chrome-'))await fs.rm(dir,{recursive:true,force:true});
 await fs.rm(temp,{recursive:true,force:true});
}
