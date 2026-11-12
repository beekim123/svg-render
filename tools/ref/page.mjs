// 在页面中执行的时间线、动画取值和冻结逻辑。保留动画对象，避免结束后丢失轨道。
export function installTimeline({freezePolicy='value-only'}={}){
 if(!['value-only','preserve-layers'].includes(freezePolicy))throw new Error(`未知冻结策略：${freezePolicy}`);
 const svg=document.querySelector('svg');if(!svg)throw new Error('页面没有 SVG');
 const nodes=[svg,...svg.querySelectorAll('*')],kept=new Map();let now=0,previousClass=null;
 const fullMatrix=m=>m?[m.a,m.b,m.c,m.d,m.e,m.f]:null;
 const local=e=>{const self=e.getCTM?.(),parent=e.parentNode.getCTM?.();return self?(parent?parent.inverse().multiply(self):self):null;};
 const collect=()=>{for(const a of document.getAnimations()){if(!kept.has(a)){kept.set(a,now);a.pause();}}};
 const cssName=s=>s.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
 const cssTransform=e=>{
  const typed=e.computedStyleMap?.().get('transform');
  if(String(typed)==='none')return {值:'none',精度:{来源:'Typed OM none',精确矩阵:true}};
  let transform;
  try{if(typeof typed?.toMatrix!=='function')throw new Error('Typed OM没有可用的toMatrix');transform=typed.toMatrix();}
  catch(error){return {值:getComputedStyle(e).getPropertyValue('transform'),精度:{来源:'CSSOM回退',精确矩阵:false,原因:error.message,完整局部矩阵复核:true}};}
  // Chrome的纯2D函数列插值可能返回is2D=false的matrix3d容器；只按16项数值严格判平面。
  const planar=['m13','m14','m23','m24','m31','m32','m34','m43'].every(key=>transform[key]===0)&&transform.m33===1&&transform.m44===1;
  if(!planar)throw new Error(`CSS transform不是支持范围内的2D矩阵：${e.id||e.localName}`);
  const values=fullMatrix(transform);if(!values.every(Number.isFinite))throw new Error(`CSS transform矩阵含非有限数值：${e.id||e.localName}`);
  // Typed OM矩阵不包含transform-origin；保留原origin，不能写回已含枢轴的getCTM结果。
  return {值:`matrix(${values.join(', ')})`,精度:{来源:'CSS Typed OM',精确矩阵:true}};
 };
 const tracks=()=>{const out=new Map();const add=(e,p,source)=>{if(!e)return;const n=nodes.indexOf(e);out.set(`${n}/${p}/${source}`,{element:e,节点号:n,元素id:e.id,属性:p,来自:source});};
 for(const [a] of kept){for(const k of a.effect?.getKeyframes()||[])for(const p of Object.keys(k))if(!['offset','computedOffset','easing','composite'].includes(p))add(a.effect.target,cssName(p),'css');}
 for(const a of svg.querySelectorAll('animate,animateTransform,animateMotion,set')){const href=a.getAttribute('href')||a.getAttributeNS('http://www.w3.org/1999/xlink','href');const e=href?document.querySelector(href):a.parentNode;add(e,a.localName==='animateMotion'?'motion':a.getAttribute('attributeName'),'smil');}return [...out.values()];};
 const cssProperties=new Set(['d','fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','opacity','visibility','color','font-size','letter-spacing','stop-color','stop-opacity','flood-color','flood-opacity','transform']);
 // SVGLength/SVGAngle 只有纯数字才取 .value；带单位的（%、em、px…）保留原单位文本。
 // .value 会把百分比按视口换算，而 startOffset 等属性的百分比按路径长度算，换成数字就错了。
 const unitValue=x=>x.unitType===1?x.value:x.valueAsString;
 const isUnitValue=x=>x&&typeof x==='object'&&x.unitType!==undefined&&typeof x.valueAsString==='string';
 const attrValue=(e,p)=>{
 const pairs={stdDeviation:['stdDeviationX','stdDeviationY'],baseFrequency:['baseFrequencyX','baseFrequencyY'],radius:['radiusX','radiusY']};
 if(pairs[p])return pairs[p].map(k=>e[k].animVal);
 const v=p==='points'?e.animatedPoints:e[p]?.animVal;if(v===undefined)throw new Error(`不能读取动画属性 ${e.localName}.${p} 的 animVal`);
 if(typeof v==='number'||typeof v==='string'||typeof v==='boolean')return v;
 if(v.numberOfItems!==undefined){const items=Array.from({length:v.numberOfItems},(_,i)=>v.getItem(i));if(['transform','gradientTransform','patternTransform'].includes(p)){let m=new DOMMatrix();for(const item of items)m=m.multiply(item.matrix);return `matrix(${fullMatrix(m).join(' ')})`;}return items.map(x=>isUnitValue(x)?unitValue(x):x.value!==undefined?x.value:x.x!==undefined?[x.x,x.y]:x);}
 if(isUnitValue(v))return unitValue(v);if(v.value!==undefined)return v.value;if(v.width!==undefined)return [v.x,v.y,v.width,v.height];throw new Error(`未覆盖 animVal 类型：${p}`);
 };
 const read=(descriptors)=> (descriptors?descriptors.map(t=>({...t,element:svg.querySelector(`[data-svg-render-node="${t.节点号}"]`) || (svg.getAttribute('data-svg-render-node')===String(t.节点号)?svg:null)})):tracks()).map(t=>{const {element:e,...r}=t,p=t.属性;if(!e)throw new Error(`冻结复核找不到节点 ${t.节点号}`);const css=t.来自==='css'||(cssProperties.has(p)&&p!=='transform');if(css&&p==='transform'){const value=cssTransform(e);r.值=value.值;r.变换精度=value.精度;}else r.值=p==='motion'?`matrix(${fullMatrix(local(e)).join(' ')})`:css?getComputedStyle(e).getPropertyValue(p):attrValue(e,p);if(p==='transform'||p==='motion'){r.完整局部矩阵=fullMatrix(local(e));r.局部矩阵=r.完整局部矩阵?.map(value=>+value.toFixed(4))??null;}r.写回=css?'style':'attribute';return r;});
 window.__ref={seek(t){now=t;svg.pauseAnimations();svg.setCurrentTime(t/1000);collect();for(const [a,start] of kept)if(a.playState!=='idle')a.currentTime=t-start;void svg.getBoundingClientRect();},trigger(action){if(previousClass)svg.classList.remove(previousClass);previousClass=action.触发?.class||null;if(previousClass)svg.classList.add(previousClass);if(action.触发?.attr)svg.setAttribute(...action.触发.attr);void svg.getBoundingClientRect();collect();const selectors=action.smil;const animations=selectors?selectors.map(s=>{const e=svg.querySelector(s);if(!e)throw new Error(`找不到 SMIL：${s}`);return e;}):[...svg.querySelectorAll('[begin="indefinite"]')];for(const a of animations)a.beginElement();},read,hasAnimations(){if([...kept.keys()].some(a=>a.playState!=='idle'))return true;return [...svg.querySelectorAll('animate,animateTransform,animateMotion,set')].some(a=>{try{const start=a.getStartTime();if(!Number.isFinite(start)||start>now/1000)return false;const count=a.getAttribute('repeatCount');if(count==='indefinite')return true;let duration;try{duration=a.getSimpleDuration();}catch{return false;}return now/1000<start+duration*(Number(count)||1);}catch{return false;}});},freeze(){const values=read(),copy=svg.cloneNode(true),clones=[copy,...copy.querySelectorAll('*')],transforms=[];clones.forEach((e,n)=>e.setAttribute('data-svg-render-node',n));for(const t of values){const e=clones[t.节点号],p=t.属性==='motion'?'transform':t.属性,v=Array.isArray(t.值)?t.值.flat().join(' '):String(t.值);if(t.写回==='style'){if(p==='transform')transforms.push({e,v});else e.style.setProperty(p,v,'important');}else e.setAttribute(p,v);}for(const a of copy.querySelectorAll('animate,animateTransform,animateMotion,set'))a.remove();const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='*{animation:none!important;transition:none!important}';copy.append(style);
 // 只在冻结副本保留CSS动画目标的内容分层；不恢复动画，不改变原来的来源/值。
 const hintTargets=new Map();if(freezePolicy==='preserve-layers')for(const value of values)if(value.来自==='css'&&['transform','opacity'].includes(value.属性)){if(!hintTargets.has(value.节点号))hintTargets.set(value.节点号,new Set());hintTargets.get(value.节点号).add(value.属性);}
 const compositeHints=[];for(const [node,properties]of hintTargets){const original=getComputedStyle(nodes[node]).willChange,existing=original==='auto'?[]:original.split(',').map(value=>value.trim()).filter(Boolean),merged=[...new Set([...existing,...properties])].join(', '),element=clones[node];element.setAttribute('style',(element.getAttribute('style')||'')+`;will-change:${merged} !important;`);compositeHints.push({节点号:node,元素id:nodes[node].id,来自:'css',动画属性:[...properties],原提示:original,冻结提示:merged});}
 // style.setProperty会再次舍入matrix系数；所有提示完成后最后写原始transform属性文本。
 for(const {e,v}of transforms)e.setAttribute('style',(e.getAttribute('style')||'')+`;transform:${v} !important;`);
 return {svg:new XMLSerializer().serializeToString(copy),values,compositeHints,freezePolicy};},period(){let duration=0;for(const [a] of kept){if(a.playState==='idle')continue;const t=a.effect.getTiming();if(t.iterations===Infinity&&typeof t.duration==='number')duration=Math.max(duration,t.duration);}for(const a of svg.querySelectorAll('[repeatCount="indefinite"]')){try{if(a.getStartTime()>now/1000)continue;}catch{continue;}const d=a.getAttribute('dur')||'';if(/^\d*\.?\d+(ms|s)$/.test(d))duration=Math.max(duration,parseFloat(d)*(d.endsWith('ms')?1:1000));}return Math.min(duration,8000);},textBoxes(){return [...svg.querySelectorAll('text')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});}};
 window.__ref.seek(0);
}
