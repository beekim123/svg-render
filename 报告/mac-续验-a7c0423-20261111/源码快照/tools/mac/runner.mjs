// Mac 批处理执行器：实验5等关键步骤任何失败都停止；普通失败继续收集结果。
import {spawnSync} from 'node:child_process';

export function createRunner({cwd,env=process.env,log=async()=>{},onChange=async()=>{}}={}){
 const tasks=[];let halted=false,haltStep,haltReason;
 async function step(name,fn,{stopOnFailure=false}={}){
  if(halted){tasks.push({步骤:name,成功:false,状态:'停止后未运行',停止步骤:haltStep,原因:haltReason});await onChange();return false;}
  const row={步骤:name,成功:false,状态:'运行中',开始:new Date().toISOString()};
  tasks.push(row);await onChange();
  await log(`开始：${name}`);
  try{await fn();Object.assign(row,{成功:true,状态:'完成'});await log(`完成：${name}`);return true;}
  catch(e){
   const message=e?.message||String(e);
   Object.assign(row,{状态:'失败',原因:message});
   if(Number.isInteger(e?.exitCode)||e?.exitCode===null)row.退出码=e.exitCode;
   if(e?.signal)row.信号=e.signal;
   if(e?.spawnError)row.启动错误=e.spawnError;
   const rule9=e?.stopRule9||message.includes('STOP_RULE_9');
   if(rule9||stopOnFailure){halted=true;haltStep=name;haltReason=message;row.停止后续=true;row.停止类型=rule9?'需求第9节':'关键步骤未成功';}
   await log(`失败：${name}；${message}`);
   if(halted)await log(`停止后续工作：${name}；${row.停止类型}。`);
   return false;
  }finally{row.结束=new Date().toISOString();await onChange();}
 }
 async function command(name,args){
  const p=spawnSync(name,args,{cwd,env,encoding:'utf8',maxBuffer:64*1024*1024});
  await log((p.stdout||'')+(p.stderr||''));
  if(p.error||p.status!==0){
   const error=new Error(p.status===3?'STOP_RULE_9：命令报告需求第9节停止条件，停止后续工作，先询问用户；具体原因见本步骤日志。':p.error?.message||`${name} ${args.join(' ')} ${p.signal?`被信号 ${p.signal} 终止`:`退出码 ${p.status}`}`);
   Object.assign(error,{exitCode:p.status,signal:p.signal,spawnError:p.error?.code,stopRule9:p.status===3});throw error;
  }
 }
 return {tasks,step,command,get halted(){return halted;}};
}
