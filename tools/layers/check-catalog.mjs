import assert from 'node:assert/strict';
import {selectVariants, mergeVariants, migrateAssets} from './catalog.mjs';

const actions = [
  {素材: '新画法/card@AAAAAA', 动作: '待机'},
  {素材: '新画法/card@BBBBBB', 动作: '待机'},
  {素材: '新画法/card@BBBBBB', 动作: 'play'},
  {素材: '新画法/normal', 动作: '待机'},
];
const selected = selectVariants(actions, ['新画法/card']);
assert.equal(selected.get('新画法/card').variants.length, 2);
assert.equal(selected.get('新画法/card').variants[1].actions.length, 2);
const onlyBlue = selectVariants(actions, ['新画法/card@BBBBBB']);
assert.equal(onlyBlue.get('新画法/card').variants.length, 1);
const previous = {id: '新画法/card', source: '新画法/card@AAAAAA', name: 'card', actions: [{name: '待机', bundle: 'red/bundle.json'}]};
const current = mergeVariants(previous, '新画法/card', [{source: '新画法/card@BBBBBB', actions: [{name: 'play', bundle: 'blue/bundle.json'}]}], actions);
assert.equal(current.variants.length, 2);
assert.equal(current.source, '新画法/card@AAAAAA');
assert.equal(current.actions[0].bundle, 'red/bundle.json');
assert.equal(current.variants[1].actions[0].bundle, 'blue/bundle.json');
assert.equal(migrateAssets([{id: '新画法/normal', source: '新画法/normal', actions: []}])[0].variants.length, 1);
console.log('变体目录：base选中全部染色、单变体选中、追加保留其他染色、默认首变体及旧目录迁移通过');
