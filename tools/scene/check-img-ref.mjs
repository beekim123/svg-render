import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {PNG} from 'pngjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scene-img-ref-'));
try {
  const directory = path.join(root, 'ref/fixture/tile/idle');
  await fs.mkdir(directory, {recursive: true});
  for (const scale of [1, 2]) {
    const png = new PNG({width: 12 * scale, height: 8 * scale});
    const stem = path.join(directory, `0@${scale}x`);
    await fs.writeFile(`${stem}.png`, PNG.sync.write(png));
    await fs.writeFile(scale === 1 ? path.join(directory, '0.svg') : `${stem}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${png.width}" height="${png.height}" viewBox="0 0 12 8"><rect x="2" y="2" width="8" height="4" fill="#ff0000"/></svg>`);
  }
  const result = spawnSync(process.execPath, ['tools/scene/img-ref.mjs', '--out', root, '--id', 'fixture/tile'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  for (const scale of [1, 2]) {
    const png = PNG.sync.read(await fs.readFile(path.join(root, `ref-img/fixture/tile/idle/0@${scale}x.png`)));
    assert.deepEqual([png.width, png.height], [12 * scale, 8 * scale]);
    assert.deepEqual([...png.data.subarray(0, 4)], [0, 0, 0, 0]);
    const center = (4 * scale * png.width + 6 * scale) * 4;
    assert.deepEqual([...png.data.subarray(center, center + 4)], [255, 0, 0, 255]);
  }
  console.log('整图参照：1/2 倍同名目录、尺寸、内容与透明背景通过');
} finally {
  await fs.rm(root, {recursive: true, force: true});
}
