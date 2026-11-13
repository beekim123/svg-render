import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root, cache, skiaRevision} from '../setup/paths.mjs';

const bindings = path.join(cache, 'godot-cpp-10.0.0-stable');
const source = path.join(cache, 'skia', skiaRevision);
const built = path.join(cache, 'skia-build-source', skiaRevision, 'out', 'stage0-mac-arm64');
const output = path.join(root, 'godot/bin/libsvg_skia.dylib');
const profile = {enabled_classes: ['RefCounted', 'Image', 'ImageTexture', 'Engine', 'OS', 'JSON']};
const env = {...process.env, OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1', VECLIB_MAXIMUM_THREADS: '1'};
const profileFile = path.join(bindings, 'b2-profile.json');
const profileText = JSON.stringify(profile);
if (await fs.readFile(profileFile, 'utf8').catch(() => '') !== profileText) await fs.writeFile(profileFile, profileText);
const run = (command, args, cwd = root) => {
  const result = spawnSync('nice', ['-n', '10', command, ...args], {cwd, env, stdio: 'inherit'});
  if (result.error || result.status !== 0) throw new Error(`运行时构建失败：${command}，退出 ${result.status}，${result.error?.message || ''}`);
};
run('python3', ['-m', 'SCons', '-j1', 'api_version=4.7', 'platform=macos', 'arch=arm64', 'target=template_release', 'build_profile=b2-profile.json'], bindings);
const pathops = await fs.readFile(path.join(source, 'gn/pathops.gni'), 'utf8');
const sources = [...pathops.matchAll(/"\$_src\/(pathops\/[^"\n]+\.cpp)"/g)].map(match => path.join(source, 'src', match[1]));
const libraries = (await fs.readdir(path.join(bindings, 'bin'))).filter(file => file.endsWith('.a'));
await fs.mkdir(path.dirname(output), {recursive: true});
run('clang++', [
  '-std=c++20', '-DNDEBUG', '-O3', '-ffp-contract=off', '-flto=thin', '-shared', '-fPIC', '-arch', 'arm64',
  '-DGDEXTENSION', `-I${bindings}/include`, `-I${bindings}/gen/include`, `-I${bindings}/gdextension`,
  `-I${source}`, `-DSK_USER_CONFIG_HEADER="${path.join(root, '实验/skia/chromium-config.h')}"`,
  path.join(root, 'godot/native/renderer.cpp'), path.join(source, 'modules/jsonreader/SkJSONReader.cpp'), ...sources,
  path.join(bindings, 'bin', libraries.find(file => file.includes('template_release.arm64'))),
  path.join(built, 'libskia.a'), path.join(built, 'libskcms.a'), '-lz',
  '-Wl,-dead_strip', '-Wl,-mllvm,-threads=1', '-o', output,
]);
console.log(output);
