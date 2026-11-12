import fs from 'node:fs/promises';
import {openChrome} from '../../tools/chrome/index.mjs';
// 用法：node 实验/capture/img-ref-probe.mjs '冻结.svg|名字' ... 输出到 OUT（默认 /private/tmp/img-ref-probe）。
// 把冻结 SVG 当 <img> 画：Chrome 整张一次栅格，不拆合成层。
const out=process.env.OUT||'/private/tmp/img-ref-probe';await fs.mkdir(out,{recursive:true});
const items=process.argv.slice(2).map(s=>s.split('|'));
const chrome=await openChrome();
try{
 for(const [svgFile,label]of items){
  const page=await chrome.newPage();
  let layers=[];
  page.on(m=>{if(m.method==='LayerTree.layerTreeDidChange')layers=m.params.layers||[];});
  await page.send('LayerTree.enable');
  const svg=await fs.readFile(svgFile,'utf8');
  const w=Number(svg.match(/<svg[^>]*\swidth="([\d.]+)/)[1]),h=Number(svg.match(/<svg[^>]*\sheight="([\d.]+)/)[1]);
  const url='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
  await page.viewport(w,h);
  await page.setHtml(`<html><style>html,body{margin:0;background:transparent}img{display:block}</style><body><img width="${w}" height="${h}" src="${url}"></body></html>`);
  await page.evaluate('new Promise(r=>{const i=document.querySelector("img");i.complete?r():i.onload=r})');
  await page.shot({x:0,y:0,width:w,height:h});
  const png=await page.shot({x:0,y:0,width:w,height:h});
  await fs.writeFile(`${out}/${label}-img.png`,png);
  console.log(label,w,h,'layers',layers.filter(l=>l.drawsContent).length);
 }
}finally{await chrome.close();}
