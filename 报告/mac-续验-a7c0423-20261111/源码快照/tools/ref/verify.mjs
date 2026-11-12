// 数值容差仅放宽数值，不忽略单位、路径命令或值的类型。
export function equivalent(a,b,tolerance=.001){
 if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equivalent(v,b[i],tolerance));
 if(typeof a==='string'&&typeof b==='string'){
  if(a===b)return true;const re=/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;const aa=a.match(re)||[],bb=b.match(re)||[];
  return aa.length===bb.length&&a.replace(re,'#')===b.replace(re,'#')&&aa.every((v,i)=>Math.abs(Number(v)-Number(bb[i]))<=tolerance);
 }
 return a===b;
}
export function verifyValues(live,frozen){
 const key=value=>`${value.节点号}/${value.属性}/${value.来自??''}`;
 const full=value=>Object.hasOwn(value,'完整局部矩阵');
 const validMatrix=value=>Array.isArray(value)&&value.length===6&&value.every(Number.isFinite);
 const other=new Map(frozen.map(value=>[key(value),value])),errors=[];
 for(const a of live){
  const b=other.get(key(a));let matrixPass=true,matrixError;
  if(b&&(full(a)||full(b))){
   if(!full(a)||!full(b)){matrixPass=false;matrixError='一侧缺少完整局部矩阵';}
   else if(!validMatrix(a.完整局部矩阵)||!validMatrix(b.完整局部矩阵)){matrixPass=false;matrixError='完整局部矩阵不是六个有限数值';}
   else matrixPass=equivalent(a.完整局部矩阵,b.完整局部矩阵);
  }else if(b&&a.局部矩阵)matrixPass=equivalent(a.局部矩阵,b.局部矩阵);
  if(!b||!equivalent(a.值,b.值)||!matrixPass)errors.push({节点号:a.节点号,属性:a.属性,来自:a.来自,活值:a.值,冻结值:b?.值,活矩阵:a.局部矩阵,冻结矩阵:b?.局部矩阵,活完整矩阵:a.完整局部矩阵,冻结完整矩阵:b?.完整局部矩阵,...(matrixError?{原因:matrixError}:{})});
 }
 if(other.size!==live.length)errors.push({错误:'轨道数量不一致'});
 return {通过:errors.length===0,轨道数:live.length,容差:.001,错误:errors};
}
