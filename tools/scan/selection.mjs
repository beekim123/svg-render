// 筛选与验收分开：公开集中的不支持候选被正常排除，不污染已登记集合的验收。
export function selectRegistered(assets,results){
 const byId=new Map(results.map(r=>[r.id,r]));
 const registered=[],excluded=[];
 for(const asset of assets){
  if(asset.批!=='公开测试集'){registered.push(asset);continue;}
  const r=byId.get(asset.id),reasons=[];
  if(!r)reasons.push('缺少Chrome扫描结果');
  else{
   if(!asset.动作.every(a=>a.静态)||!r.动作.every(a=>a.明细.SMIL.length===0&&!a.特性计数['CSS/@keyframes']))reasons.push('不是静态图');
   for(const [key,status] of Object.entries(r.分类))if(status!=='支持')reasons.push(`${key}：${status}`);
  }
  if(reasons.length)excluded.push({id:asset.id,原因:reasons});else registered.push(asset);
 }
 return {registered,excluded};
}
export function assessRegistered(registered,results){
 const byId=new Map(results.map(r=>[r.id,r]));
 const incomplete=[],unknown=[],unsupported=[];
 for(const asset of registered){
  const r=byId.get(asset.id);
  if(!r||r.状态!=='完成')incomplete.push(asset.id);
  for(const [feature,status] of Object.entries(r?.分类||{})){
   if(status==='没登记')unknown.push({id:asset.id,特性:feature,原因:'支持范围中没有登记，须人工决定，不自动扩范围'});
   if(status==='不支持')unsupported.push({id:asset.id,特性:feature,原因:'已按支持范围分类为不支持；扫描完成不代表素材可被渲染器接受'});
  }
 }
 return {状态:incomplete.length||unknown.length?'待验证':'完成',未完成:incomplete,待人工决定:unknown,不支持:unsupported};
}
