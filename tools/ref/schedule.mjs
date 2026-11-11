// 所有随机时刻由素材 id 固定种子，跨进程和平台保持相同。
import {createHash} from 'node:crypto';
export function frameTimes({id='',kind='循环',duration=0,period=0,animated=true}){
 if(!animated)return [0];const span=Math.max(0,duration||period);let seed=createHash('sha256').update(id).digest().readUInt32LE(0);const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};const times=[];
 const once=d=>{const n=Math.floor(d/50)+1;if(n<=24)for(let t=0;t<=d;t+=50)times.push(t);else for(let i=0;i<24;i++)times.push(i*d/23);times.push(Math.max(0,d-.5));};
 if(kind==='循环'){for(let i=0;i<12;i++)times.push(i*Math.min(period||span,8000)/12);}else{once(duration);if(kind==='进场后循环')for(let i=0;i<8;i++)times.push(duration+i*Math.min(period,8000)/8);}
 const total=kind==='进场后循环'?duration+Math.min(period,8000):span;for(let i=0;i<3;i++)times.push(random()*total);return [...new Set(times.map(t=>+t.toFixed(4)))].sort((a,b)=>a-b);
}
export function scaleTimes(times,width,scale){return width>=1920&&scale===2?[...new Set([times[0],times[Math.floor(times.length/2)],times.at(-1)])]:times;}
