# svg-render：阶段0

让游戏直接画SVG，画得和固定Chrome一样。这一分支只实现参照、对照、资产扫描和可行性实验，不写阶段1编译器/运行时。

## 当前状态

**阶段0尚未验收，不能合并main。** Linux已验证纯JS对照工具、Skia原生/WASM构建及28能力模式、24张微场景Skia输出。云端执行环境不允许Chrome所需socket，Chrome冻结图、指令校准、重复性、GPU差、文字轮廓像素对照均未完成。Mac完全未验证。详见[HANDOFF.md](HANDOFF.md)和[报告](报告/)。

## Linux安装

Node>=22、Python3、NumPy/Pillow、git、curl、unzip。首次下载已按用户许可进行，依赖全部固定版本。

```sh
export SVG_RENDER_CACHE=/workspace/shared/svg-render-cache
npm ci --ignore-scripts --cache "$SVG_RENDER_CACHE/npm"
npm run setup
npm run build:skia -- linux-x64
npm run link:skia -- linux-x64
npm run build:skia -- wasm
npm run link:skia -- wasm
```

其他Linux机器可以不设环境变量，默认缓存为`~/.cache/svg-render/`。下载和构建都在仓库外缓存，重复运行复用已完成内容；不要使用系统Chrome替代固定157.0.8103.50。

## Mac首次试跑

在M3 Mac拉取stage-0，运行：

```sh
git switch stage-0
git pull --ff-only
npm run mac
```

开头检查Xcode命令行工具、Node、Python及其包，缺项打印命令并停下，不用sudo。随后自动安装固定npm依赖，下载mac-arm64 Chrome、Skia、GN/Ninja和resvg；缓存默认`~/Library/Caches/svg-render/`。先做两架构Skia和最重要的微场景，再继续其他工具。超过8MB或微场景需要查因会停止后续步骤，并在最后报告。

**这次是首次验证，不承诺整套全绿。** 实验5实际指令仍待校准，Linux参照尚缺。缺任何数据都写成未完成，绝不当作通过。结果写`报告/mac/`，第一项记录代码提交。请只提交推送`报告/mac/`到stage-0，`out/`不要提交。Mac产生的两个动态库都要≤6,000,000字节；超过8,000,000字节按需求停下问。

## 日常命令

- `npm run register`：登记本地158素材与动作；尚未由Chrome分类的stay动作保留待验证。
- `npm run scan`：用固定Chrome DOM/CSSOM扫描；公开集筛选见tools/scan/说明。
- `npm run ref`：全清单冻结图、活图、20ms值表、指令、冻结复核，输出out/linux或out/mac。
- `npm run ref:repeat -- --全部`：新进程重出两遍逐字节比对。
- `npm run ref:noise`：Chrome自身差，没有质量及格线。
- `npm run compare -- 甲.png 乙.png --线 静止 --报告 out/报告/对照`。
- `npm run experiment:5 -- --skia-only`：仅验证24张Skia图，不是实验5通过。
- `npm run experiment:5`、`npm run experiment:6`：完整微场景和文字实验。
- `npm run check`：10项聚合验收；`-- --全部`完整重复性模式。缺Mac报告或未满足条件会失败。
- `npm run check:compare -- --4k`、`npm run check:ref`、`npm run check:scan`、`npm run check:readonly`：独立工具测试。
- `node tools/check/index.mjs --离线`：明确不启动Chrome的诊断，环境项失败，因此不会宣称验收通过。

Linux/Mac像素差用`node tools/ref/audit.mjs cross --linux <Linux参照目录> --mac out/mac/ref --out out/mac/报告/Linux对Mac`。不套静止帧及格线。Mac一键入口默认寻找out/linux/ref，也可设SVG_RENDER_LINUX_REF指向用户已传输的Linux参照。

## 规矩和目录

- docs/、素材/源文件/、素材/字体/、素材/试验图/、参考/保持原样；235个文件SHA256校验通过。用户仅另外许可写素材/清单.json和素材/清单补充/。
- 报告/放可读汇总（当前远少于20MB），out/放生成物不提交。
- 所有工作仅stage-0；不得合并main。
- 设计和验收依据：docs/阶段0-需求.md、docs/设计.md、docs/阶段计划.md。
