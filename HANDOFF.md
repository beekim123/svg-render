# 交接

> 2026-11-12。方向、判法、阈值由 Claude 定；进度只写本文件。

## 当前

- 分支 stage-1。A 技术验证 118/118 件、7522/7522 帧，最低 SSIM 0.9956843486887914；用户验收未进行。
- B2 已接入 Godot GDExtension，链接阶段 0 Skia；118 件、126 变体、241 动作已导出运行时场景与原值表，原 869 张 PNG 退回路径保留。
- 指定单帧 3/3 过运动线；card_gem_bar/待机/0@1x 对 Skia 原生 1 倍 SSIM=1。relic_same4/待机/1250@2x、ui_heart/gain/279.0587@2x 均通过。
- 最终 143 帧质量模式复核：142 通过、1 失败、0 上限、0 出错，最低 SSIM 0.9833457581944102。报告 `out/mac/新画法/layers/b2-failure-compare/index.html`。
- 已修 ui_rule_sign/flip/200@1x 的零缩放细线：D、R 保留双精度，消除奇异矩阵的抵消残差；此件复核 4/4。
- 143 帧质量模式重画均值 0.833 ms、P95 3.485 ms、最大 8.082 ms；单层超过 8 ms 清单为空。逐帧/逐层数据 `out/mac/新画法/layers/b2-failure-plan.json.metrics.json`。
- 现停在 143 帧技术复核；本轮 7522 帧全量、118 件网格帧率/预算实测和用户演示验收均未开始。C 未开始。

## Claude 定：B2（阈值和 2 倍上限不改）

- 包含场景 JSON 与值表；原生绘制复用 `tools/scene/draw.cpp`，默认不加载层 PNG；`--renderer png` 可选择原路径。
- 按当前输出倍率在整数像素格生成静止缓存；D 为单位矩阵或整数像素平移（误差 <0.001 px）时 1:1 贴缓存，只变透明度时合成调制。
- 小数平移、旋转、缩放用精确矩阵重画到屏幕 1:1 纹理；裁剪组整组交 Skia，B2 无 SubViewport 遮罩。
- 实时模式全游戏帧共享 8 ms 重画预算，超出后余层退回缓存加变换；截图质量模式不限预算。逐层记录重画毫秒。
- 所有纹理密度不超过输出倍率，最高 2 倍；B2 未过帧计失败。`阈值.json` 保持原值。
- 原采样规则保留：20ms 网格加关键点，中点真值二分至最短 1ms，2 倍四角误差限 0.25px、alpha 限 1/255；播放器二分不等间距 times。
- R 为完整静止参考，奇异静止层沿用原选定可逆参考；相对量 D父⁻¹·D自己写表，运行时恢复完整 D·R。

## 验证顺序

1. 指定三个单帧（已通过）。
2. 143 帧按新判法复核（Claude 已测 143/143），再跑 7522 帧全量，比 `ref-img/`。
3. 网格演示 118 件待机，8 ms 预算；记录 FPS、每帧重画毫秒、退回次数和超过 8 ms 的层。
4. 然后停下等用户看演示；开始 C 接 gemcard-demo、保留精灵图开关前问用户。

## 命令

- 缓存 `SVG_RENDER_CACHE=/private/tmp/svg-render-mac-cache`；计算 1 worker、数值库线程 1；run.mjs 每次重新识别内屏。
- 构建 `node tools/layers/build-runtime.mjs`；本地绑定缓存 `godot-cpp-10.0.0-stable`，Godot 4.7.2，arm64。
- 导出 `node tools/layers/batch.mjs --runtime-only` 复用原值表/PNG；正常 batch 也写 runtime.json。
- 143 帧截图 `node tools/layers/run.mjs -- --plan "$PWD/out/mac/新画法/layers/b2-failure-plan.json"`。
- 对照 `node tools/layers/compare.mjs --plan out/mac/新画法/layers/b2-failure-plan.json --report out/mac/新画法/layers/b2-failure-compare`；参照目录改为 `ref-img/`，不加 `--运动基准`。
- 全量计划 `out/mac/新画法/layers/b2-capture-plan.json`（7522 帧）；演示 `node tools/layers/run.mjs`。
- 集成检查 `../gemcard-demo/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://check_runtime.gd`；JS 检查 `node tools/layers/check-runtime.mjs`、`node tools/layers/check-limit.mjs`。

## Claude 定：B2 的运动线改比整图参照（2026-11-12）

- 先认错：上轮我说 fx_kill/play/300@1x「加基准就过」是错的。公式取原线和自差 ×1.2 的较大值，自差比原线小时不放宽。GPT 的实测是对的。
- 原因：页面 `ref/` 带 Chrome 合成层（A 里那 83 帧同类）。当初 B 的运动线比 `ref/`，是因为旧 B 也是「纹理加变换」，和合成层同类。B2 每帧按精确矩阵画矢量，和 `ref-img/` 同类了。
- Claude 复核：`godot-b2/` 全部 143 帧对 `ref-img/`，运动线、不加基准，143/143 过，最低 SSIM 0.9955。
- **判法**：B2 的运动线比 `ref-img/`，阈值.json 原值，不加 Chrome 自差基准。`ref/` 和 `motion-baseline.json` 不再参与判定，文件留着不删。
- fx_kill/play/300@1x 按此判法通过，不单列。
- 全量 7522 帧照这个判法跑；不过的帧计失败，列帧和原因。

## 下一步与执行人

- GPT：按上面判法复核 143 → 全量 7522 → 网格 8 ms 预算实测，然后停下等用户看演示。
- 要 Claude 定的事写在下面，一条一行。

## 要 Claude 定的事

