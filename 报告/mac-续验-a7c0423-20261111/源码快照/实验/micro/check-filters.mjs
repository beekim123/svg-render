// 真机回归：非整数倍率下，滤镜区域不能被额外的硬裁剪吞掉半像素。
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {PNG} from 'pngjs';
import {buildMicro} from './build.mjs';
import {createReferenceSession} from '../../tools/ref/index.mjs';
import {compareImages} from '../../tools/compare/metrics.mjs';
const output=await fs.mkdtemp(path.join(os.tmpdir(),'svg-render-filter-test-'));
let reference;
try{
 const {binary}=await buildMicro(output);
 const raw=path.join(output,'filter.rgba');
 const draw=spawnSync(binary,['7','1.5',raw],{encoding:'utf8'});
 assert.equal(draw.status,0,draw.error?.message||draw.stderr);
 const data=await fs.readFile(raw);
 assert.equal(data.length,384*384*4);
 reference=await createReferenceSession();
 const svg=await fs.readFile(new URL('./scenes/07-filters.svg',import.meta.url),'utf8');
 const captured=await reference.render({svg,scale:1.5});
 const result=compareImages(PNG.sync.read(captured.png),{width:384,height:384,data},{scale:1.5});
 const metrics=result.分组[0].指标;
 console.log(JSON.stringify(metrics));
 assert(metrics.ssim>=.999,`滤镜1.5倍 SSIM=${metrics.ssim}，要求≥0.999`);
 assert(metrics.大差比例_不算边<=.0001);
 assert.equal(metrics.最大差异块,0);
 console.log('通过：滤镜1.5倍符合实验5三条像素线。');
}finally{try{if(reference)await reference.close();}finally{await fs.rm(output,{recursive:true,force:true});}}
