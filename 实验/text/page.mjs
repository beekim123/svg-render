// 只在 Chrome 页面内运行。字符定位已包含 tspan 的 dx/dy、textPath 的弧线与旋转；不能再叠一次。
export function readCharacters() {
 const rect=r=>({x:r.x,y:r.y,width:r.width,height:r.height});
 const props=['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','paint-order','vector-effect','visibility'];
 return [...document.querySelectorAll('svg text')].map((text,ti)=>{
  const walker=document.createTreeWalker(text,NodeFilter.SHOW_TEXT),nodes=[];let n;
  while((n=walker.nextNode()))for(const ch of n.textContent)nodes.push({ch,owner:n.parentElement});
  if(nodes.length!==text.getNumberOfChars())throw new Error('字符索引不一致：不猜测折叠空白、代理对或连字映射');
  return {index:ti,id:text.id,box:rect(text.getBoundingClientRect()),characters:nodes.map(({ch,owner},i)=>{
   const css=getComputedStyle(owner),p=text.getStartPositionOfChar(i);
   if(css.writingMode!=='horizontal-tb')throw new Error('本实验只支持横排');
   return {index:i,char:ch,x:p.x,y:p.y,rotation:text.getRotationOfChar(i),extent:rect(text.getExtentOfChar(i)),size:parseFloat(css.fontSize),weight:Number(css.fontWeight),style:Object.fromEntries(props.map(k=>[k,css.getPropertyValue(k)]))};
  })};
 });
}
export function replaceWithPaths(records) {
 const ns='http://www.w3.org/2000/svg',texts=[...document.querySelectorAll('svg text')],geometry=[];
 for(const record of records){
  const text=texts[record.index],group=document.createElementNS(ns,'g');
  // text 的自身变换只留在替换组上；字形坐标仍在 text 的本地坐标空间。
  for(const attr of ['id','transform','opacity','clip-path','mask','filter','display'])if(text.hasAttribute(attr))group.setAttribute(attr,text.getAttribute(attr));
  for(const c of record.characters){
   const p=document.createElementNS(ns,'path');p.setAttribute('d',c.path);p.setAttribute('transform',`translate(${c.x} ${c.y}) rotate(${c.rotation}) scale(${c.scale} ${-c.scale})`);
   for(const [key,value]of Object.entries(c.style))p.style.setProperty(key,value);
   // 轮廓单位是字体单位。描边宽度和虚线在此局部坐标中必须除以字号比例。
   for(const key of ['stroke-width','stroke-dashoffset']){const value=parseFloat(c.style[key]);if(Number.isFinite(value))p.style.setProperty(key,String(value/c.scale));}
   if(c.style['stroke-dasharray']!=='none')p.style.setProperty('stroke-dasharray',c.style['stroke-dasharray'].split(/[ ,]+/).map(v=>parseFloat(v)/c.scale).join(' '));
   const wrapper=document.createElementNS(ns,'g');wrapper.appendChild(p);group.appendChild(wrapper);c.element=wrapper;
  }
  text.replaceWith(group);
  for(const c of record.characters){
   // 父组 getBBox 让 Chrome 对旋转后的实际曲线求紧包围盒，不能旋转未转时的矩形代替。
   const b=c.element.getBBox(),box={x:b.x,y:b.y,width:b.width,height:b.height},x=b.x,y=b.y;
   geometry.push({text:record.id,index:c.index,char:c.char,empty:c.path.length===0,chrome:c.extent,outline:box,positionDelta:c.path.length?Math.max(Math.abs(x-c.extent.x),Math.abs(y-c.extent.y)):null,edgeDelta:c.path.length?Math.max(Math.abs(x-c.extent.x),Math.abs(y-c.extent.y),Math.abs(x+box.width-c.extent.x-c.extent.width),Math.abs(y+box.height-c.extent.y-c.extent.height)):null});
  }
 }
 return {svg:new XMLSerializer().serializeToString(document.querySelector('svg')),geometry};
}
