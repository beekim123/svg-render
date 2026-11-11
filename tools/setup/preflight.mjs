import {spawnSync} from 'node:child_process';
export function preflight({mac=false}={}){
 const checks=[];
 const add=(name,ok,fix)=>checks.push({检查:name,通过:ok,修复:ok?null:fix});
 add('Node >=22',Number(process.versions.node.split('.')[0])>=22,'安装 Node 22 或以上，再重跑 npm run mac。');
 for(const cmd of ['git','curl','unzip','python3']){const r=spawnSync(cmd,[cmd==='unzip'?'-v':'--version'],{encoding:'utf8'});add(cmd,!r.error&&r.status===0,`先安装 ${cmd}。`);}
 const pv=spawnSync('python3',['-c','import sys; print(sys.version); raise SystemExit(0 if sys.version_info >= (3,10) else 1)'],{encoding:'utf8'});add('Python >=3.10',pv.status===0,'建议安装Python3.12后，用python3.12创建虚拟环境。');
 const py=spawnSync('python3',['-c','import numpy; import PIL'],{encoding:'utf8'});add('Python numpy/Pillow',!py.error&&py.status===0,'python3.12 -m venv .venv && .venv/bin/python -m pip install numpy==2.2.4 Pillow==11.1.0（需先安装Python3.12）；然后 PATH="$PWD/.venv/bin:$PATH" npm run mac');
 if(mac){add('Mac Apple Silicon',process.platform==='darwin'&&process.arch==='arm64','在用户的M3 Mac上，使用arm64版Node运行。');const r=spawnSync('xcrun',['--find','clang++'],{encoding:'utf8'});add('Xcode命令行工具',r.status===0,'xcode-select --install');}
 return {通过:checks.every(x=>x.通过),检查:checks};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const result=preflight({mac:process.argv.includes('--mac')});console.log(JSON.stringify(result,null,2));process.exitCode=result.通过?0:1;}
