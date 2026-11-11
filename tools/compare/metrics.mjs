/** 纯 JavaScript 像素尺子。所有计算使用浮点数；输出前不舍入。 */
export const DEFAULT_THRESHOLDS = {
  静止: { ssim: 0.995, 大差比例_不算边: 0.001, 最大差异块: 16, 平均偏色: 1 },
  文字: { ssim: 0.98, 大差比例_不算边: 0.005, 最大差异块: 16, 平均偏色: 1 },
  运动: { ssim: 0.975, 'ssim_2倍': 0.985, 大差比例_不算边: 0.01, 最大差异块: 32, 平均偏色: 1.5 },
  GPU: { ssim: 0.995, 大差比例_不算边: 0.002, 最大差异块: 16, 平均偏色: 1.5 },
};
const weights = Array.from({ length: 6 }, (_, i) => Math.exp(-i * i / 4.5));
const norm = weights[0] + 2 * weights.slice(1).reduce((s, v) => s + v, 0);
const K = weights.map(v => v / norm);
const reflect = (i, n) => {
  if (n === 1) return 0;
  const period = 2 * (n - 1);
  i = ((i % period) + period) % period;
  return i < n ? i : period - i;
};

/** 方形外扩，两个方向的滑动计数，避免每点扫描 121 个邻居。 */
export function contentMask(a, b, w, h) {
  const tmp = new Uint8Array(w * h), result = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let count = 0;
    const active = x => (x >= 0 && x < w && (a[(y * w + x) * 4 + 3] || b[(y * w + x) * 4 + 3])) ? 1 : 0;
    for (let x = -5; x <= 5; x++) count += active(x);
    for (let x = 0; x < w; x++) { tmp[y * w + x] = +(count > 0); count += active(x + 6) - active(x - 5); }
  }
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = 0; y <= Math.min(5, h - 1); y++) count += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      result[y * w + x] = +(count > 0);
      if (y + 6 < h) count += tmp[(y + 6) * w + x];
      if (y - 5 >= 0) count -= tmp[(y - 5) * w + x];
    }
  }
  return result;
}

export function regionLabels(content, w, h, boxes) {
  const labels = content.slice();
  for (const box of boxes) {
    const { x, y, width, height } = box;
    if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0) throw new Error('文字包围盒必须含有限数值 x/y/width/height，宽高不能为负');
    // 像素格与向外扩 2 像素后的矩形相交即纳入，边界采用左闭右开。
    const x0 = Math.max(0, Math.floor(x - 2)), x1 = Math.min(w, Math.ceil(x + width + 2));
    const y0 = Math.max(0, Math.floor(y - 2)), y1 = Math.min(h, Math.ceil(y + height + 2));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const p = yy * w + xx;
      if (content[p]) labels[p] = 2;
    }
  }
  return labels;
}

/** 保留属于完整 2×2 方块的像素，再按八邻域求最大连通块。 */
export function largestThickComponent(hard, w, h, labels, region) {
  const thick = new Uint8Array(w * h);
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const p = y * w + x, q = p + w;
    if (hard[p] && hard[p + 1] && hard[q] && hard[q + 1] &&
      (!region || (labels[p] === region && labels[p + 1] === region && labels[q] === region && labels[q + 1] === region))) {
      thick[p] = thick[p + 1] = thick[q] = thick[q + 1] = 1;
    }
  }
  const stack = new Int32Array(w * h);
  let best = 0;
  for (let p = 0; p < thick.length; p++) {
    if (!thick[p]) continue;
    let top = 1, size = 0;
    stack[0] = p; thick[p] = 0;
    while (top) {
      const q = stack[--top], y = Math.floor(q / w), x = q - y * w;
      size++;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) {
          const r = yy * w + xx;
          if (thick[r]) { thick[r] = 0; stack[top++] = r; }
        }
      }
    }
    best = Math.max(best, size);
  }
  return best;
}

/** 两次一维卷积计算五个局部矩。环形缓存只保留 11 行，不构造五张 4K 浮点中间图。 */
function ssimSums(x, y, w, h, labels) {
  const sums = [0, 0, 0], ring = Array.from({ length: 11 }, () => new Float64Array(w * 5));
  const indices = new Int32Array(w * 10);
  for (let i = 0; i < w; i++) for (let d = 1; d <= 5; d++) {
    indices[i * 10 + (d - 1) * 2] = reflect(i - d, w);
    indices[i * 10 + (d - 1) * 2 + 1] = reflect(i + d, w);
  }
  function row(virtualY) {
    const dst = ring[((virtualY % 11) + 11) % 11], offset = reflect(virtualY, h) * w;
    for (let i = 0; i < w; i++) {
      let a = x[offset + i], b = y[offset + i];
      let mx = K[0] * a, my = K[0] * b, xx = K[0] * a * a, yy = K[0] * b * b, xy = K[0] * a * b;
      for (let d = 1; d <= 5; d++) {
        const left = offset + indices[i * 10 + (d - 1) * 2], right = offset + indices[i * 10 + (d - 1) * 2 + 1];
        a = x[left]; b = y[left]; const c = x[right], e = y[right], k = K[d];
        mx += k * (a + c); my += k * (b + e); xx += k * (a * a + c * c); yy += k * (b * b + e * e); xy += k * (a * b + c * e);
      }
      const j = i * 5; dst[j] = mx; dst[j + 1] = my; dst[j + 2] = xx; dst[j + 3] = yy; dst[j + 4] = xy;
    }
  }
  for (let yy = -5; yy < 5; yy++) row(yy);
  const c1 = 6.5025, c2 = 58.5225;
  for (let yy = 0; yy < h; yy++) {
    row(yy + 5);
    const center = ring[yy % 11], neighbors = [];
    for (let d = 1; d <= 5; d++) neighbors.push(ring[((yy - d) % 11 + 11) % 11], ring[(yy + d) % 11]);
    for (let i = 0; i < w; i++) {
      const label = labels[yy * w + i]; if (!label) continue;
      const j = i * 5;
      let mx = K[0] * center[j], my = K[0] * center[j + 1], xx = K[0] * center[j + 2], by = K[0] * center[j + 3], xy = K[0] * center[j + 4];
      for (let d = 1; d <= 5; d++) {
        const l = neighbors[(d - 1) * 2], r = neighbors[(d - 1) * 2 + 1], k = K[d];
        mx += k * (l[j] + r[j]); my += k * (l[j + 1] + r[j + 1]); xx += k * (l[j + 2] + r[j + 2]); by += k * (l[j + 3] + r[j + 3]); xy += k * (l[j + 4] + r[j + 4]);
      }
      const value = ((2 * mx * my + c1) * (2 * (xy - mx * my) + c2)) / ((mx * mx + my * my + c1) * (xx - mx * mx + by - my * my + c2));
      sums[label] += value; sums[0] += value;
    }
  }
  return sums;
}

function backgroundMetrics(a, b, w, h, labels, bg, groups, workspace) {
  const n = w * h, { lumaA, lumaB } = workspace;
  const difference = new Float32Array(n), hard = new Uint8Array(n);
  const accum = Array.from({ length: 3 }, () => ({ count: 0, big: 0, hard: 0, max: 0, abs: 0, bias: [0, 0, 0] }));
  let identical = true;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, label = labels[p], j = p * 4;
    const alphaA = a[j + 3] / 255, alphaB = b[j + 3] / 255;
    const ar = a[j] * alphaA + bg * (1 - alphaA), ag = a[j + 1] * alphaA + bg * (1 - alphaA), ab = a[j + 2] * alphaA + bg * (1 - alphaA);
    const br = b[j] * alphaB + bg * (1 - alphaB), bgc = b[j + 1] * alphaB + bg * (1 - alphaB), bb = b[j + 2] * alphaB + bg * (1 - alphaB);
    lumaA[p] = 0.2126 * ar + 0.7152 * ag + 0.0722 * ab;
    lumaB[p] = 0.2126 * br + 0.7152 * bgc + 0.0722 * bb;
    const dr = ar - br, dg = ag - bgc, db = ab - bb;
    if (dr || dg || db) identical = false;
    if (!label) continue;
    const d = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db)), big = d > 16;
    difference[p] = d;
    let explained = true;
    if (big) for (let c = 0; c < 3 && explained; c++) {
      let minA = Infinity, minB = Infinity, maxA = -Infinity, maxB = -Infinity;
      // 重复边缘值不改变 min/max，因此直接截断邻域等价于边缘补值。
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) {
        const q = (yy * w + xx) * 4, aa = a[q + 3] / 255, ba = b[q + 3] / 255;
        const va = a[q + c] * aa + bg * (1 - aa), vb = b[q + c] * ba + bg * (1 - ba);
        minA = Math.min(minA, va); maxA = Math.max(maxA, va); minB = Math.min(minB, vb); maxB = Math.max(maxB, vb);
      }
      const va = c === 0 ? ar : c === 1 ? ag : ab, vb = c === 0 ? br : c === 1 ? bgc : bb;
      explained = va >= minB - 16 && va <= maxB + 16 && vb >= minA - 16 && vb <= maxA + 16;
    }
    hard[p] = +(big && !explained);
    for (const g of [0, label]) {
      const acc = accum[g]; acc.count++; acc.big += +big; acc.hard += hard[p]; acc.max = Math.max(acc.max, d);
      acc.abs += (Math.abs(dr) + Math.abs(dg) + Math.abs(db)) / 3;
      acc.bias[0] += dr; acc.bias[1] += dg; acc.bias[2] += db;
    }
  }
  const sums = identical ? accum.map(v => v.count) : ssimSums(lumaA, lumaB, w, h, labels);
  const results = groups.map(region => {
    const v = accum[region], n = v.count;
    return { 底: bg === 32 ? '深' : '浅', 内容像素: n, ssim: n ? sums[region] / n : 1,
      大差比例: n ? v.big / n : 0, 大差比例_不算边: n ? v.hard / n : 0, 不算边大差像素: v.hard,
      最大差异块: v.hard ? largestThickComponent(hard, w, h, labels, region) : 0,
      平均偏色: n ? Math.max(...v.bias.map(Math.abs)) / n : 0, 通道平均差: v.bias.map(s => n ? s / n : 0),
      最大差: v.max, 平均绝对差: n ? v.abs / n : 0 };
  });
  return { results, difference, hard };
}

export function thresholdFor(line, scale = 1, thresholds = DEFAULT_THRESHOLDS, baseline) {
  if (!thresholds[line]) throw new Error(`未知阈值线：${line}`);
  const result = { ...thresholds[line] };
  for (const key of ['ssim', '大差比例_不算边', '最大差异块', '平均偏色']) {
    if (!Number.isFinite(result[key]) || result[key] < 0 || (key === 'ssim' && result[key] > 1)) throw new Error(`阈值 ${line}.${key} 必须是合法非负数`);
  }
  if (result['ssim_2倍'] !== undefined && (!Number.isFinite(result['ssim_2倍']) || result['ssim_2倍'] < 0 || result['ssim_2倍'] > 1)) throw new Error('运动.ssim_2倍 必须在0到1之间');
  if (line === '运动' && scale >= 2) result.ssim = result['ssim_2倍'] ?? 0.985;
  result.最大差异块 *= scale * scale;
  if (line === 'GPU') {
    if (!baseline) throw new Error('GPU 线需要这张图的 Chrome 自差基准，不能用别的图代替');
    for (const key of ['ssim', '大差比例_不算边', '最大差异块', '平均偏色']) if (!Number.isFinite(baseline[key]) || baseline[key] < 0 || (key === 'ssim' && baseline[key] > 1)) throw new Error(`GPU 基准缺少 ${key}`);
    result.ssim = Math.max(result.ssim, 1 - (1 - baseline.ssim) * 1.2);
    for (const key of ['大差比例_不算边', '最大差异块', '平均偏色']) result[key] = Math.min(result[key], baseline[key] * 1.2);
  }
  return result;
}

export function compareImages(a, b, options = {}) {
  if (!a || !b || a.width !== b.width || a.height !== b.height) throw new Error('尺寸不同');
  const w = a.width, h = a.height;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || a.data.length !== w * h * 4 || b.data.length !== w * h * 4) throw new Error('RGBA 图像尺寸或数据长度不合法');
  const scale = options.scale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('倍率必须是正数');
  const boxes = options.textBoxes ?? [], content = contentMask(a.data, b.data, w, h), labels = regionLabels(content, w, h, boxes);
  const groups = boxes.length ? [0, 1, 2] : [0];
  // 两种底复用工作区，避免4K双精度数组反复分配导致内存峰值和垃圾回收抖动。
  const workspace = { lumaA: new Float64Array(w * h), lumaB: new Float64Array(w * h) };
  const dark = backgroundMetrics(a.data, b.data, w, h, labels, 32, groups, workspace);
  // 两图全不透明时，叠深底与浅底在数学上完全相同，可复用结果。
  let opaque = true;
  for (let p = 3; p < a.data.length; p += 4) if (a.data[p] !== 255 || b.data[p] !== 255) { opaque = false; break; }
  const light = opaque ? dark : backgroundMetrics(a.data, b.data, w, h, labels, 224, groups, workspace);
  const picks = groups.map((_, i) => light.results[i].ssim < dark.results[i].ssim ? light : dark);
  const results = groups.map((g, i) => {
    const name = g === 2 ? '文字' : g === 1 ? '非文字' : '全图';
    const line = g === 2 ? '文字' : options.line ?? '静止';
    const baseline = options.baseline?.[name] ?? options.baseline;
    const threshold = thresholdFor(line, scale, options.thresholds, baseline);
    const metrics = picks[i].results[i];
    const failures = Object.entries(threshold).filter(([key, value]) => key === 'ssim' ? metrics[key] < value : ['大差比例_不算边', '最大差异块', '平均偏色'].includes(key) && metrics[key] > value).map(([key]) => key);
    return { 区域: name, 线: line, 指标: metrics, 阈值: threshold, 通过: failures.length === 0, 未通过: failures };
  });
  const diff = new Uint8Array(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const g = boxes.length && labels[p] ? labels[p] : 0, pick = picks[groups.indexOf(g)];
    diff[p * 4] = Math.min(255, pick.difference[p] * 8);
    diff[p * 4 + 1] = pick.hard[p] ? 255 : 0;
    diff[p * 4 + 2] = labels[p] ? 40 : 0; diff[p * 4 + 3] = 255;
  }
  return { 宽: w, 高: h, 倍率: scale, 分组: results, 通过: (boxes.length ? results.slice(1) : results).every(r => r.通过), 差异图: { width: w, height: h, data: diff } };
}
