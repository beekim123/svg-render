import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { root } from '../../tools/setup/paths.mjs';
import { createReferenceSession } from '../../tools/ref/index.mjs';
import { compareFiles } from '../../tools/compare/cli.mjs';
import { writeReport } from '../../tools/compare/report.mjs';
import { buildMicro } from './build.mjs';
import {digest,fingerprintOplog,verifyCalibration} from './calibration.mjs';

const output=path.resolve(process.argv.find(x=>x.startsWith('--output='))?.slice(9) || path.join(root,'out',process.platform==='darwin'?'mac':'linux','micro'));
const skiaOnly=process.argv.includes('--skia-only');
const files=(await fs.readdir(path.join(root,'实验/micro/scenes'))).filter(x=>x.endsWith('.svg')).sort();
if(files.length!==8)throw new Error('必须恰好有 8 个手写场景');
const result={实验:5,平台:process.platform,架构:process.arch,时间:new Date().toISOString(),及格:false,像素及格:false,指令已校准:false,说明:'C++按固定Chrome真实指令核对；CDP未展开的参数按固定Blink源码及SVG数值核对。只有当前源码、库、配置和24份指令匹配已核对凭据且像素全部达标才放行。',帧:[],阻塞:[]};
await fs.mkdir(output,{recursive:true});
let reference;
try {
 const {binary,log}=await buildMicro(output);result.编译=log;
 const fileHashes={};
 for(const file of ['实验/micro/draw.cpp','实验/micro/sources.json','实验/skia/chromium-config.h','tools/chrome/index.mjs','tools/chrome/svg.mjs','tools/ref/index.mjs','tools/ref/page.mjs','tools/ref/verify.mjs','参照版本.json',...files.map(f=>'实验/micro/scenes/'+f)])fileHashes[file]=digest(await fs.readFile(path.join(root,file)));
 for(const [file,hash]of Object.entries(log.文件指纹))if(file.endsWith('/libskia.a')||file.endsWith('/libskcms.a'))fileHashes[path.basename(file)]=hash;
 fileHashes['Skia-args.gn']=digest(log.编译设置);
 result.校准输入={平台:process.platform,架构:process.arch,文件SHA256:fileHashes,指令SHA256:{}};
 // 先画出所有 Skia 图。Chrome 不可用时仍留下真实输出，但不补造参照和指标。
 for(let scene=1;scene<=8;scene++)for(const scale of [1,1.5,2]){
  const name=files[scene-1].replace('.svg',''),stem=`${name}@${scale}x`;
  const raw=path.join(output,'skia',stem+'.rgba'),png=raw.replace('.rgba','.png');await fs.mkdir(path.dirname(raw),{recursive:true});
  const p=spawnSync(binary,[String(scene),String(scale),raw],{encoding:'utf8'});
  if(p.error||p.status!==0)throw new Error(`Skia 绘制 ${stem} 失败：${p.error?.message||p.stderr}`);
  const data=await fs.readFile(raw),size=256*scale;if(data.length!==size*size*4)throw new Error(`${stem} RGBA 字节数错误`);
  let covered=0;for(let i=3;i<data.length;i+=4)if(data[i]>0)covered++;
  if(!covered)throw new Error(`${stem} 没有画出任何非透明像素`);
  await fs.writeFile(png,PNG.sync.write({width:size,height:size,data}));
  result.帧.push({场景:scene,文件:files[scene-1],倍率:scale,宽:size,高:size,非透明像素:covered,Skia:png,RGBA:raw,参照:null,指标:null,通过:false});
 }
 if(skiaOnly) result.阻塞.push('仅运行 Skia，未生成 Chrome 参照和指令，未做像素比较。');
 else {
  reference=await createReferenceSession();
  const pairs=[];
  // 平均偏色照常报告。实验 5 只规定三条线，255 不额外收紧未规定的第四条。
  const thresholds={'静止':{ssim:.999,'大差比例_不算边':.0001,'最大差异块':0,'平均偏色':255}};
  for(const frame of result.帧){
   const svg=await fs.readFile(path.join(root,'实验/micro/scenes',frame.文件),'utf8');
   const captured=await reference.render({svg,scale:frame.倍率,oplog:true,id:`micro/${frame.文件}`});
   result.校准输入.指令SHA256[`${frame.文件}@${frame.倍率}`]=fingerprintOplog(captured.oplog);
   const ref=path.join(output,'ref',`${frame.文件.replace('.svg','')}@${frame.倍率}x.png`);await fs.mkdir(path.dirname(ref),{recursive:true});
   await fs.writeFile(ref,captured.png);await fs.writeFile(ref.replace('.png','.svg'),captured.svg);
   await fs.writeFile(ref.replace('.png','.json'),JSON.stringify(captured.metadata,null,2));
   await fs.writeFile(ref.replace('.png','.oplog.json'),JSON.stringify(captured.oplog,null,2));
   const comparison=await compareFiles(ref,frame.Skia,{scale:frame.倍率,line:'静止',thresholds});
   frame.参照=ref;frame.指标=comparison.分组;frame.通过=comparison.通过;
   pairs.push({路径:path.basename(ref),...comparison});
  }
  await writeReport(path.join(output,'compare'),{配对:pairs});
  result.像素及格=result.帧.length===24&&result.帧.every(x=>x.通过);
  if(!result.像素及格){result.需询问=true;result.阻塞.push('存在像素未达标的微场景；先核对宏、指令、倍率、颜色空间、渐变抖动和滤镜裁剪，原因无法查明时必须停下来询问。');}
  let proof;try{proof=JSON.parse(await fs.readFile(path.join(root,'实验/micro/calibration.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  result.校准复核=verifyCalibration({proof,files:fileHashes,oplogs:result.校准输入.指令SHA256});
  result.指令已校准=result.校准复核.通过;
  result.及格=result.像素及格&&result.指令已校准;
  if(!result.指令已校准)result.阻塞.push('指令校准凭据缺失或已失效，保留门槛；详见校准复核原因。');
 }
} catch(e) {result.阻塞.push(e.stack||e.message);}
finally {if(reference)try{await reference.close();}catch(e){result.及格=false;result.清理失败=true;result.阻塞.push(`关闭本次 Chrome 失败：${e.message}`);}await fs.writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2));}
console.log(JSON.stringify({输出:output,已画帧数:result.帧.length,及格:result.及格,阻塞:result.阻塞},null,2));
// --skia-only 只验证可执行程序，绝不把退出码 0 理解成实验 5 通过。
if(result.需询问)console.error('STOP_RULE_9：微场景出现实际像素差，需要先分析原因，不继续后续验收。');
process.exitCode=result.需询问?3:skiaOnly&&result.帧.length===24?0:result.及格?0:2;
