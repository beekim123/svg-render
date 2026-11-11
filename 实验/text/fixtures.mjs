// 每个字号、字重单独覆盖全部情形，便于定位最差的一例。
export function fixtures() {
 const cases=[];
 for(const weight of [400,700]) for(const size of [14,24,48]) for(const kind of ['plain','spacing','tspan','circle','stroke','rotate']) {
  const id=`${weight}-${size}-${kind}`;
  const content=kind==='tspan'?'<tspan>中文</tspan><tspan dx="7" dy="5">123</tspan><tspan dx="-2" dy="-3">数字</tspan>':kind==='circle'?'<textPath href="#circle" startOffset="12">中文 123 数字</textPath>':'中文 123 数字';
  const extra=kind==='spacing'?'letter-spacing="3.25"':kind==='stroke'?'stroke="#eb783f" stroke-width="2.5" paint-order="stroke fill"':kind==='rotate'?'transform="rotate(15 40 100)"':'';
  cases.push({id,weight,size,kind,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320"><defs><path id="circle" d="M 90 180 A 110 110 0 1 1 310 180 A 110 110 0 1 1 90 180"/></defs><text id="sample" ${kind==='circle'?'':'x="40" y="100"'} font-family="Noto Sans CJK SC" font-weight="${weight}" font-size="${size}" fill="#264e75" ${extra}>${content}</text></svg>`});
 }
 return cases;
}
