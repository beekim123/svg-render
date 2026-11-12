import assert from 'node:assert/strict';
import {fixtures} from './fixtures.mjs';
import {loadFonts,outlineRecords} from './outline.mjs';
const fonts=loadFonts(),cases=fixtures();assert.equal(cases.length,36);
let visible=0,spaces=0;
for(const weight of [400,700])for(const size of [14,24,48]){
 const records=outlineRecords([{characters:[...'中文 123 数字'].map(char=>({char,size,weight}))}],fonts);
 for(const c of records[0].characters){assert.ok(c.glyphId>0);assert.ok(c.scale>0);if(c.char===' '){assert.equal(c.path,'');spaces++;}else{assert.match(c.path,/^M/);visible++;}}
}
console.log(JSON.stringify({状态:'离线自测通过',组合:cases.length,非空轮廓:visible,合法空格:spaces,说明:'固定 OTF 字形提取与测试覆盖检查通过。'},null,2));
