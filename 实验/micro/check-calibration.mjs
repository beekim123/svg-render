// 校准必须绑定当前文件、平台和全部24份真实指令，凭据过期不能自动放行。
import assert from 'node:assert/strict';
import {verifyCalibration} from './calibration.mjs';
const files={'draw.cpp':'source-v1','配置':'config-v1'};
const oplogs=Object.fromEntries(Array.from({length:24},(_,i)=>['frame-'+i,'log-'+i]));
const proof={状态:'已核对',平台:'darwin',架构:'arm64',文件SHA256:{...files},指令SHA256:{...oplogs}};
const check=(overrides={})=>verifyCalibration({proof,files,oplogs,platform:'darwin',arch:'arm64',...overrides});
assert.equal(check().通过,true);
assert.equal(check({proof:null}).通过,false,'无校准凭据不应通过');
assert.equal(check({files:{...files,'draw.cpp':'source-v2'}}).通过,false,'C++修改必须使凭据失效');
assert.equal(check({files:{...files,'配置':'config-v2'}}).通过,false,'配置变化必须使凭据失效');
assert.equal(check({oplogs:{...oplogs,'frame-0':'new-operation'}}).通过,false,'真实指令变化必须使凭据失效');
const missing={...oplogs};delete missing['frame-23'];
assert.equal(check({oplogs:missing}).通过,false,'少一帧不能通过');
assert.equal(check({platform:'linux'}).通过,false,'Mac校准不能套用到Linux');
assert.equal(check({proof:{...proof,状态:'待核对'}}).通过,false);
console.log('通过：校准凭据的缺失、源码/配置/指令变化、缺帧和平台错配均拒绝放行。');
