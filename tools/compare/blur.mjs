// 高斯模糊（预乘透明度后分两遍卷积，边上用镜像补），只给"冻结图对活图"这条防漏写检查用。
// 活图里有动画的元素在单独的合成层上，先光栅再缩放，边缘发虚；先把两张图都模糊 1 像素，
// 发虚造成的差就基本消掉，而写错属性造成的位置、颜色差还在。
export function gaussianBlur(image, sigma = 1) {
  const {width: w, height: h, data} = image;
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = [];
  let sum = 0;
  for (let i = -radius; i <= radius; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); kernel.push(v); sum += v; }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  const mirror = (i, n) => (i < 0 ? -i - 1 : i >= n ? 2 * n - i - 1 : i);

  // 预乘：颜色 × 不透明度，避免透明像素的颜色渗进来。
  const src = new Float32Array(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const a = data[p * 4 + 3] / 255;
    src[p * 4] = data[p * 4] * a; src[p * 4 + 1] = data[p * 4 + 1] * a; src[p * 4 + 2] = data[p * 4 + 2] * a; src[p * 4 + 3] = data[p * 4 + 3];
  }
  const tmp = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
    let v = 0;
    for (let k = -radius; k <= radius; k++) v += kernel[k + radius] * src[(y * w + mirror(x + k, w)) * 4 + c];
    tmp[(y * w + x) * 4 + c] = v;
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    const px = [0, 0, 0, 0];
    for (let k = -radius; k <= radius; k++) {
      const s = (mirror(y + k, h) * w + x) * 4, kv = kernel[k + radius];
      px[0] += kv * tmp[s]; px[1] += kv * tmp[s + 1]; px[2] += kv * tmp[s + 2]; px[3] += kv * tmp[s + 3];
    }
    const a = px[3] / 255;
    out[o] = a > 0 ? px[0] / a : 0; out[o + 1] = a > 0 ? px[1] / a : 0; out[o + 2] = a > 0 ? px[2] / a : 0; out[o + 3] = px[3];
  }
  return {width: w, height: h, data: Buffer.from(out.buffer)};
}
