// 固定Chrome将CSS关键字序列化为小写；已登记色彩空间不能被误判为新特性。
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {classify} from './cli.mjs';
const scope=JSON.parse(await fs.readFile(new URL('../../支持范围.json',import.meta.url)));
for(const value of ['srgb','sRGB','SRGB'])assert.equal(classify('滤镜色彩空间/'+value,scope),'支持');
for(const value of ['linearrgb','linearRGB','LINEARRGB'])assert.equal(classify('滤镜色彩空间/'+value,scope),'支持');
assert.equal(classify('滤镜色彩空间/new-gamut',scope),'没登记');
assert.equal(classify('新特性/srgb',scope),'没登记');
console.log('通过：已登记CSS色彩空间大小写一致归档，真正未知值仍未登记。');
