#!/usr/bin/env python3
"""试验 5：粗估"编成二进制中间格式"能有多小。拿现有游戏的 117 个 SVG（只读）来估。
做法：把所有几何数字（path 的 d、polygon 的 points、圆和矩形的坐标）转成绝对坐标，按 1/64 单位取整，
相邻点做差，用变长整数存；每个元素另算固定开销；<style> 里的动画按文本的 35% 估。
这只是估算，不是真的格式。真的数字要等阶段 1 的编译器出来再量（实验"包体"）。
用法：python3 试验5-包体估算.py
"""
import glob, re, zlib, lzma, os

FILES = sorted(glob.glob('素材/源文件/现有游戏/svg/*.svg') + glob.glob('素材/源文件/待接入/svg/*.svg'))
Q = 64
NUM = re.compile(r'[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?')
ARGS = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4, 'T': 2, 'A': 7, 'Z': 0}

def varint(n):
    n = (n << 1) ^ (n >> 63)          # zigzag
    out = bytearray()
    while True:
        b = n & 0x7F; n >>= 7
        if n: out.append(b | 0x80)
        else: out.append(b); return bytes(out)

def q(v): return int(round(v * Q))

def encode_path(d):
    out = bytearray(); cmds = 0; x = y = 0.0; px = py = 0   # px,py：上一个已写出的量化坐标
    for m in re.finditer(r'([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)', d):
        c, nums = m.group(1), [float(v) for v in NUM.findall(m.group(2))]
        n = ARGS[c.upper()]
        if n == 0: cmds += 1; continue
        for i in range(0, len(nums) - n + 1, n):
            a = nums[i:i + n]; cmds += 1; rel = c.islower(); C = c.upper()
            if C == 'H': pts = [((x + a[0]) if rel else a[0], y)]
            elif C == 'V': pts = [(x, (y + a[0]) if rel else a[0])]
            elif C == 'A':
                out += varint(q(a[0])) + varint(q(a[1])) + varint(q(a[2])) + bytes([int(a[3]) | int(a[4]) << 1])
                pts = [((x + a[5]) if rel else a[5], (y + a[6]) if rel else a[6])]
            else: pts = [((x + a[j]) if rel else a[j], (y + a[j + 1]) if rel else a[j + 1]) for j in range(0, n, 2)]
            for (ax, ay) in pts:
                qx, qy = q(ax), q(ay); out += varint(qx - px) + varint(qy - py); px, py = qx, qy
            x, y = pts[-1]
    return bytes(out) + bytes((cmds * 3 + 7) // 8)          # 每条命令 3 位

def encode_points(s):
    nums = [float(v) for v in NUM.findall(s)]; out = bytearray(); px = py = 0
    for i in range(0, len(nums) - 1, 2):
        qx, qy = q(nums[i]), q(nums[i + 1]); out += varint(qx - px) + varint(qy - py); px, py = qx, qy
    return bytes(out)

rows = []; blob_all = bytearray(); text_all = bytearray()
for f in FILES:
    t = open(f, encoding='utf8').read(); raw = len(t.encode())
    geo = bytearray()
    for d in re.findall(r'\sd="([^"]*)"', t): geo += encode_path(d)
    for p in re.findall(r'\spoints="([^"]*)"', t): geo += encode_points(p)
    for v in re.findall(r'\s(?:cx|cy|r|rx|ry|x|y|x1|y1|x2|y2|width|height)="([-\d.]+)"', t): geo += varint(q(float(v)))
    elements = len(re.findall(r'<(?:path|polygon|polyline|circle|rect|ellipse|line|g|use|stop|linearGradient|radialGradient|clipPath|filter|fe\w+)\b', t))
    style = sum(len(s) for s in re.findall(r'<style[^>]*>(.*?)</style>', t, re.S))
    transforms = len(re.findall(r'\stransform="', t))
    est = len(geo) + elements * 8 + transforms * 12 + int(style * 0.35) + 64
    rows.append((os.path.basename(f), raw, len(zlib.compress(t.encode(), 9)), est, len(geo), elements, style))
    blob_all += geo; text_all += t.encode()

tot = lambda i: sum(r[i] for r in rows)
print(f'文件 {len(rows)} 个')
print(f'SVG 原文          {tot(1)/1024:8.1f} KB')
print(f'SVG 原文 逐个 gzip {tot(2)/1024:8.1f} KB   ({tot(2)/tot(1):.0%})')
print(f'二进制估算（不压缩）{tot(3)/1024:8.1f} KB   ({tot(3)/tot(1):.0%})   其中几何 {tot(4)/1024:.1f} KB，元素 {tot(5)} 个，样式和动画文本 {tot(6)/1024:.1f} KB')
gz = len(zlib.compress(bytes(blob_all), 9)); xz = len(lzma.compress(bytes(blob_all)))
print(f'几何部分再整体压缩：gzip {gz/1024:.1f} KB（{gz/len(blob_all):.0%}），xz {xz/1024:.1f} KB（{xz/len(blob_all):.0%}）—— 量化差分后的坐标还能再压一半左右（现有素材形状规整）')
print('最大的 6 个：')
for r in sorted(rows, key=lambda r: -r[1])[:6]: print(f'  {r[0]:22s} 原文 {r[1]/1024:5.1f} KB  gzip {r[2]/1024:5.1f} KB  二进制估算 {r[3]/1024:5.1f} KB ({r[3]/r[1]:.0%})  样式文本 {r[6]/1024:.1f} KB')
