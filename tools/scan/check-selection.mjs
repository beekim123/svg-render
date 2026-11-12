// 未完成扫描的公开候选不能登记；正式来源不能借此静默剔除。
import assert from 'node:assert/strict';
import {selectRegistered,assessRegistered} from './selection.mjs';
const asset={id:'path/incomplete',批:'公开测试集',动作:[{静态:true}]};
const scan={id:asset.id,状态:'待验证',分类:{'元素/path':'支持'},动作:[{明细:{SMIL:[]},特性计数:{},未完成:['路径缺少L坐标，无法可靠计数']}]};
const selected=selectRegistered([asset],[scan]);
assert.equal(selected.registered.length,0,'未完整扫描的候选仍被登记');
assert(selected.excluded[0].原因.some(r=>r.includes('扫描未完成')));
assert(selected.excluded[0].原因.some(r=>r.includes('路径缺少L坐标')));
const ordinary=selectRegistered([{...asset,批:'现有游戏'}],[scan]);
assert.equal(ordinary.registered.length,1,'不得静默排除正式来源');
assert.deepEqual(assessRegistered(ordinary.registered,[scan]).未完成,[asset.id]);
assert.equal(selectRegistered([asset],[{...scan,状态:'完成',动作:[{明细:{SMIL:[]},特性计数:{},未完成:[]}]}]).registered.length,1);
console.log('通过：公开候选须完整扫描才登记，详细排除理由保留；正式来源未完成继续列作验收缺项。');
