#!/usr/bin/env python3
"""试验用：比较两张 PNG，算出设计里定义的几项指标。不是正式的对照工具，只为核实指标定义合不合理。

用法：python3 比较.py 甲.png 乙.png [差异图.png]

指标（和 设计.md 第 2 节的定义一致）：
  1. 两张图都按"预乘透明度"叠到深底(#202020)和浅底(#E0E0E0)上，各算一遍，取较差的那个；
  2. 只在"有内容的区域"里算（任一张图不透明度 > 0 的像素，向外扩 5 像素）；
  3. SSIM：亮度通道，11×11 高斯窗（σ=1.5），区域内取平均；
  4. 大差像素比例：任一通道差 > 16 的像素占内容区域的比例；
     "不算边"= 去掉那些能用"挪 1 像素"解释的差异（甲的值落在乙 3×3 邻域的取值范围 ±16 之内，反过来也成立）；
  5. 最大差异块：不算边的大差像素里，连在一起最大的一块有多少像素（防止小东西整个画丢却被比例淹没）。
"""
import json
import sys

import numpy as np
from PIL import Image

BIG = 16


def load(path):
    return np.asarray(Image.open(path).convert('RGBA'), dtype=np.float64)


def over(rgba, bg):
    a = rgba[..., 3:4] / 255.0
    return rgba[..., :3] * a + bg * (1 - a)


def gauss_blur(img, sigma=1.5, size=11):
    r = size // 2
    k = np.exp(-(np.arange(-r, r + 1) ** 2) / (2 * sigma * sigma)); k /= k.sum()
    pad = np.pad(img, ((r, r), (r, r)), mode='reflect')
    tmp = sum(k[i] * pad[:, i:i + img.shape[1]] for i in range(size))
    return sum(k[i] * tmp[i:i + img.shape[0], :] for i in range(size))


def ssim_map(x, y):
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    mx, my = gauss_blur(x), gauss_blur(y)
    vx, vy, cxy = gauss_blur(x * x) - mx * mx, gauss_blur(y * y) - my * my, gauss_blur(x * y) - mx * my
    return ((2 * mx * my + c1) * (2 * cxy + c2)) / ((mx * mx + my * my + c1) * (vx + vy + c2))


def window_minmax(img, r=1):
    pad = np.pad(img, ((r, r), (r, r), (0, 0)), mode='edge')
    stack = [pad[dy:dy + img.shape[0], dx:dx + img.shape[1]] for dy in range(2 * r + 1) for dx in range(2 * r + 1)]
    return np.min(stack, axis=0), np.max(stack, axis=0)


def dilate(mask, r):
    pad = np.pad(mask, r, mode='constant')
    out = np.zeros_like(mask)
    for dy in range(2 * r + 1):
        for dx in range(2 * r + 1):
            out |= pad[dy:dy + mask.shape[0], dx:dx + mask.shape[1]]
    return out


def largest_blob(mask):
    seen = np.zeros_like(mask, dtype=bool); best = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]; seen[y0, x0] = True; n = 0
        while stack:
            y, x = stack.pop(); n += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < mask.shape[0] and 0 <= xx < mask.shape[1] and mask[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True; stack.append((yy, xx))
        best = max(best, n)
    return best


def compare(pa, pb, diff_out=None):
    a, b = load(pa), load(pb)
    if a.shape != b.shape:
        return {'错误': f'尺寸不同 {a.shape} {b.shape}'}
    content = dilate((a[..., 3] > 0) | (b[..., 3] > 0), 5)
    n = int(content.sum())
    if n == 0:
        return {'内容像素': 0, 'ssim': 1.0, '大差比例': 0.0, '大差比例_不算边': 0.0, '最大差异块': 0, '最大差': 0}
    worst = None
    for bg in (32.0, 224.0):
        x, y = over(a, bg), over(b, bg)
        luma = lambda v: 0.2126 * v[..., 0] + 0.7152 * v[..., 1] + 0.0722 * v[..., 2]
        s = float(ssim_map(luma(x), luma(y))[content].mean())
        d = np.abs(x - y).max(axis=2)
        big = (d > BIG) & content
        lo_y, hi_y = window_minmax(y); lo_x, hi_x = window_minmax(x)
        explained = np.all((x >= lo_y - BIG) & (x <= hi_y + BIG) & (y >= lo_x - BIG) & (y <= hi_x + BIG), axis=2)
        hard = big & ~explained
        r = {'底': '深' if bg < 128 else '浅', '内容像素': n, 'ssim': round(s, 5), '大差比例': round(float(big.sum()) / n, 6),
             '大差比例_不算边': round(float(hard.sum()) / n, 6), '最大差异块': largest_blob(hard), '最大差': int(round(float(d[content].max()))),
             '平均差': round(float(d[content].mean()), 4)}
        if worst is None or (r['ssim'], -r['大差比例_不算边']) < (worst['ssim'], -worst['大差比例_不算边']):
            worst = r; keep = (d, hard)
    if diff_out:
        d, hard = keep
        vis = np.zeros(a.shape[:2] + (3,), dtype=np.uint8)
        vis[..., 0] = np.clip(d * 8, 0, 255); vis[..., 1] = np.where(hard, 255, 0); vis[..., 2] = np.where(content, 40, 0)
        Image.fromarray(vis).save(diff_out)
    return worst


if __name__ == '__main__':
    print(json.dumps(compare(*sys.argv[1:4]), ensure_ascii=False))
