// DOM替身仅验证systemLanguage检测、命名空间边界及已授权分类；不冒充真实Chrome验证。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {scanPage} from './page.mjs';
import {classify} from './cli.mjs';
import {selectRegistered} from './selection.mjs';
const scope=JSON.parse(await fs.readFile(new URL('../../支持范围.json',import.meta.url),'utf8'));
function element(tag,attrs={},namespace='http://www.w3.org/2000/svg'){
 return {id:'',localName:tag,namespaceURI:namespace,prefix:null,parentElement:null,style:[],attributes:Object.entries(attrs).map(([name,value])=>({name,value})),hasAttribute:name=>Object.hasOwn(attrs,name),getAttribute:name=>attrs[name]??null,closest:()=>null,querySelectorAll:()=>[]};
}
function scan(root,children=[]){
 root.querySelectorAll=()=>children;for(const child of children)child.parentElement=root;
 const style={mixBlendMode:'normal',strokeDasharray:'none',vectorEffect:'none',paintOrder:'normal',clipPath:'none',isolation:'auto',backdropFilter:'none',filter:'none',transitionDuration:'0s',transform:'none',perspective:'none',getPropertyValue:()=> 'none'};
 return vm.runInNewContext(`(${scanPage.toString()})(()=>0)`,{document:{querySelector:()=>root,styleSheets:[],getAnimations:()=>[]},getComputedStyle:()=>style,CSS:{supports:()=>false},CSSRule:{}});
}
const snapshot=scan(element('svg',{systemLanguage:'en'}),[element('rect'),element('g',{systemLanguage:'zh'}),element('g',{systemLanguage:'fr'},'urn:foreign')]);
assert.equal(snapshot.特性计数['属性/systemLanguage'],2,'应计入SVG根与SVG子元素，不计其他namespace的同名属性');
assert.equal(classify('属性/systemLanguage',scope),'不支持','用户已选择的systemLanguage必须明确登记为不支持');
const foreignOnly=scan(element('svg'),[element('rect',{systemLanguage:'fr'},'urn:foreign')]);assert.equal(foreignOnly.特性计数['属性/systemLanguage'],undefined);
const publicAsset={id:'language',批:'公开测试集',动作:[{静态:true}]};
const result={id:publicAsset.id,状态:'完成',分类:Object.fromEntries(Object.keys(snapshot.特性计数).map(key=>[key,classify(key,scope)])),动作:[snapshot]};
const rejected=selectRegistered([publicAsset],[result]);assert.equal(rejected.registered.length,0);assert(rejected.excluded[0].原因.includes('属性/systemLanguage：不支持'));
const plain=scan(element('svg'),[element('rect')]);
const plainResult={...result,分类:Object.fromEntries(Object.keys(plain.特性计数).map(key=>[key,classify(key,scope)])),动作:[plain]};assert.equal(selectRegistered([publicAsset],[plainResult]).registered.length,1,'无该属性的普通支持SVG不应受影响');
console.log('通过：SVG根/子元素systemLanguage明确不支持并排除公开样例；其他namespace不误计，无该属性的普通SVG仍可登记。仅纯测试，真实Chrome留给主代理。');
