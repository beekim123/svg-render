// 校准凭据只放行技术核对过的确切源码、配置、平台及24份真实Chrome指令。
import {createHash} from 'node:crypto';
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const fingerprintOplog=layers=>digest(JSON.stringify(layers.map(({width,height,commands})=>({width,height,commands}))));
export function verifyCalibration({proof,files,oplogs,platform=process.platform,arch=process.arch}){
 const reasons=[];
 if(!proof||proof.状态!=='已核对')reasons.push('缺少已完成技术核对的校准凭据');
 if(proof?.平台!==platform||proof?.架构!==arch)reasons.push('校准平台或架构不匹配');
 for(const [label,actual,expected]of [['文件',files,proof?.文件SHA256],['指令',oplogs,proof?.指令SHA256]]){
  const keys=Object.keys(actual||{}),known=Object.keys(expected||{});
  if(!keys.length||JSON.stringify(keys.sort())!==JSON.stringify(known.sort()))reasons.push(`${label}清单不匹配`);
  for(const key of keys)if(actual[key]!==expected?.[key])reasons.push(`${label}指纹不匹配：${key}`);
 }
 if(Object.keys(oplogs||{}).length!==24)reasons.push('必须具有8场景三倍率的24份指令');
 return {通过:reasons.length===0,原因:reasons};
}
