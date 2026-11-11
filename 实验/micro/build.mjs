import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { root, cache, skiaRevision } from '../../tools/setup/paths.mjs';

// 调用方与实验 4 共用固定提交、头文件、编译器及实际编译出的静态库。
export async function buildMicro(output, target = process.platform === 'darwin' ? `mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}` : 'linux-x64') {
  const source = path.join(cache, 'skia', skiaRevision);
  const built = path.join(cache, 'skia-build-source', skiaRevision, 'out', `stage0-${target}`);
  const library = path.join(built, 'libskia.a');
  const compiler = process.platform === 'darwin' ? 'clang++' : path.join(cache, 'emsdk/7.0.0/install/bin/clang++');
  const header = path.join(root, '实验/skia/chromium-config.h');
  const gnArgs = await fs.readFile(path.join(built, 'args.gn'), 'utf8');
  if (!gnArgs.includes(header) || !gnArgs.includes('SK_USER_CONFIG_HEADER')) throw new Error('实验 4 的编译设置未引用同一 Chromium 配置头，拒绝链接');
  await fs.access(library); await fs.mkdir(output, { recursive: true });
  const binary = path.join(output, 'micro');
  // Emscripten 包只给通用 lld，按 argv[0] 选择 GNU 驱动。链接只建在生成目录。
  const linker=path.join(output,'ld.lld');
  if(process.platform!=='darwin'){
    const expected=path.join(cache,'emsdk/7.0.0/install/bin/lld');
    try{await fs.symlink(expected,linker);}catch(e){if(e.code!=='EEXIST'||await fs.readlink(linker)!==expected)throw e;}
  }
  const args = ['-std=c++20','-DNDEBUG','-O3','-ffp-contract=off','-flto=thin','-I'+source,`-DSK_USER_CONFIG_HEADER="${header}"`,path.join(root,'实验/micro/draw.cpp'),library,path.join(built,'libskcms.a'),'-o',binary];
  if (process.platform === 'darwin') args.push('-arch', target.endsWith('arm64') ? 'arm64' : 'x86_64', '-Wl,-dead_strip');
  else args.push('-fuse-ld='+linker,'-pthread','-ldl','-Wl,--gc-sections');
  const fingerprint=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
  const fingerprints=Object.fromEntries(await Promise.all([library,path.join(built,'libskcms.a'),header,path.join(root,'实验/micro/draw.cpp')].map(async file=>[file,await fingerprint(file)])));
  const started = Date.now();
  const result = spawnSync(compiler,args,{encoding:'utf8',maxBuffer:16*1024*1024});
  const log = {文件指纹:fingerprints,编译器:compiler,参数:args,Skia提交:skiaRevision,静态库:library,编译设置:gnArgs,耗时毫秒:Date.now()-started,退出码:result.status,标准输出:result.stdout,标准错误:result.stderr,错误:result.error?.message};
  await fs.writeFile(path.join(output,'build.json'),JSON.stringify(log,null,2));
  if (result.error || result.status !== 0) throw new Error(`微场景链接失败，见 ${path.join(output,'build.json')}：${result.error?.message || result.stderr}`);
  return {binary,log};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output=path.resolve(process.argv[2] || path.join(root,'out',process.platform==='darwin'?'mac':'linux','micro'));
  try { console.log((await buildMicro(output)).binary); } catch(e) { console.error(e.message);process.exitCode=2; }
}
