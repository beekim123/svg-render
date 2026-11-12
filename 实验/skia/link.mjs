// 只链接已经构建的 Skia；不隐式下载或换 SDK。运行：node 实验/skia/link.mjs linux-x64|wasm|mac-arm64|mac-x64
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { root, cache, skiaRevision, emscriptenVersion } from '../../tools/setup/paths.mjs';

const target = process.argv[2] || (process.platform === 'darwin' ? `mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}` : 'linux-x64');
if (!['linux-x64', 'mac-arm64', 'mac-x64', 'wasm'].includes(target)) throw new Error(`未知目标：${target}`);
if (target.startsWith('mac-') && process.platform !== 'darwin') throw new Error('Mac 动态库必须在 Mac 的 Xcode 工具链上链接；本机不冒充验证。');
const sdk = path.join(cache, 'emsdk', emscriptenVersion);
const llvm = path.join(sdk, 'install/bin');
const source = path.join(cache, 'skia-build-source', skiaRevision);
const build = path.join(source, 'out', `stage0-${target}`);
const out = path.join(root, 'out', target.startsWith('mac-') ? 'mac' : 'linux', 'skia', target);
await fs.mkdir(out, { recursive: true });
const env = { ...process.env, EM_CONFIG: path.join(sdk, 'config.py'), EM_CACHE: path.join(sdk, 'sysroot-cache'), PATH: `${llvm}:${process.env.PATH}` };
const commands = [];
function run(command, args) {
  commands.push({ command, args, cwd: root });
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) throw result.error || new Error(`${command} 退出码 ${result.status}`);
  return result.stdout;
}
const wasm = target === 'wasm';
const libraries = ['skia', 'skcms'].map(name => path.join(build, `lib${name}${wasm ? '.wasm' : ''}.a`));
for (const file of libraries) await fs.access(file);
const common = ['-std=c++20', '-DNDEBUG', `-DSK_USER_CONFIG_HEADER="${path.join(root, '实验/skia/chromium-config.h')}"`, `-I${source}`, '-O3', '-ffp-contract=off', '-flto=thin'];
const cpp = path.join(root, '实验/skia/capabilities.cpp');
const output = path.join(out, wasm ? 'svg-render-probe.cjs' : target.startsWith('mac-') ? 'libsvg-render-probe.dylib' : 'libsvg-render-probe.so');
const started = Date.now();
let compiler, args, exportEvidence, modes, architectureEvidence;
try {
  if (wasm) {
    compiler = path.join(sdk, 'install/emscripten/em++');
    args = [...common, '-DSKVX_DISABLE_SIMD', '-DSK_FORCE_8_BYTE_ALIGNMENT', '-DSK_DISABLE_TRACING', cpp, ...libraries,
      '--no-entry', '-sMODULARIZE=1', '-sEXPORT_ES6=0', '-sENVIRONMENT=node', '-sALLOW_MEMORY_GROWTH=1',
      '-sINITIAL_MEMORY=33554432', '-sMAXIMUM_MEMORY=536870912',
      '-sEXPORTED_FUNCTIONS=["_svg_render_probe","_malloc","_free"]',
      '-sEXPORTED_RUNTIME_METHODS=["HEAPU8"]', '-sFILESYSTEM=0', '-sERROR_ON_UNDEFINED_SYMBOLS=1', '-o', output];
    run(compiler, args);
    const require = createRequire(import.meta.url);
    const module = await require(output)();
    const binary = await fs.readFile(output.replace(/\.cjs$/, '.wasm'));
    exportEvidence = WebAssembly.Module.exports(await WebAssembly.compile(binary));
    const pointer = module._malloc(128 * 128 * 4);
    if (!pointer) throw new Error('WASM 冒烟测试分配失败');
    modes = [];
    try {
      for (let mode = 0; mode < 28; mode++) {
        const return_code = module._svg_render_probe(mode, pointer, 128, 128);
        const bytes = Buffer.from(module.HEAPU8.subarray(pointer, pointer + 128 * 128 * 4));
        let nonzero_alpha = 0;
        for (let i = 3; i < bytes.length; i += 4) nonzero_alpha += bytes[i] > 0 ? 1 : 0;
        modes.push({ mode, return_code, nonzero_alpha, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
    } finally { module._free(pointer); }
  } else {
    if (target === 'linux-x64') {
      // 通用 lld 驱动按文件名分派，SDK 没有自带 ld.lld 名称。
      const linker = path.join(out, 'ld.lld');
      try { await fs.symlink(path.join(llvm, 'lld'), linker); } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        if (await fs.realpath(linker) !== await fs.realpath(path.join(llvm, 'lld'))) throw new Error('已有 ld.lld 不是预期 LLVM 链接器');
      }
      const map = path.join(out, 'exports.map');
      await fs.writeFile(map, '{ global: svg_render_probe; local: *; };\n');
      compiler = path.join(llvm, 'clang++');
      args = [...common, `--ld-path=${linker}`, '-fPIC', '-fvisibility=hidden', '-shared', '-Wl,--gc-sections',
        '-Wl,--exclude-libs,ALL', '-Wl,--no-undefined', `-Wl,--version-script=${map}`, cpp, ...libraries, '-pthread', '-o', output];
    } else {
      compiler = 'clang++';
      args = [...common, '-arch', target === 'mac-arm64' ? 'arm64' : 'x86_64', '-fPIC', '-fvisibility=hidden', '-dynamiclib',
        '-Wl,-dead_strip', '-Wl,-exported_symbol,_svg_render_probe', '-Wl,-undefined,error', cpp, ...libraries, '-pthread', '-o', output];
    }
    run(compiler, args);
    architectureEvidence = run('file', [output]);
    const expectedArch = target === 'mac-arm64' ? 'arm64' : 'x86_64';
    if (target.startsWith('mac-') && !architectureEvidence.includes(expectedArch)) throw new Error('Mac 产物架构不符');
    if (target === 'linux-x64' && !/x86[-_]64/.test(architectureEvidence)) throw new Error('Linux 产物架构不符');
    exportEvidence = run('nm', target === 'linux-x64' ? ['-D', '--defined-only', output] : ['-gU', output]);
    const exported = exportEvidence.split('\n').map(line => line.trim().split(/\s+/).at(-1)).filter(Boolean);
    if (exported.length !== 1 || !['svg_render_probe', '_svg_render_probe'].includes(exported[0])) throw new Error('动态库不是单一导出');
    const smoke = `import ctypes, hashlib, json, sys\nl=ctypes.CDLL(sys.argv[1]); f=l.svg_render_probe\nf.argtypes=[ctypes.c_uint,ctypes.POINTER(ctypes.c_ubyte),ctypes.c_int,ctypes.c_int]; f.restype=ctypes.c_int\nrows=[]\nfor mode in range(28):\n b=(ctypes.c_ubyte*(128*128*4))(); code=f(mode,b,128,128); raw=bytes(b)\n rows.append({'mode':mode,'return_code':code,'nonzero_alpha':sum(raw[i]>0 for i in range(3,len(raw),4)),'sha256':hashlib.sha256(raw).hexdigest()})\nprint(json.dumps(rows))\n`;
    // ARM Mac 上的 x64 动态库用 Rosetta 跑：系统自带的 /usr/bin/python3 是通用二进制，arch -x86_64 就能载入 x64 库（2026-11-11）。
    // 没装 Rosetta 时照旧只检查链接、架构、导出和体积，并写明没运行。
    if (target === 'mac-x64' && process.arch === 'arm64') {
      let rosetta = false;
      try { run('arch', ['-x86_64', '/usr/bin/true']); rosetta = true; } catch {}
      modes = rosetta ? JSON.parse(run('arch', ['-x86_64', '/usr/bin/python3', '-c', smoke, output])) : null;
    } else modes = JSON.parse(run('python3', ['-c', smoke, output]));
  }
  if (modes !== null && !modes.every(row => row.return_code === 0 && row.nonzero_alpha > 0)) throw new Error('至少一个能力模式未通过；详见记录');
  const binaryPath = wasm ? output.replace(/\.cjs$/, '.wasm') : output;
  const binary = await fs.readFile(binaryPath);
  const info = { target, Skia: skiaRevision, compiler, link_and_smoke_seconds: (Date.now() - started) / 1000,
    bytes: binary.length, sha256: createHash('sha256').update(binary).digest('hex'),
    exports: exportEvidence, architecture: architectureEvidence, build_pass: true,
    runtime_validation: modes === null ? '未运行：没有 Rosetta，只检查了x64链接、架构、导出与体积' : (target === 'mac-x64' && process.arch === 'arm64' ? '28模式全部通过（Rosetta）' : '28模式全部通过'),
    modes, commands, scope: '28模式运行冒烟与体积；不是Chrome像素一致性验收。Mac分支未在Linux执行。' };
  if (wasm) {
    const gzip = gzipSync(binary, { level: 9 });
    const brotli = brotliCompressSync(binary, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
    await fs.writeFile(`${binaryPath}.gz`, gzip); await fs.writeFile(`${binaryPath}.br`, brotli);
    info.gzip_bytes = gzip.length; info.brotli_bytes = brotli.length;
    info.js_glue_bytes = (await fs.stat(output)).size;
    info.brotli_limit_decimal_bytes = 1500000;
    info.brotli_pass = brotli.length <= 1500000;
  } else {
    info.size_command = run('size', [binaryPath]);
    const row = info.size_command.trim().split('\n').at(-1).trim().split(/\s+/);
    if (row.length < 3 || !row.slice(0, 3).every(value => /^\d+$/.test(value))) throw new Error('无法解析 size 的代码/数据段大小');
    info.section_bytes = target.startsWith('mac-')
      ? { __TEXT: Number(row[0]), __DATA: Number(row[1]), __OBJC: Number(row[2]) }
      : { text: Number(row[0]), data: Number(row[1]), bss: Number(row[2]) };
    info.section_convention = target.startsWith('mac-') ? 'Apple size 的 __TEXT/__DATA/__OBJC；__TEXT含代码及只读数据，不冒称纯机器指令大小' : 'GNU size 的 text/data/bss';
  }
  if(target.startsWith('mac-')){info.size_limit_decimal_bytes=6000000;info.size_pass=info.bytes<=6000000;info.must_pause=info.bytes>8000000;}
  await fs.writeFile(path.join(out, 'link-result.json'), JSON.stringify(info, null, 2) + '\n');
  if(info.must_pause){console.error('STOP_RULE_9：Mac动态库超过8MB，按需求第9节停止并询问用户。');process.exitCode=3;}
  else if(info.size_pass===false)process.exitCode=1;
  console.log(JSON.stringify({ target, bytes: info.bytes, gzip_bytes: info.gzip_bytes, brotli_bytes: info.brotli_bytes, passed_modes: modes?.length ?? null, output: binaryPath }));
} catch (error) {
  await fs.writeFile(path.join(out, 'link-failure.json'), JSON.stringify({ target, commands, modes, error: String(error) }, null, 2) + '\n');
  throw error;
}
