// DOM替身只测试时间线对象的生命周期，不验证浏览器样式和像素。
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installTimeline} from './page.mjs';
let smilTime=0;const begun=[];let animations=[];const targets=[];
const makeAnimation=name=>{const a={name,playState:'running',currentTime:12,pause(){this.playState='paused';},effect:{target:{id:name},getKeyframes:()=>[{transform:'matrix(1,0,0,1,0,0)'}],getTiming:()=>({iterations:Infinity,duration:10000})}};targets.push(a.effect.target);return a;};
const idle=makeAnimation('idle');animations=[idle];const smil={beginElement(){begun.push(smilTime);}};let cast;
const svg={pauseAnimations(){},setCurrentTime(t){smilTime=t;},getBoundingClientRect(){return {};},querySelectorAll(selector){if(selector==='*')return targets;if(selector==='[begin="indefinite"]')return [smil];return [];},querySelector(selector){return selector==='#pulse'?smil:null;},classList:{add(){cast=makeAnimation('cast');animations.push(cast);},remove(){if(cast){cast.playState='idle';animations=animations.filter(a=>a!==cast);}}},setAttribute(){}};
const sandbox={window:{},document:{querySelector:()=>svg,getAnimations:()=>animations},console};vm.runInNewContext(`(${installTimeline.toString()})()`,sandbox);const timeline=sandbox.window.__ref;
assert.equal(idle.currentTime,0);timeline.seek(1234);timeline.trigger({触发:{class:'cast'},smil:['#pulse']});timeline.seek(1734);assert.equal(idle.currentTime,1734);assert.equal(cast.currentTime,500);assert.deepEqual(begun,[1.234]);assert.equal(timeline.period(),8000);
// 结束动画从 document.getAnimations() 消失，保留对象依旧可前后定位。
const firstCast=cast;animations=[idle];firstCast.playState='finished';timeline.seek(7000);assert.equal(firstCast.currentTime,5766);timeline.seek(1734);assert.equal(firstCast.currentTime,500);
// 换动作后不能把已取消的对象重新设置时间，以免恢复已消失的动画。
animations=[idle,firstCast];timeline.seek(2000);timeline.trigger({触发:{class:'second'}});const secondCast=cast;timeline.seek(2500);assert.equal(idle.currentTime,2500);assert.equal(secondCast.currentTime,500);assert.equal(firstCast.playState,'idle');assert.equal(firstCast.currentTime,766);
console.log('时间线离线测试通过：1234ms触发、循环不重置、结束动画回跳、取消动画不复活。尚非Chrome行为验证。');
