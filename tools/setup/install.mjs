import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {cache,chromeVersion,skiaRevision,emscriptenRevision} from './paths.mjs';
export const resvgRevision='500d8605a28ac092c1b146c06ec65c0e70e99ec4';
function run(command,args,cwd=cache){const r=spawnSync(command,args,{cwd,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${command} 失败：${r.status}`);}
async function exists(p){try{await fs.access(p);return true;}catch{return false;}}
async function download(url,file){await fs.mkdir(path.dirname(file),{recursive:true});if(await exists(file))return;run('curl',['--fail','--location','--retry','2','--continue-at','-','--output',file+'.part',url]);await fs.rename(file+'.part',file);}
async function checkout(url,revision,dest){if(await exists(path.join(dest,'.git'))){const r=spawnSync('git',['rev-parse','HEAD'],{cwd:dest,encoding:'utf8'});if(r.status===0&&r.stdout.trim()===revision)return;}await fs.mkdir(dest,{recursive:true});if(!await exists(path.join(dest,'.git'))){run('git',['init'],dest);run('git',['remote','add','origin',url],dest);}run('git',['fetch','--depth','1','origin',revision],dest);run('git',['checkout','--detach','FETCH_HEAD'],dest);}
export async function install({wasm=false,tests=true}={}){
 if(!['linux','darwin'].includes(process.platform))throw new Error('阶段0仅支持Linux和Mac安装');
 if(process.platform==='linux'&&process.arch!=='x64')throw new Error('Linux开发机须为x86_64');
 if(process.platform==='darwin'&&process.arch!=='arm64')throw new Error('Mac入口须在Apple Silicon原生Node中运行');
 await fs.mkdir(cache,{recursive:true});
 const platform=process.platform==='darwin'?'mac-arm64':'linux64';
 const chromeFolder=platform==='linux64'?'chrome-linux64':'chrome-mac-arm64';
 const chromeDir=path.join(cache,'chrome',chromeVersion);
 const executable=platform==='linux64'?path.join(chromeDir,chromeFolder,'chrome'):path.join(chromeDir,chromeFolder,'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
 if(!await exists(executable)){const archive=path.join(cache,'downloads',`${chromeFolder}.zip`);await download(`https://storage.googleapis.com/chrome-for-testing-public/${chromeVersion}/${platform}/${chromeFolder}.zip`,archive);await fs.mkdir(chromeDir,{recursive:true});run('unzip',['-q','-o',archive,'-d',chromeDir]);}
 const host=process.platform==='darwin'?'mac-arm64':'linux-amd64';
 const bin=path.join(cache,'build-tools');await fs.mkdir(bin,{recursive:true});
 for(const [tool,pkg,version] of [['gn','gn/gn','git_revision:b2afae122eeb6ce09c52d63f67dc53fc517dbdc8'],['ninja','infra/3pp/tools/ninja','version:2@1.12.1.chromium.4']]){
  if(!await exists(path.join(bin,tool))){const archive=path.join(cache,'downloads',`${tool}-${host}.zip`);await download(`https://chrome-infra-packages.appspot.com/dl/${pkg}/${host}/+/${version}`,archive);run('unzip',['-j','-o',archive,tool,'-d',bin]);await fs.chmod(path.join(bin,tool),0o755);}
 }
 await checkout('https://skia.googlesource.com/skia.git',skiaRevision,path.join(cache,'skia',skiaRevision));
 if(tests)await checkout('https://github.com/linebender/resvg.git',resvgRevision,path.join(cache,'tests/resvg',resvgRevision));
 if(wasm||process.platform==='linux'){
  if(process.platform!=='linux')throw new Error('WASM阶段0在Linux构建；Mac不自动下载未列出的SDK');
  const dest=path.join(cache,'emsdk/7.0.0');
  if(!await exists(path.join(dest,'install/emscripten/emcc'))){const archive=path.join(cache,'downloads','emscripten-7.0.0-linux.tar.xz');await download(`https://storage.googleapis.com/webassembly/emscripten-releases-builds/linux/${emscriptenRevision}/wasm-binaries.tar.xz`,archive);await fs.mkdir(dest,{recursive:true});run('tar',['-xf',archive,'-C',dest]);}
 }
 return {cache,executable};
}
if(process.argv[1]===new URL(import.meta.url).pathname){await install({wasm:process.argv.includes('--wasm'),tests:!process.argv.includes('--不下载测试集')});}
