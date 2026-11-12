// 本函数只在固定版本 Chrome 页面内执行；所有输入来自 DOM、CSSOM 和计算样式。
export function scanPage(countPathSegments) {
 const root=document.querySelector('svg');if(!root)throw new Error('没有SVG根元素');
 const verifiedCSS=new Set();
 const validateCSS=p=>{const standard=p.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());if(!standard.startsWith('--')&&CSS.supports(standard,'initial'))verifiedCSS.add(p);};
 const counts={},tags={},details={渐变:[],遮罩:[],滤镜引用:[],文字:[],CSS动画:[],SMIL:[],其他命名空间:[],根混合模式:getComputedStyle(root).mixBlendMode},unknown=[];
 const hit=(key,n=1)=>counts[key]=(counts[key]||0)+n;
 let depth=0,segments=0,pathUnavailable=0;
 const urls=value=>[...value.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(m=>m[1]);
 const external=value=>value&&!value.startsWith('#')&&!value.startsWith('data:');
 const declaration=(style)=>{for(const p of style){const v=style.getPropertyValue(p);if(v.toLowerCase().includes('currentcolor'))hit('颜色/currentColor');if(p.startsWith('--'))hit('其他/CSS变量');if(v.includes('calc('))hit('其他/calc');for(const u of urls(v))if(external(u))hit('禁止/外部资源');if(p==='transform'&&/matrix3d|perspective|rotate[XYZ]|translateZ|translate3d|scale3d/.test(v))hit('禁止/3D变换');}};
 const rules=rs=>{for(const rule of rs){if(rule.type===CSSRule.MEDIA_RULE)hit('禁止/@media');if(rule.selectorText?.includes(':hover'))hit('禁止/:hover');if(rule.type===CSSRule.FONT_FACE_RULE){for(const u of urls(rule.style.getPropertyValue('src')))if(external(u))hit('禁止/外链字体');}if(rule.type===CSSRule.KEYFRAMES_RULE){hit('CSS/@keyframes');for(const k of rule.cssRules){for(const p of k.style){hit('CSS属性/'+p);validateCSS(p);}declaration(k.style);}}else if(rule.style)declaration(rule.style);if(rule.cssRules&&rule.type!==CSSRule.KEYFRAMES_RULE)rules(rule.cssRules);}};
 for(const sheet of document.styleSheets){try{rules(sheet.cssRules);}catch{hit('禁止/外部资源');}}
 for(const el of [root,...root.querySelectorAll('*')]){
  const tag=el.localName;let d=0;for(let p=el;p&&p!==root;p=p.parentElement)d++;depth=Math.max(depth,d);
  // 同名XML元素不一定是SVG；保留namespace未知，不访问通用Element不存在的SVG/style接口。
  if(el.namespaceURI!=='http://www.w3.org/2000/svg'){
   const key=(el.namespaceURI||'(无命名空间)')+'/'+tag;
   tags[key]=(tags[key]||0)+1;hit('元素命名空间/'+key);
   details.其他命名空间.push({id:el.id,元素:tag,前缀:el.prefix,命名空间:el.namespaceURI});continue;
  }
  const cs=getComputedStyle(el);tags[tag]=(tags[tag]||0)+1;hit('元素/'+tag);
  declaration(el.style);
  for(const p of ['fill-rule','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','viewBox','preserveAspectRatio','x','y','dx','dy','rotate'])if(el.hasAttribute(p))hit('属性/'+p);
  for(const attr of el.attributes){if(attr.value.toLowerCase().includes('currentcolor'))hit('颜色/currentColor');if(attr.name.startsWith('on'))hit('禁止/脚本');if(['href','xlink:href','src'].includes(attr.name)&&external(attr.value))hit('禁止/外部资源');}
  if(['script','foreignObject','image'].includes(tag))hit('禁止/'+tag);
  if(tag==='path'){
   // 优先使用浏览器路径解析 API；缺失时明确报告，不用文本正则冒充段数。
   if(typeof el.getPathData==='function')segments+=el.getPathData().length;
   else {try{segments+=countPathSegments(el.getAttribute('d')||'');}catch(e){pathUnavailable++;unknown.push(`路径${el.id||'(无id)'}：${e.message}`);}}
  }
  for(const p of ['fill','stroke']){const value=cs.getPropertyValue(p);if(value!=='none'&&!value.includes('url('))hit('颜色/纯色');}
  if(['linearGradient','radialGradient'].includes(tag)){const info={id:el.id,类型:tag,spreadMethod:el.getAttribute('spreadMethod')||'pad',gradientTransform:el.getAttribute('gradientTransform'),href:el.getAttribute('href')||el.getAttribute('xlink:href'),焦点偏移:tag==='radialGradient'&&(el.hasAttribute('fx')||el.hasAttribute('fy'))};details.渐变.push(info);hit('渐变/spreadMethod/'+info.spreadMethod);if(info.gradientTransform)hit('渐变/gradientTransform');if(info.href)hit('渐变/href');if(info.焦点偏移)hit('渐变/焦点偏移');}
  if(el.hasAttribute('patternTransform'))hit('颜色/patternTransform');
  if(cs.strokeDasharray!=='none')hit('描边/虚线');if(cs.vectorEffect!=='none')hit('描边/vector-effect/'+cs.vectorEffect);if(cs.paintOrder!=='normal')hit('描边/paint-order');
  for(const p of ['marker-start','marker-mid','marker-end'])if(cs.getPropertyValue(p)!=='none')hit('描边/marker');
  if(cs.clipPath!=='none'){const kind=cs.clipPath.split('(')[0];hit('裁剪/'+kind);if(el.closest('clipPath'))hit('裁剪/嵌套');}
  if(tag==='mask'){hit('遮罩/'+cs.maskType);details.遮罩.push({id:el.id,类型:cs.maskType});}
  if(cs.mixBlendMode!=='normal')hit('混合/'+cs.mixBlendMode);if(cs.isolation!=='auto')hit('混合/isolation');if(cs.backdropFilter!=='none')hit('禁止/backdrop-filter');
  if(cs.filter!=='none'){details.滤镜引用.push({id:el.id,值:cs.filter});hit('滤镜/引用');if(!cs.filter.startsWith('url('))hit('滤镜/CSS函数');}
  if(tag==='filter'||tag.startsWith('fe'))hit('滤镜色彩空间/'+cs.colorInterpolationFilters);
  if(['text','tspan','textPath'].includes(tag)){details.文字.push({id:el.id,字体族:cs.fontFamily,字号:parseFloat(cs.fontSize),字间距:cs.letterSpacing,字重:cs.fontWeight,对齐:cs.textAnchor});hit('文字/字间距');hit(cs.fontFamily.split(',')[0].replaceAll('"','').replaceAll("'",'').trim()==='Noto Sans CJK SC'?'文字/登记字体':'禁止/系统字体');}
  if(cs.transitionDuration.split(',').some(v=>parseFloat(v)!==0))hit('禁止/transition');if(cs.transform.startsWith('matrix3d(')||cs.perspective!=='none')hit('禁止/3D变换');if(cs.transform!=='none')hit('变换/2D');
  if(el.hasAttribute('transform-box')||el.style.transformBox)hit('变换/transform-box');if(el.hasAttribute('transform-origin')||el.style.transformOrigin)hit('变换/transform-origin');
  if(['animate','animateTransform','animateMotion','set'].includes(tag)){
   const info={id:el.id,类型:tag,属性:el.getAttribute('attributeName')||(tag==='animateMotion'?'motion':null),calcMode:el.getAttribute('calcMode')||(tag==='animateMotion'?'paced':'linear'),begin:el.getAttribute('begin')||'0s',additive:el.getAttribute('additive')||'replace',accumulate:el.getAttribute('accumulate')||'none'};details.SMIL.push(info);hit('SMIL/calcMode/'+info.calcMode);hit('SMIL/additive/'+info.additive);hit('SMIL/accumulate/'+info.accumulate);
   for(const b of info.begin.split(';').map(s=>s.trim()))hit(b==='indefinite'?'SMIL/begin/indefinite':/^[+-]?(\d+(\.\d+)?(ms|s|min|h)?|\d+:\d+(:\d+(\.\d+)?)?)$/.test(b)?'SMIL/begin/时间':/^[\w-]+\.(begin|end|repeat\(\d+\))([+-].+)?$/.test(b)?'SMIL/begin/跟随':'禁止/SMIL事件触发');
   for(const p of ['min','max','restart'])if(el.hasAttribute(p))hit('SMIL/'+p);
  }
 }
 for(const a of document.getAnimations()){
  const timing=a.effect.getTiming();const props=[...new Set(a.effect.getKeyframes().flatMap(k=>Object.keys(k).filter(p=>!['offset','computedOffset','easing','composite'].includes(p))))];const easing=[timing.easing,...a.effect.getKeyframes().map(k=>k.easing)];for(const p of props){hit('CSS属性/'+p);validateCSS(p);}for(const e of new Set(easing))hit('CSS缓动/'+e.split('(')[0]);if(timing.delay<0)hit('CSS/负延迟');details.CSS动画.push({属性:props,缓动:easing,延迟:timing.delay,周期:timing.duration,次数:Number.isFinite(timing.iterations)?timing.iterations:'无限',方向:timing.direction,填充:timing.fill});
 }
 if(pathUnavailable)unknown.push(`${pathUnavailable}条路径无法可靠解析，段数待验证`);
 return {已验证CSS属性:[...verifiedCSS],特性计数:counts,元素:tags,路径段数:pathUnavailable?null:segments,嵌套深度:depth,明细:details,未完成:unknown};
}
