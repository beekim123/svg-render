# 交接

> 2026-11-12。方向、判法、阈值由 Claude 定；先读 AGENTS.md，进度只写本文件。

## 当前

- 分支 stage-1。A 技术验证完成：118/118 件、7522/7522 帧，最低 SSIM 0.9956843486887914；用户验收未进行。
- A 报告 `报告/阶段1A/index.html`；版本库内报告 19,989,325 字节。旧原生合成诊断和 `docs/v2/status.md` 已删。
- B 范围118件、126变体、241动作、7522参照帧；正式纹理倍率上限保持2，Lanczos3不动。
- Chrome运动自差基准7522帧已生成：`out/mac/新画法/layers/motion-baseline.json`，只比ref/live，没有启动Chrome。
- 五件定向580帧：普通通过578、2倍上限2、失败0、出错0；上限是ui_heart/gain的279.0587和350毫秒2倍帧。
- 当前正在导出全部共享纹理，之后按顺序做7522帧Godot截图和全量运动线。最终帧率、纹理MB与全118件样本统计待记录。

## A 的判法（Claude）

- A 比 Chrome 整图参照 `ref-img/`；页面参照 `ref/` 带合成层，留给 B 运动线；阈值保持原值。
- 对原参照7439/7522，差别来自Chrome合成层；复现 `实验/capture/img-ref-probe.mjs`。
- `tools/ref/page.mjs` 改动影响的校准凭据，下次全量验收重签。本轮不动 `tools/ref/`。

## Claude 定：B 的采样与纹理

- 离线从 `document.getAnimations()` / `effect.getKeyframes()` 补关键点、开始结束时刻及触发前环境动画相位；20ms网格加关键点，播放器二分查不等间距times。
- 区间中点seek真值；2倍输出下最终纹理/合成矩形四角误差>0.25px或alpha误差>1/255则二分，最短1ms。JS/GDScript同一显式插值公式，36组检查已过。
- 静止姿态为去动画原SVG，完整参考R含祖先和小数位移；R不可逆时选全部样本中最大缩放的可逆姿态。
- Skia按R直接画在整数像素网格；每染色变体一套纹理跨动作共用；倍率2×D最大缩放，限1–2并向上取0.25，缩放取最大奇异值。
- D=M·R⁻¹，离线写D父⁻¹·D自己；父奇异时用等价R父·局部矩阵·R自己⁻¹。保留默认alpha和零缩放层几何。
- SubViewport与裁剪处于静止设备坐标系；用户已允许无裁剪组用运动包围盒并集，有裁剪组按遮罩。
- GPU预乘空间重采样：缩小双线性、旋转/放大Lanczos3、整数中心直取；截图保存前还原straight alpha。

## Claude 定：剩余 29 帧（2倍上限不变）

- Chrome live对ref，原29帧中27帧也不过运动线；Godot有26帧比Chrome live更接近ref，原因同为纹理变换重采样。
- 运动线加逐帧Chrome自差基准：ref对live全7522帧生成JSON；共用GPU计算路径但运动只放宽、不收紧，阈值.json不改。
- SSIM=max(0.95,min(原SSIM,1-(1-自差SSIM)×1.2))；其余三指标=max(原阈值,自差×1.2)，原最大块先按输出倍率平方缩放，基准不二次缩放；GPU旧行为不变。
- 分类「2倍上限」：真实可见输出层D>1且纹理密度2被放大，只剩SSIM未过；目前仅自动归类Claude已确认的ui_heart/gain/279.0587@2x与350@2x，其余新未过帧计失败、列原因。
- 报告保留每帧原指标和通过布尔，另列上限数量；上限不计失败。指定基准缺帧时直接报实际key。
- 专项检查已过：只放宽、0.95下限、2倍块面积、GPU不变、完整路径/区域查表、基准缺帧、未知帧不误归类上限。

## 现在做（当前 Codex）

1. 580定向已满足：578普通通过+2上限，失败0。
2. 导出全部共享纹理后，跑B全量运动线；未过帧和原因写到下面。
3. 全量满足当前判法后记录帧率、纹理总MB、118件样本数（最多、中位数）及上限帧数，再停下等用户看演示。
4. 不再加密度、不换滤镜；性能留以后优化。C接gemcard-demo并留精灵图开关，开始C前问用户。

## 命令

- 缓存 `SVG_RENDER_CACHE=/private/tmp/svg-render-mac-cache`；计算1 worker，数值库线程1；窗口每次由run.mjs重新识别内屏。
- 基准 `node tools/layers/motion-baseline.mjs`（只读ref/live，不开Chrome）；通用对照新增 `--运动基准 基准.json`。
- 导出 `node tools/layers/batch.mjs --id 新画法/素材名`；省略id生成全部。演示 `node tools/layers/run.mjs`。
- 计划 `node tools/layers/capture.mjs --id 新画法/素材名 --time 时刻 --scale 倍率`；均可省略或重复。
- 截图 `node tools/layers/run.mjs -- --plan "$PWD/out/mac/新画法/layers/capture-plan.json"`；对照 `node tools/layers/compare.mjs --运动基准 out/mac/新画法/layers/motion-baseline.json`。
- B报告 `out/mac/新画法/layers/compare/index.html`，总表不嵌全部图，各来源子目录保存两图和差异。

## 要 Claude 定的事

（暂无）
