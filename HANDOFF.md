# 阶段 0 交接

> 2026-11-11，Claude 写给接手的编码代理（GPT）。先读 [`AGENTS.md`](AGENTS.md)。
> 更早的 Linux 检查点版本在 git 历史里（`a7c0423` 的 `HANDOFF.md`）。

## 现在在哪

- 检出：`/private/tmp/svg-render-mac-volume/svg-render`，分支 `stage-0`。这是一个区分大小写的临时卷，用前先 `mount | grep svg-render-mac-volume` 确认还挂着。
- 提交：`466d5e1` 是 GPT 首轮的 45 文件改动和报告；`4dadf7f` 是 Claude 的修复和用户定的判法；`8760465` 重签了实验 5 的校准凭据；之后一个提交加了本文件、`AGENTS.md` 和用词检查。
- **还没推送**。`origin` 是本机临时副本 `/private/tmp/svg-render-stage-0-mac`，不是 GitHub。推不推送，等用户说。
- 缓存：`/private/tmp/svg-render-mac-cache`（Chrome、Skia、公开测试集都在这里，已下载、已编译）。

## 已经定下的事（不要再问）

1. 实验 2 第 2 条（冻结图对活图）：原图相似度 ≥ 0.95，或两张图各做 σ=1 像素高斯模糊后 ≥ 0.95。见 `阈值.json` 的"冻结对活图"、`tools/ref/batch.mjs` 的 `freezeAgainstLive`。
2. 参照页关掉 Mac 字形平滑（`-webkit-font-smoothing:antialiased`），见 `参照版本.json` 的"页面样式"。
3. 截图连截到两次逐字节相同为止，最多 6 次，不扩视口；每帧 `.json` 记 `截图次数`。
4. 整个项目只用 Mac，不做 Linux 参照、Linux 对 Mac、Linux 版 Skia / WASM。
5. x64 动态库用 Rosetta 跑 28 模式探针。
6. 冻结策略 `value-only`；`systemLanguage` 不支持。

为什么这样定、证据在哪：`报告/mac-续验-a7c0423-20261111/Claude修复记录.md`。

## 已验证（定向复核，不是全量）

| 项目 | 结果 |
|---|---|
| 实验 1 漏画 | 原截图方式在正式流程顺序下 9 次坏 1 次；新方式 30 次 0 次。抽样 5 个素材 440 帧，冻结图和旧参照逐字节相同 |
| 实验 2 | fx_circle 修好（最低 0.988）；5 个问题素材 302 帧按新判法全部通过 |
| 实验 4 | arm64 2,379,832 字节、x64 2,532,024 字节；两种都 28/28 |
| 实验 5 | 24/24，校准凭据有效 |
| 实验 6 | 及格：2 倍最低 0.9923，位置差最大 0.028 |
| 空图 | 3 个合法空图出 0 层指令记录 |
| 断连 | 杀掉 Chrome 后 27 毫秒报错，批量出图会重开重试 |
| 回归 | `tools/**/check-*.mjs` 18 个全部通过 |

## 下一步：跑全量

```sh
cd /private/tmp/svg-render-mac-volume/svg-render
export SVG_RENDER_CACHE=/private/tmp/svg-render-mac-cache SVG_RENDER_JOBS=1
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 NUMEXPR_NUM_THREADS=1
nice -n 10 npm run mac
```

要出 4 遍全部素材（正式参照、GPU 参照、实验 1 两遍），机器忙时大约 4–5 小时。Claude 跑到"参照"那一步时停了，`out/mac/` 里有部分新产物，缓存会接着用。

跑完看这几样：

1. `报告/mac/验收.json` 十项。重点：实验 1 两遍 8,716 帧逐字节相同；覆盖 1,509/1,509 动作；第 7 项指令记录（含 3 个空图）。
2. 统计 `out/mac/ref/**/*.json` 的 `截图次数`：冻结图有多少帧截了 3 次以上，写一行进本文件。
3. `报告/素材登记.json` 会被重写。Claude 中途试跑时看到"重新筛选已有登记"清空、多出一批 `systemLanguage` 排除记录，像是正常结果，核对一下。
4. `npm run mac` 每次会把旧的 `报告/mac/` 复制到 `报告/mac-归档-<时间>/`。确认和已提交的内容相同后删掉，`报告/` 要在 20 MB 以内。
5. 把下面"验收"表填上实测结果，提交 `报告/mac/` 和本文件。

## 验收（全量后填）

| # | 检查 | 结果 |
|---|---|---|
| 1 | 环境 | |
| 2 | 对照工具自测 | |
| 3 | 覆盖 | |
| 4 | 可重复（实验 1） | |
| 5 | 冻结正确（实验 2） | |
| 6 | 特性清单 | |
| 7 | 指令记录 | |
| 8 | 实验 4、5、6 | |
| 9 | 只读目录 | |
| 10 | Mac 验证 | |

## 出问题怎么办

- 哪一步失败：在上表写"未通过"和一行原因。
- 原因一小时内查不出来：留下最小复现（素材、帧、命令、两张图），交给 Claude 诊断。
- 改了 `tools/chrome/index.mjs`、`tools/chrome/svg.mjs`、`tools/ref/index.mjs`、`tools/ref/page.mjs`、`tools/ref/verify.mjs`、`参照版本.json`、`实验/micro/` 下的文件、`实验/skia/chromium-config.h`，或重新编译了 Skia，实验 5 的校准凭据都会失效。处理办法：重跑实验 5，确认 24 份指令指纹不变、像素 24/24 后，只更新 `实验/micro/calibration.json` 的文件指纹（做法见 `8760465`）。
