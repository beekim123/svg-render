# 阶段 0 交接

> 2026-11-12。先读 [`AGENTS.md`](AGENTS.md)。

## 现在在哪

- 检出：`/private/tmp/svg-render-mac-volume/svg-render`，分支 `stage-0`。这是区分大小写的临时卷，用前运行 `mount | rg svg-render-mac-volume`。
- 本轮测试源提交：`d96358fcbb55239b3e754b32e882a7c9fc26d810`。启动时工作区干净；本轮渲染工具未改动。
- 本轮报告、计时探针和提速方案随本提交保存。验收数据见 [`报告/mac/验收.json`](报告/mac/验收.json)，步骤与时间见 [`报告/mac/步骤.json`](报告/mac/步骤.json)。
- 缓存：`/private/tmp/svg-render-mac-cache`。完整逐帧产物和原始日志：`out/mac/`。
- 未推送。`origin` 是本机副本 `/private/tmp/svg-render-stage-0-mac`；推送由用户另行决定。

## 已经定下的事

1. 冻结图对活图：原图 SSIM ≥ 0.95，或各做 σ=1 像素高斯模糊后 SSIM ≥ 0.95。
2. 参照页使用 `-webkit-font-smoothing:antialiased`。
3. 截图连截到两次逐字节相同，最多 6 次，不扩视口；每帧元数据记录 `截图次数`。
4. 整个项目只用 Mac。
5. x64 动态库用 Rosetta 跑 28 模式探针。
6. 冻结策略 `value-only`；`systemLanguage` 不支持。

判法和修复依据：[`Claude修复记录.md`](报告/mac-续验-a7c0423-20261111/Claude修复记录.md)。

## 验收（Mac 全量技术检查）

| # | 检查 | 结果 |
|---|---|---|
| 1 | 环境 | 通过 1 轮，darwin / arm64，Chrome 157.0.8103.50 |
| 2 | 对照工具自测 | 通过 1 项，退出码 0 |
| 3 | 覆盖 | 通过 1,384 素材，1,509/1,509 动作，8,722 帧 |
| 4 | 可重复（实验 1） | 通过 8,722/8,722 帧逐字节相同，两遍各 1,509 动作，缓存命中 0 |
| 5 | 冻结正确（实验 2） | 通过 1,509/1,509 动作 |
| 6 | 特性清单 | 通过 1,384 素材，公开登记 1,222、排除 576 |
| 7 | 指令记录 | 通过 0 缺少、3 合法空图 |
| 8 | 实验 4、5、6 | 通过 2 种动态库：arm64 2,379,832 字节、x64 2,532,024 字节，各 28/28；实验 5 为 24/24，实验 6 的 2 倍组为 36/36 |
| 9 | 只读目录 | 通过 266 文件，变化 0 |
| 10 | Mac 验证 | 通过 1 轮 Mac 原生运行 |

## 本轮核对

- 纽约时间 2026-11-11 21:15:21 至 2026-11-12 02:34:48，耗时 5 小时 19 分 27 秒；`npm run mac` 退出码 0。
- 冻结截图：本轮 8,722 帧中 2 次 8,712 帧、3 次 10 帧；目录另有 16 条旧元数据缺截图次数。
- 活图截图：2 次 8,385 帧、3 次 308 帧、4 次 29 帧。
- 8,716 到 8,722 的增量来自 3 个合法空图，各恢复 0 毫秒的 1x、2x 帧：`extra/hidden-element`、`extra/horizontal-line-no-stroke`、`tests/structure/svg/no-children`。其余 1,506 动作的时间表与周期相同。
- 素材登记的 `重新筛选已有登记` 为 0；`systemLanguage` 排除 16 项，清单未知待决 0。
- 报告合计 14,301,193 字节。`Chrome自己的差.json` 保留原汇总、运行证据、错误及两组帧数；逐帧明细在 `out/mac/noise/报告/自身差/结果.json`，完整日志在 `out/mac/运行日志.txt`。
- 自动归档的 6 个文件与已提交版本逐字节相同，已清理；旧生成对照样例 3 个文件从报告中移除，可从 `d96358f` 恢复。
- 补充检查命令：`node --check 实验/capture/timing-probe.mjs`、暂存后 `npm run check:wording`。

本轮命令：

```sh
export SVG_RENDER_CACHE=/private/tmp/svg-render-mac-cache SVG_RENDER_JOBS=1
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 NUMEXPR_NUM_THREADS=1
nice -n 10 npm run mac
```

## 下一步与执行人

- 本轮全量与报告整理结束，当前无需用户操作。
- Claude 的计时探针和提速建议见 [`实验记录/full-run-speedup.md`](实验记录/full-run-speedup.md)；简短总结见 [`实验记录/mac-full-run-review.md`](实验记录/mac-full-run-review.md)。
- 下一次本来就需要全量时，由接手的编码代理按提速方案实施并做定向复核，随后跑全量；这一轮结束后不为提速另跑一遍。
- 改动工具指纹文件或重编 Skia 后，重跑实验 5；24 份指令指纹不变、像素 24/24 时更新 `实验/micro/calibration.json` 的文件指纹。
- 结果异常时先做单素材、单帧对照；原因一小时内未查明，交最小复现给 Claude。
