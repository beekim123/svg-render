// 真 Chrome 回归：建立第二页后，切换两页求值仍须完成双帧等待。
import assert from 'node:assert/strict';
import {openChrome} from './index.mjs';
const browser=await openChrome();
try {
 await browser.setHtml('<!doctype html><svg width="16" height="16"><rect width="8" height="8"/></svg>');
 const frozen=await browser.newPage();
 await frozen.setHtml('<!doctype html><svg width="16" height="16"><circle r="4" cx="8" cy="8"/></svg>');
 for(let round=0;round<3;round++)for(const [name,page] of [['活图',browser],['冻结',frozen]]){
  const result=await page.evaluate(`Promise.race([new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({frames:2,visibility:document.visibilityState})))),new Promise(resolve=>setTimeout(()=>resolve({frames:0,visibility:document.visibilityState}),1000))])`);
  assert.equal(result.frames,2,`${name}第${round+1}轮未收到两帧：${JSON.stringify(result)}`);
  assert.equal(result.visibility,'visible');
 }
 console.log('通过：真实 Chrome 两页面交替求值，6次双帧等待全部完成。');
}finally{await browser.close();}
