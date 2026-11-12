# 交接

> 2026-11-12。方向、判法、阈值由 Claude 定，先读 AGENTS.md。进度只写本文件。

## 当前

- 分支 stage-1；本轮提交在本地。自动审批拒绝推送 origin/stage-1，需用户明确授权远程目标及本轮提交后再推。
- A0：118 件、126 染色变体、241 个动作、7522 帧及 20 毫秒值表；来源 gemcard-demo a66b9ce 工作区。
- A1、A2：场景导出与 Skia 绘制各 7522/7522。
- A3 完成：整图参照 7522/7522；静止线 118/118 件、7522/7522 帧通过，出错 0，最低 SSIM 0.9956843486887914。
- 报告：`报告/阶段1A/index.html`；完整逐帧指标在 `out/mac/新画法/compare/结果.json`。
- 版本库内报告合计 19,925,701 字节；结果 JSON 17,289 字节。已删旧原生合成诊断和 `docs/v2/status.md`。
- 当前阶段 B：A 技术验证完成；用户验收未进行；B 分层导出与 Godot 播放器正在实现。

## Claude 复核结论（2026-11-12）

- Skia 画对了，原参照的 83 帧差别来自 Chrome 页面合成层；同一冻结 SVG 用 `<img>` 整张栅格后，7 件代表帧 SSIM 0.999–1.000，不算边大差 0。
- A 静止线比 Chrome 整图参照 `ref-img/`；阈值保持原值。不把 compositor 分块、栅格网格和采样写入 JSON 场景或 Skia。
- 对原参照 7439/7522，差别来自 Chrome 合成层；原页面参照 `ref/` 留给 B 的运动线。
- 复现脚本：`实验/capture/img-ref-probe.mjs`。
- `tools/ref/page.mjs` 变动导致实验 5 校准凭据和工具指纹失效；下次全量验收一起重签。

## 现在做：B（当前 Codex 执行）

1. 每个动画节点保留一层，静态连续内容用 Skia 绘一次成纹理；先用带裁剪扫光的 `gem_red_cut` 跑通。
2. 保留匿名节点号、嵌套变换、组透明度、父级裁剪。纹理记录本地绘制范围及原点，保留负坐标内容。
3. Godot 按 `values/` 的 20 毫秒采样插值，只改变换和透明度；完整局部矩阵已含枢轴，不另加转轴。
4. 241 个动作、1599 轨只含 transform/opacity；按轨属性中性化烘焙，保留其余静态属性。
5. 演示工程排 118 件网格播待机，点击切动作，记录帧率；图形测试先重新识别内屏。
6. Godot 离屏截图比原页面参照，用运动线；有判法、方向或阈值问题交 Claude。
7. C 接 gemcard-demo 并留精灵图开关；开始 C 前问用户。

## A 的命令

- 整图参照：`node tools/scene/img-ref.mjs`，可加 `--id 新画法/素材名`。
- 对照：`node tools/scene/batch.mjs compare --ref out/mac/新画法/ref-img`。
- 定向检查：`node tools/scene/check-img-ref.mjs`、`node tools/scene/check-report.mjs`。
- 编译：`node tools/scene/build.mjs out/mac/scene`；绘制：`out/mac/scene/scene-draw 场景.json 倍率 输出.png`。
- 缓存：`SVG_RENDER_CACHE=/private/tmp/svg-render-mac-cache`；计算只开 1 worker，数值库线程为 1。

## 要 Claude 定的事

（暂无）
