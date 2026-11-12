import fs from 'node:fs/promises';
import path from 'node:path';
import {PNG} from 'pngjs';
import {createReferenceSession} from '../../tools/ref/index.mjs';
import {compareImages} from '../../tools/compare/metrics.mjs';
import {fixtures} from './fixtures.mjs';
import {readCharacters,replaceWithPaths} from './page.mjs';
import {loadFonts,outlineRecords} from './outline.mjs';
const root=path.resolve(import.meta.dirname,'../..');
function crop(image,box){
 const x=Math.max(0,Math.floor(box.x)),y=Math.max(0,Math.floor(box.y)),right=Math.min(image.width,Math.ceil(box.x+box.width)),bottom=Math.min(image.height,Math.ceil(box.y+box.height));
 if(right<=x||bottom<=y)throw new Error('文字包围盒为空');
 const result=new PNG({width:right-x,height:bottom-y});PNG.bitblt(image,result,x,y,result.width,result.height,0,0);return result;
}
// smoothing='antialiased' 只用于诊断：给 SVG 根加 -webkit-font-smoothing，看 Mac 上文字比轮廓粗是不是 CoreText 平滑造成的。
export async function runText({platform=process.platform==='darwin'?'mac':'linux',smoothing=null,output=path.join(root,'out',platform,smoothing?`text-${smoothing}`:'text')}={}){
 await fs.mkdir(output,{recursive:true});const rows=[],result={实验:6,平台:platform,字体平滑:smoothing??'默认',状态:'未验证',及格:false,阈值:{'2倍SSIM':0.98,字符位置差:0.1},结果:rows};let session;
 try{
  const fonts=loadFonts();session=await createReferenceSession();
  for(const base of fixtures())for(const scale of [1,2]){
   const fixture=smoothing?{...base,svg:base.svg.replace('<svg ',`<svg style="-webkit-font-smoothing:${smoothing}" `)}:base;
   const dir=path.join(output,fixture.id);await fs.mkdir(dir,{recursive:true});
   const original=await session.render({svg:fixture.svg,scale,id:fixture.id});
   // 从原始 text 读取字符接口。prepare 会等待固定字体加载。
   await session.prepare({svg:fixture.svg,scale});
   const records=await session.browser.evaluate(`(${readCharacters.toString()})()`);
   await fs.writeFile(path.join(dir,`characters@${scale}x.json`),JSON.stringify(records,null,2));
   const outlines=outlineRecords(records,fonts);
   const converted=await session.browser.evaluate(`(${replaceWithPaths.toString()})(${JSON.stringify(outlines)})`);
   const outlined=await session.render({svg:converted.svg,scale,id:fixture.id});
   for(const [name,r]of [['text',original],['outline',outlined]]){
    await fs.writeFile(path.join(dir,`${name}@${scale}x.png`),r.png);await fs.writeFile(path.join(dir,`${name}@${scale}x.svg`),r.svg);await fs.writeFile(path.join(dir,`${name}@${scale}x.json`),JSON.stringify(r.metadata,null,2));
   }
   const box=records[0].box,a=crop(PNG.sync.read(original.png),box),b=crop(PNG.sync.read(outlined.png),box),comparison=compareImages(a,b,{line:'文字',scale});
   await fs.writeFile(path.join(dir,`diff@${scale}x.png`),PNG.sync.write(comparison.差异图));delete comparison.差异图;
   // 位置差 = 我们按字体度量摆出的字身框 和 getExtentOfChar 四条边的最大差（含空格）。
   // 原来比的是墨迹框对字身框，口径不同，差值随字号线性变大，留作"墨迹框差"只看不判。
   const visible=converted.geometry.filter(g=>!g.empty),maxPosition=Math.max(0,...converted.geometry.map(g=>g.cellDelta));
   const row={id:fixture.id,倍率:scale,截图区域:box,比较:comparison,字符:converted.geometry,最大字符位置差:maxPosition,字身框差_按字体原值:Math.max(0,...converted.geometry.map(g=>g.cellRawDelta)),墨迹框差_只看不判:Math.max(0,...visible.map(g=>g.inkDelta)),及格:scale===2?comparison.分组[0].指标.ssim>=0.98&&maxPosition<=0.1:null};
   rows.push(row);await fs.writeFile(path.join(dir,`result@${scale}x.json`),JSON.stringify(row,null,2));
  }
  result.状态='已运行';result.及格=rows.filter(r=>r.倍率===2).every(r=>r.及格);
 }catch(error){result.状态='执行失败，未验证';result.错误=error.stack;process.exitCode=2;}
 finally{try{if(session)await session.close();}catch(error){result.状态='清理失败';result.及格=false;result.清理错误=error.stack;process.exitCode=2;}await fs.writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2));}
 return result;
}
if(process.argv[1]===import.meta.filename){const at=process.argv.indexOf('--smoothing');const result=await runText({smoothing:at>0?process.argv[at+1]:null});console.log(JSON.stringify(result,null,2));if(!result.及格)process.exitCode=result.错误?2:1;}
