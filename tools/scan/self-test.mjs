// 无浏览器单元检查只验证登记与分类结构，不冒充Chrome扫描验收。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {classify} from './cli.mjs';
import {resolveAssetPath} from './path.mjs';
import {countPathSegments} from './path-data.mjs';
import {selectRegistered,assessRegistered} from './selection.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const items=await read('素材/清单.json'),scope=await read('支持范围.json');
assert.equal(new Set(items.map(a=>a.id)).size,items.length);
for(const [batch,n] of Object.entries({现有游戏:82,待接入:35,复杂测试图:44,试验图:1}))assert.equal(items.filter(a=>a.批===batch).length,n);
for(const a of items){assert(a.id.startsWith(a.批+'/'));await fs.access(path.join(root,a.文件));for(const x of a.动作){assert(x.名字);assert(['循环','播一次','播完停住','进场后循环'].includes(x.种类)||x.分类状态==='待验证');if(x.分类状态==='待验证')assert.equal(x.种类,null);}}
assert.equal(classify('元素/path',scope),'支持');assert.equal(classify('SMIL/calcMode/paced',scope),'采样兜底');assert.equal(classify('禁止/外部资源',scope),'不支持');assert.equal(classify('从未登记',scope),'没登记');
assert.equal(items.filter(a=>a.批==='公开测试集').length,0);
console.log('登记结构、批次数量、文件存在、四类特性分类检查通过；不包含Chrome验证。');

const cached={文件:'cache:tests/resvg/abc/crates/resvg/tests/a.svg'};
assert.equal(resolveAssetPath(cached,{cacheDirectory:'/linux/cache'}),'/linux/cache/tests/resvg/abc/crates/resvg/tests/a.svg');
assert.equal(resolveAssetPath(cached,{cacheDirectory:'/Users/test/Library/Caches/svg-render'}),'/Users/test/Library/Caches/svg-render/tests/resvg/abc/crates/resvg/tests/a.svg');
assert.throws(()=>resolveAssetPath({文件:'cache:../private'}));
for(const [d,n] of [['',0],['M0 0',1],['M0 0 10 10 20 20z',4],['m.5-.5h2v3l1e2-2E-2Z',5],['M0,0 C1 2 3 4 5 6 S7 8 9 10 Q1 2 3 4 T5 6',5],['M0 0A5 5 0 0110 20',2],['M0 0L1 1,2 2',3]])assert.equal(countPathSegments(d),n,d);
for(const d of ['L0 0','M','M0','M,0 0','M0 0,','M0 0,,1 1','M0 0A5 5 0 2 0 10 10','M0 0z1 2','M0 0X1 2','M0 0A-1 1 0 0 0 2 2'])assert.throws(()=>countPathSegments(d),d);
console.log('跨平台缓存路径、完整路径命令组和无效数据检查通过。');

const candidate=(id,batch='公开测试集')=>({id,批:batch,动作:[{静态:true}]});
const result=(id,status)=>({id,状态:'完成',分类:{测试特性:status},动作:[{明细:{SMIL:[]},特性计数:{}}]});
const candidates=[candidate('支持'),candidate('不支持'),candidate('未知'),candidate('游戏不支持','现有游戏')];
const scans=[result('支持','支持'),result('不支持','不支持'),result('未知','没登记'),result('游戏不支持','不支持')];
const selection=selectRegistered(candidates,scans);
assert.deepEqual(selection.registered.map(a=>a.id),['支持','游戏不支持']);
assert.equal(selection.excluded.length,2);assert(selection.excluded.find(a=>a.id==='未知').原因.some(r=>r.includes('没登记')));
assert.equal(assessRegistered(selection.registered,scans).状态,'完成');
assert.equal(assessRegistered(selection.registered,scans).不支持.length,1);
assert.equal(assessRegistered([candidate('未知','现有游戏')],scans).状态,'待验证');
assert.equal(assessRegistered([candidate('缺失','现有游戏')],scans).状态,'待验证');
console.log('公开候选筛选、排除原因、登记集合验收与未知特性检查通过。');

assert.equal(classify('CSS属性/opacity',scope,['opacity']),'支持');
assert.equal(classify('CSS属性/opacity',scope),'没登记');
assert.equal(classify('CSS属性/--unknown',scope,['--unknown']),'没登记');
assert.equal(classify('CSS属性/transitionDuration',scope,['transitionDuration']),'没登记');
assert.equal(classify('CSS属性/perspective',scope,['perspective']),'没登记');
assert.equal(classify('其他/CSS变量',scope),'支持');
assert.equal(classify('任意类别/opacity',scope,['opacity']),'没登记');
assert.equal(classify('CSS属性/opacity',{特性:{}},['opacity']),'没登记');
console.log('显式CSS通配规则、Chrome验证门槛与自定义/禁用属性排除检查通过。');

assert.equal(items.length,162);
assert.equal(items.filter(a=>a.染色).length,10);
const get=id=>items.find(a=>a.id===id);
for(const name of ['flat','gradient','shaded']){
 const a=get('复杂测试图/icons/icon_tint_'+name);assert.equal(a.动作.length,1);assert.equal(a.动作[0].名字,'待机');assert.equal(a.动作[0].静态,true);assert.equal(a.动作[0].毫秒,0);assert.equal(a.染色,true);
}
assert.deepEqual(get('复杂测试图/ui_hud_slot').槽,{slot_text:[430,196,28]});
assert.equal(get('复杂测试图/char_golem').动作.find(a=>a.名字==='倒下').毫秒,800);
assert.equal(get('复杂测试图/char_lich').动作.find(a=>a.名字==='眩晕').种类,'进场后循环');
for(const name of ['fx_explosion','fx_lightning'])assert.equal(get('复杂测试图/'+name).动作.length,1);
assert.equal(items.filter(a=>a.批==='复杂测试图'&&a.id.includes('/icons/')&&!a.染色).length,30);
assert(items.filter(a=>a.批==='复杂测试图').every(a=>'混合' in a&&'槽' in a));
console.log('新版44复杂素材、静态染色、混合/槽与新增动作检查通过。');
