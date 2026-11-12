import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { root, cache, skiaRevision } from '../setup/paths.mjs';

export async function buildScene(output = path.join(root, 'out/mac/scene'), target = `mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}`) {
  const source = path.join(cache, 'skia', skiaRevision);
  const built = path.join(cache, 'skia-build-source', skiaRevision, 'out', `stage0-${target}`);
  const library = path.join(built, 'libskia.a');
  const header = path.join(root, '实验/skia/chromium-config.h');
  const pathopsList = await fs.readFile(path.join(source, 'gn/pathops.gni'), 'utf8');
  const pathopsSources = [...pathopsList.matchAll(/"\$_src\/(pathops\/[^"\n]+\.cpp)"/g)].map(match => path.join(source, 'src', match[1]));
  await fs.access(library);
  await fs.mkdir(output, { recursive: true });
  const binary = path.join(output, 'scene-draw');
  const compiler = process.platform === 'darwin' ? 'clang++' : path.join(cache, 'emsdk/7.0.0/install/bin/clang++');
  const args = [
    '-std=c++20', '-DNDEBUG', '-O3', '-ffp-contract=off', '-flto=thin',
    `-I${source}`, `-DSK_USER_CONFIG_HEADER="${header}"`,
    path.join(root, 'tools/scene/draw.cpp'), path.join(source, 'modules/jsonreader/SkJSONReader.cpp'), ...pathopsSources,
    library, path.join(built, 'libskcms.a'), '-lz', '-o', binary,
  ];
  if (process.platform === 'darwin') {
    args.push('-arch', target.endsWith('arm64') ? 'arm64' : 'x86_64', '-Wl,-dead_strip', '-Wl,-mllvm,-threads=1');
  } else {
    args.push('-pthread', '-ldl', '-Wl,--gc-sections');
  }
  const result = spawnSync('nice', ['-n', '10', compiler, ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1', VECLIB_MAXIMUM_THREADS: '1',
    },
  });
  if (result.error || result.status !== 0) {
    throw new Error(`场景工具编译失败：${result.error?.message || result.stderr}`);
  }
  return { binary };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log((await buildScene(path.resolve(process.argv[2] || path.join(root, 'out/mac/scene')))).binary);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
