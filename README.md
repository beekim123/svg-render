# svg-render：阶段 0

让游戏直接画 SVG，画得和固定版本的 Chrome 一样。这个分支做参照、对照、素材扫描和可行性实验，不写阶段 1 的编译器和运行时。

## 先读

| 文件 | 是什么 |
|---|---|
| [`AGENTS.md`](AGENTS.md) | **写代码、写报告的规矩**。编码代理开工前必读 |
| [`HANDOFF.md`](HANDOFF.md) | 现在做到哪、下一步做什么、已经定下的事 |
| [`docs/阶段0-需求.md`](docs/阶段0-需求.md) | 阶段 0 需求（只读） |

## 只用 Mac

开发、参照、验收都在用户的 M3 Mac 上做，不用 Linux（2026-11-11 用户定）。

```sh
export SVG_RENDER_CACHE=/private/tmp/svg-render-mac-cache   # 不设时默认 ~/Library/Caches/svg-render/
export SVG_RENDER_JOBS=1
nice -n 10 npm run mac
```

`npm run mac` 一条命令跑完：检查环境 → 下载、编译（有缓存就复用）→ 实验 5、6 → 素材登记和扫描 → 参照 → Chrome 自己的差 → 完整验收。结果写进 `报告/mac/`，第一行记提交号。中断后再跑会接着跑。`out/` 不提交。

## 常用命令

| 命令 | 做什么 |
|---|---|
| `npm run ref -- --id <素材id>` | 出参照（冻结图、活图、值表、指令），默认全部素材 |
| `npm run ref:repeat -- --全部` | 实验 1：新进程出两遍，逐字节比 |
| `npm run ref:noise` | Chrome 自己的差：复用正式 CPU 参照，新出 GPU 冻结图 |
| `npm run compare -- 甲.png 乙.png --线 静止 --报告 out/报告/对照` | 比两张图或两个目录 |
| `npm run experiment:5` / `npm run experiment:6` | 微场景、文字转轮廓 |
| `npm run check` | 10 项验收；加 `-- --全部` 跑完整重复性 |
| `npm run check:wording` | 用词检查（见 `AGENTS.md`） |

各工具的回归在 `tools/**/check-*.mjs` 和 `实验/**/check-*.mjs`，改了哪里就跑哪里。

## 目录规矩

- `docs/`、`素材/源文件/`、`素材/字体/`、`素材/试验图/`、`参考/` 只读。
- `报告/` 放要人看的汇总，合计不超过 20 MB；`out/` 是生成物。
- 只在 `stage-0` 上工作，不合并 `main`。
