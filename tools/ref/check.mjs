import assert from 'node:assert/strict';
import {frameTimes,scaleTimes} from './schedule.mjs';
import {installTimeline} from './page.mjs';
assert.deepEqual(frameTimes({animated:false}),[0]);
const loop=frameTimes({id:'样例',period:1200});assert.equal(loop.length,15);assert.deepEqual(loop,frameTimes({id:'样例',period:1200}));assert.notDeepEqual(loop,frameTimes({id:'另一图',period:1200}));
const one=frameTimes({kind:'播一次',id:'样例',duration:1200});assert(one.includes(1199.5));assert(one.includes(0));assert(one.length<=28);
assert.equal(scaleTimes(loop,1920,2).length,3);assert.equal(scaleTimes(loop,1919,2).length,15);
// 页面安装函数必须能独立序列化，无模块闭包依赖。
assert.doesNotThrow(()=>new Function(`return (${installTimeline.toString()})`));
console.log('参照时刻安排与页面脚本语法检查通过；不代替 Chrome 冻结正确性验收。');
