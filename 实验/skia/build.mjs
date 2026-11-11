import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, cache, skiaRevision } from '../../tools/setup/paths.mjs';
const target = process.argv[2] || (process.platform === 'darwin' ? 'mac-arm64' : 'linux-x64');
const plan = JSON.parse(await fs.readFile(path.join(root, '实验/skia/args-draft.json'), 'utf8'));
if (!plan.platforms[target]) throw new Error(`未知目标：${target}`);
const source = path.join(cache, 'skia', skiaRevision);
const copy = path.join(cache, 'skia-build-source', skiaRevision);
const bin = path.join(cache, 'build-tools');
const llvm = path.join(cache, 'emsdk/7.0.0/install/bin');
function run(command, args, cwd = copy) {
  const p = spawnSync(command, args, { cwd, stdio:'inherit', env:{...process.env, EM_CONFIG:path.join(cache,'emsdk/7.0.0/config.py'), EM_CACHE:path.join(cache,'emsdk/7.0.0/sysroot-cache'), PATH:`${llvm}:${bin}:${process.env.PATH}`} });
  if (p.error) throw p.error;
  if (p.status !== 0) throw new Error(`${command} 失败，退出码 ${p.status}`);
}
try { await fs.access(path.join(copy, 'BUILD.gn')); } catch {
  await fs.mkdir(path.dirname(copy), { recursive:true });
  run('git', ['worktree','add','--detach',copy,skiaRevision], source);
}
// 仅补丁化缓存构建副本，原始固定提交及仓库只读目录不改。
const buildFile = path.join(copy, 'BUILD.gn');
let build = await fs.readFile(buildFile,'utf8');
for (const fragment of ['    "SK_CODEC_DECODES_BMP",\n','    "SK_CODEC_DECODES_WBMP",\n','  sources += skia_codec_decode_bmp\n']) {
  const count = build.split(fragment).length - 1;
  if (count > 1) throw new Error('补丁匹配不唯一，停止构建');
  if (count === 1) build = build.replace(fragment,'');
}
await fs.writeFile(buildFile,build);
// 上游激活动作固定下载另一个 SDK；我们已显式安装并锁定 7.0.0，不允许隐式换版。
const toolchainFile = path.join(copy,'gn/toolchain/BUILD.gn');
let toolchain = await fs.readFile(toolchainFile,'utf8');
const activation = '      deps = [ "//gn/toolchain/emsdk:activate(//gn/toolchain:$host_toolchain)" ]';
if (toolchain.split(activation).length > 2) throw new Error('SDK激活补丁不唯一');
toolchain = toolchain.replace(activation, '      deps = []  # SDK由外层脚本固定安装和校验');
await fs.writeFile(toolchainFile,toolchain);

const args = {...plan.common, ...plan.platforms[target]};
for (const k of ['extra_cflags','extra_ldflags']) args[k] = [...plan.common[k], ...plan.platforms[target][k]];
args.extra_cflags = args.extra_cflags.map(s => s.replace('${CHROMIUM_CONFIG_HEADER}',path.join(root,'实验/skia/chromium-config.h')));
if (target === 'linux-x64') { args.cc=path.join(llvm,'clang'); args.cxx=path.join(llvm,'clang++'); args.ar=path.join(llvm,'llvm-ar'); }
if (target === 'wasm') {
  args.skia_emsdk_dir = path.join(cache,'emsdk/7.0.0');
  try { await fs.symlink('install',path.join(args.skia_emsdk_dir,'upstream')); } catch (e) { if(e.code !== 'EEXIST') throw e; }
  await fs.writeFile(path.join(args.skia_emsdk_dir,'config.py'),`LLVM_ROOT = ${JSON.stringify(llvm)}\nBINARYEN_ROOT = ${JSON.stringify(path.dirname(llvm))}\nNODE_JS = [${JSON.stringify(process.execPath)}]\n`);
}
const output = path.join(copy, 'out', `stage0-${target}`);
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'args.gn'),Object.entries(args).map(([k,v])=>`${k} = ${JSON.stringify(v)}`).join('\n')+'\n');
const start=Date.now();
run(path.join(bin,'gn'),['gen',output,'--export-compile-commands']);
const listed=spawnSync(path.join(bin,'gn'),['args',output,'--list'],{cwd:copy,encoding:'utf8'});
if (listed.status!==0) throw new Error(listed.stderr);
await fs.writeFile(path.join(output,'gn-args-list.txt'),listed.stdout);
if (process.argv.includes('--只生成')) process.exit(0);
run(path.join(bin,'ninja'),['-C',output,'-j',process.env.SVG_RENDER_JOBS || '4','skia']);
const lib=path.join(output,target==='wasm'?'libskia.wasm.a':'libskia.a');
const info={目标:target,Skia:skiaRevision,本次构建秒:(Date.now()-start)/1000,计时说明:'本次调用含增量复用，不代表首次完整构建时长',静态库字节:(await fs.stat(lib)).size,静态库:lib,说明:'这只是静态库构建记录，尚非动态库体积、实验5或Mac验收通过。'};
const report=path.join(root,'报告',process.platform === 'darwin'?'mac':'linux');
await fs.mkdir(report,{recursive:true});await fs.writeFile(path.join(report,`skia-${target}.json`),JSON.stringify(info,null,2)+'\n');
