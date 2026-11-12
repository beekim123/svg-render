// 特性待人分类属于需求第9节，不得用普通失败退出码让Mac入口继续。
import assert from 'node:assert/strict';
import {scanExitCode} from './cli.mjs';
assert.equal(scanExitCode({状态:'完成',待人工决定:[]}),0);
assert.equal(scanExitCode({状态:'待验证',待人工决定:[]}),1);
assert.equal(scanExitCode({状态:'待验证',待人工决定:[{id:'复杂测试图/example',特性:'没登记的新特性'}]}),3);
console.log('通过：未知特性退出3，普通待验证退出1，完成退出0。');
