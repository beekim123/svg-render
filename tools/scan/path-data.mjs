// 只解析Chrome DOM给出的d属性，不扫描SVG源码。无效或截断路径必须报错，不能猜段数。
export function countPathSegments(data){
 const arity={M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2,A:7,Z:0};
 let i=0,count=0,command=null,first=true;
 const ws=()=>{while(i<data.length&&[' ','\t','\n','\r','\f'].includes(data[i]))i++;};
 const fail=()=>{throw new Error(`路径数据在字符${i}处无效`);};
 ws();if(i===data.length)return 0;
 while(i<data.length){
  ws();if(i===data.length)break;
  if(Object.hasOwn(arity,data[i].toUpperCase())){
   command=data[i++];if(first&&command.toUpperCase()!=='M')fail();
   if(command.toUpperCase()==='Z'){count++;command=null;first=false;continue;}
  }else if(!command)fail();
  const upper=command.toUpperCase(),n=arity[upper];
  for(let k=0;k<n;k++){
   ws();if(data[i]===','){
    // 显式命令后不能先跟逗号；后续组或参数之间允许一个逗号。
    if(k===0)fail();i++;ws();
   }
   if(i>=data.length)fail();
   if(upper==='A'&&(k===3||k===4)){
    if(data[i]!=='0'&&data[i]!=='1')fail();i++;
   }else{
    const m=data.slice(i).match(/^[+-]?(?:(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)/);
    if(!m||!Number.isFinite(Number(m[0])))fail();
    if(upper==='A'&&(k===0||k===1)&&Number(m[0])<0)fail();i+=m[0].length;
   }
  }
  count++;first=false;
  // moveto后多余坐标按lineto逐段计算。
  if(upper==='M')command=command==='M'?'L':'l';
  ws();if(data[i]===','){
   i++;ws();if(i>=data.length||Object.hasOwn(arity,data[i].toUpperCase()))fail();
  }
 }
 return count;
}
