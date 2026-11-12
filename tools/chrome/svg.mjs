// 所有SVG均由同一Chrome按XML解析原始文本，再内嵌到原有HTML/字体/CSS上下文。
export async function setSvgContent(page,svg,htmlFactory,source='SVG输入'){
 if(typeof svg!=='string')throw new TypeError(`SVG加载执行失败（来源：${source}）：SVG输入必须是字符串`);
 let result;
 try{
  await page.setHtml(htmlFactory(''));
  result=await page.evaluate(`(()=>{
   const xml=new DOMParser().parseFromString(${JSON.stringify(svg)},'image/svg+xml');
   const root=xml.documentElement;
   if(!(root instanceof SVGSVGElement)||root.localName!=='svg'||root.namespaceURI!=='http://www.w3.org/2000/svg'){
    // 固定Chrome的XML错误文档为XHTML html/body/parsererror。有效SVG中的同名元素不参与此判断。
    const parseError=root?.localName==='html'&&root.namespaceURI==='http://www.w3.org/1999/xhtml'?root.getElementsByTagNameNS('http://www.w3.org/1999/xhtml','parsererror')[0]:null;
    return parseError?{ok:false,kind:'XML_PARSE_ERROR',reason:'XML解析失败',details:parseError.textContent.trim()}:{ok:false,kind:'SVG_ROOT_INVALID',reason:'XML根不是SVG命名空间中的svg元素',details:'根名称='+String(root?.localName)+'；命名空间='+String(root?.namespaceURI)};
   }
   const imported=document.importNode(root,true);document.body.appendChild(imported);
   if(document.body.firstElementChild!==imported)throw new Error('HTML模板未将SVG置于body顶层');
   return {ok:true};
  })()`);
 }catch(cause){throw new Error(`SVG加载执行失败（来源：${source}）：${cause.message}`,{cause});}
 // 只有上述明确XML验证分支能赋输入错误码；协议、模板、DOM导入异常不能冒充输入无效。
 if(result?.ok===false&&['XML_PARSE_ERROR','SVG_ROOT_INVALID'].includes(result.kind)){
  const error=new Error(`SVG加载失败（来源：${source}）：${result.reason}；${result.details}`);
  Object.assign(error,{code:'SVG_INPUT_INVALID',source,kind:result.kind,details:result.details,inputError:{code:'SVG_INPUT_INVALID',source,kind:result.kind,reason:result.reason,details:result.details,message:error.message}});throw error;
 }
 if(result?.ok!==true)throw new Error(`SVG加载执行失败（来源：${source}）：XML加载器返回了未知结果`);
 return {模式:'XML子树内嵌HTML',XML验证:true};
}
