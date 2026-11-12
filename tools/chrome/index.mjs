// 固定版本 Chrome 的进程和调试协议；只清理本工具创建的进程与目录。
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
export const VERSION='157.0.8103.50';
export const cacheRoot=process.env.SVG_RENDER_CACHE || (process.platform==='darwin'?path.join(os.homedir(),'Library/Caches/svg-render'):path.join(os.homedir(),'.cache/svg-render'));
export function chromePath(){return process.env.SVG_RENDER_CHROME || path.join(cacheRoot,'chrome',VERSION,process.platform==='darwin'?'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing':'chrome-linux64/chrome');}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const SHOT_MAX_TRIES=6;
// 连接断开后必须立刻失败：WebSocket 关闭后 send 不报错、直接丢弃，不处理就会每个请求白等到超时。
export class ChromeDisconnectedError extends Error {
 constructor(message){super(message);this.name='ChromeDisconnectedError';this.code='CHROME_DISCONNECTED';}
}
export async function connect(url,{describe=()=>'',timeoutMs=30000}={}){
 const ws=new WebSocket(url); await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.close();reject(new Error('Chrome 调试连接超时'));},15000);ws.onopen=()=>{clearTimeout(timer);resolve();};ws.onerror=e=>{clearTimeout(timer);reject(e);};});
 let sequence=0,closedReason=null; const pending=new Map(),listeners=new Set();
 const closedError=()=>new ChromeDisconnectedError(closedReason);
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}else for(const f of listeners)f(m);};
 ws.onclose=event=>{
  const detail=describe();
  closedReason=`Chrome 调试连接已关闭（关闭码 ${event?.code??'未知'}${detail?'；'+detail:''}）`;
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(closedError());}
  pending.clear();
 };
 const send=(method,params={})=>new Promise((resolve,reject)=>{
  if(closedReason||ws.readyState!==WebSocket.OPEN){closedReason??='Chrome 调试连接已关闭（发送前发现）';reject(closedError());return;}
  const id=++sequence;
  const timer=setTimeout(()=>{pending.delete(id);const detail=describe();reject(new Error(`调试协议超时：${method}${detail?'；'+detail:''}`));},timeoutMs);
  pending.set(id,{resolve,reject,timer});
  ws.send(JSON.stringify({id,method,params}));
 });
 return {send,on:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},close:()=>ws.close(),isClosed:()=>closedReason!==null};
}
export async function openChrome({mode='cpu',executable=chromePath(),extra=[]}={}){
 if(!['cpu','gpu'].includes(mode))throw new Error('光栅模式只能是 cpu 或 gpu');
 if(extra.some(f=>/^--(?:remote-debugging|user-data-dir|force-device-scale-factor|force-color-profile)/.test(f)))throw new Error('不能覆盖参照的调试地址、随机端口、用户目录、设备倍率或颜色空间');
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'svg-render-chrome-')),profile=path.join(tmp,'profile');
 const flags=['--headless=new','--force-device-scale-factor=1','--force-color-profile=srgb','--hide-scrollbars','--no-first-run','--no-default-browser-check','--disable-background-networking','--num-raster-threads=1',`--user-data-dir=${profile}`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',...(mode==='cpu'?['--disable-gpu']:['--enable-gpu-rasterization','--ignore-gpu-blocklist']),...extra,'about:blank'];
 const child=spawn(executable,flags,{stdio:['ignore','ignore','pipe']});let stderr='',spawnError;child.stderr.on('data',d=>stderr=(stderr+d).slice(-12000));child.on('error',e=>spawnError=e);const connections=[];
 let closing=false;
 // 断连时把 Chrome 自己的退出码和最后的 stderr 带进错误信息，否则查不出为什么断。
 const describe=()=>{
  if(closing)return '本工具主动关闭';
  const exited=child.exitCode!==null||child.signalCode!==null;
  const tail=stderr.trim().split('\n').slice(-8).join(' | ');
  return `${exited?`Chrome 已退出：退出码 ${child.exitCode}，信号 ${child.signalCode}`:'Chrome 进程仍在'}${tail?`；stderr 末尾：${tail}`:''}`;
 };
 const alive=()=>!closing&&child.exitCode===null&&child.signalCode===null&&connections.every(c=>!c.isClosed());
 const connectChrome=url=>connect(url,{describe});
 const close=async()=>{closing=true;for(const c of connections)c.close();if(child.exitCode===null&&child.signalCode===null&&!spawnError){child.kill('SIGTERM');for(let i=0;i<50&&child.exitCode===null&&child.signalCode===null;i++)await sleep(100);if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await new Promise(r=>child.once('exit',r));}}await fs.rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});};
 try{
 let port;for(let i=0;i<200;i++){if(spawnError)throw spawnError;if(child.exitCode!==null||child.signalCode!==null)throw new Error(`Chrome 启动失败：${stderr}`);try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(50);}}if(!port)throw new Error(`Chrome 启动超时：${stderr}`);
 const base=`http://127.0.0.1:${port}`,version=await(await fetch(`${base}/json/version`)).json();if(version.Browser.split('/')[1]!==VERSION)throw new Error(`版本不符：${version.Browser}，要求 ${VERSION}`);
 const browser=await connectChrome(version.webSocketDebuggerUrl);connections.push(browser);const info=await browser.send('SystemInfo.getInfo');const raster=info.gpu.featureStatus.rasterization;if(mode==='cpu'?raster!=='disabled_software':!['enabled','enabled_force'].includes(raster))throw new Error(`光栅校验失败：${mode} / ${raster}`);
 const gpuInfo={browser:version.Browser,rasterization:raster,devices:info.gpu.devices,featureStatus:info.gpu.featureStatus};
 // Mac 无头 Chrome 也会暂停后台页的 rAF；先激活本次求值的页，双页面冻结流程才会继续。
 const newPage=async()=>{const shotStats={last:0,retried:0};const target=await(await fetch(`${base}/json/new?about:blank`,{method:'PUT'})).json();const c=await connectChrome(target.webSocketDebuggerUrl);connections.push(c);const evaluate=async(expression,awaitPromise=true)=>{await c.send('Page.bringToFront');const r=await c.send('Runtime.evaluate',{expression,awaitPromise,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||JSON.stringify(r.exceptionDetails));return r.result.value;};await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Emulation.setDefaultBackgroundColorOverride',{color:{r:0,g:0,b:0,a:0}});
 return {...c,evaluate,setHtml:async html=>{const {frameTree}=await c.send('Page.getFrameTree');await c.send('Page.setDocumentContent',{frameId:frameTree.frame.id,html});},shot:async clip=>{
  // 截到连续两次逐字节相同为止：防止截到某些合成层还没光栅化完的帧（实验 1 的 scene_hall 两帧就是这样漏画了尘粒）。
  // 视口已经等于 SVG 显示尺寸，不扩视口截图，免得截图前 Chrome 改布局、重新光栅化。
  const raw=async()=>Buffer.from((await c.send('Page.captureScreenshot',{format:'png',clip:{...clip,scale:1},captureBeyondViewport:false})).data,'base64');
  let previous=await raw();
  for(let tries=2;tries<=SHOT_MAX_TRIES;tries++){const next=await raw();if(next.equals(previous)){shotStats.last=tries;shotStats.retried+=tries>2?1:0;return next;}previous=next;}
  throw new Error(`截图连续 ${SHOT_MAX_TRIES} 次都不一致，画面不稳定`);
 },shotStats,viewport:async(width,height)=>c.send('Emulation.setDeviceMetricsOverride',{width:Math.ceil(width),height:Math.ceil(height),deviceScaleFactor:1,mobile:false})};};
 const page=await newPage();return {...page,newPage,close,alive,describe,gpuInfo,flags,pid:child.pid,tmp};
 }catch(e){await close();throw e;}
}
