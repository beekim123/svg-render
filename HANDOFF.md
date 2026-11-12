# 交接

> 2026-11-12。方向、判法、阈值由 Claude 定，先读 AGENTS.md。进度只写本文件。

## 当前

- 分支 stage-1；A 已完成并推送，B 起步源码随本轮提交推送。
- A0：118 件、126 染色变体、241 个动作、7522 帧及值表；来源 gemcard-demo a66b9ce 工作区。
- A1、A2：场景导出与 Skia 绘制各 7522/7522。
- A3：整图静止线 118/118 件、7522/7522 帧通过，出错 0，最低 SSIM 0.9956843486887914。
- A 报告：`报告/阶段1A/index.html`；完整指标在 `out/mac/新画法/compare/结果.json`。
- 版本库内报告 19,925,701 字节；A 结果 JSON 17,289 字节。旧原生合成诊断和 `docs/v2/status.md` 已删。
- B 已生成 118 件、126 变体、241 动作的分层包；完整截图计划覆盖 7522 帧。
- Godot 网格：118 件待机，点击切动作；最终 10.016621 秒 601 帧，平均 60.0003 FPS；预览 `out/mac/新画法/layers/grid.png`。
- B 定向运动线：5 件、6 变体，440/580 帧通过，140 未过，出错 0；最低 SSIM 0.47987150822042957。B 全量图像对照尚未执行。
- 其中 gem_red_cut 30/30 通过；card_art_mirror 两染色 31/64、32/64，fx_rainbow 17/44，mon_lock 263/284，ui_heart 67/94。
- B 报告：`out/mac/新画法/layers/compare/index.html`；`结果.json` 保存全部已测帧指标，各来源子目录保存两图与差异。
- 阶段：A 技术验证完成；B 起步可运行，运动线待修；用户验收未进行，未接 C。

## A 的判法（Claude，2026-11-12）

- A 比整图参照 `ref-img/`；原页面参照 `ref/` 带 Chrome 合成层，留给 B 运动线。复现 `实验/capture/img-ref-probe.mjs`。`tools/ref/page.mjs` 改动影响的校准凭据，下次全量验收时重签。

## B 已实现

- 动画节点保层，按节点号绑定；静态连续段用 Skia 画一次，保留负坐标原点、静态祖先、裁剪与组透明度。
- Godot 用 20ms 完整局部矩阵表做变换插值，透明度线性插值；GPU SubViewport 隔离组合成，截图保存前还原 straight alpha。
- 已修：染色遗漏、250ms 动作补真实终点、ui_heart/gain 奇异隐藏首帧改用 50ms 烘焙、纯旋转系数插值缩小。
- 定向检查通过：A 默认导出、B 分层/编译/变体目录、Godot 插值/alpha/118 件装载及点击；独立代码复核完成。
- `tools/layers/run.mjs` 每次启动前重新识别内屏；本轮只有内屏，Godot 编号 0，原点 (0,0)，3600×2338。多屏匹配尚未实测。

## Claude 定：B 的采样与纹理（2026-11-12）

阈值不改。三条都是离线改，播放器只做查表和插值。新代码放 `tools/layers/`，不动 `tools/ref/`（在工具指纹里）。

**1. 关键时刻补进表（答第 1 条）**
- 每个动画的每个关键帧时刻都要有样本：`delay + (迭代 + offset) × duration`，再加开始和结束时刻。用 `document.getAnimations()` 和 `effect.getKeyframes()` 读出来，在 Chrome 里 seek 取值。
- `times` 改成不等间距。播放器用二分查找找相邻两点，删掉 `/ 20.0` 的下标算法。

**2. 按误差加密（答第 2 条）**
- 在 20 毫秒网格和关键时刻的基础上，每个区间取中点，在 Chrome 里 seek 出真值，和播放器的插值结果比。
- 误差：层纹理矩形 4 个角在 2 倍输出下的位置差，超过 0.25 像素就对半分，透明度差超过 1/255 也分。最短 1 毫秒。
- 离线检查和播放器必须用同一种插值。插值写成一个公式，JS 和 GDScript 各写一份，加一个小检查保证两边结果相同。
- 批量做完把每件的样本数写进 HANDOFF 一行（最多、中位数）。

**3. 纹理在输出像素网格上画（答第 3 条）**
- 原因：现在纹理画在动画节点的局部坐标里，静止祖先的旋转留到 Godot 里再转，每帧都会重新采样。
- 改法：每层纹理按「静止姿态」的完整设备矩阵（含所有祖先，含输出倍率）由 Skia 直接画，小数位移也画进去，纹理放在整数像素上。
- 静止姿态：把动画全部去掉后的 SVG。某层在静止姿态下矩阵不可逆（比如 scale(0)）时，改用全部样本里缩放最大的那一刻。
- 运行时每层的变换 = `D父(t)⁻¹ · D自己(t)`，其中 `D(t) = M(t) · M(静止)⁻¹`。这个相对量离线算好写进表，Godot 直接设。静止那一刻 D 是单位矩阵，纹理和输出像素一一对应。
- 合成用的 SubViewport（裁剪、组透明度）也一样：放在父层的静止设备空间里，大小按静止姿态的设备包围盒。
- 倍率：2 × 该层所有动作里 D 的最大缩放，限在 1–2 之间，向上取到 0.25 的倍数。
- 一个染色变体一套纹理，各动作共用，不按动作重画。

**验证顺序**
1. 先看上面三帧单帧过运动线：`mon_lock/attack/250@1x`、`fx_rainbow/play/50@2x`、`card_art_mirror@3FE3F0/待机/0@2x`。
2. 再跑那 5 件定向对照，目标 580/580。
3. B 结束时跑全量运动线。还有不过的，列帧和原因写到下面。

## 现在做

1. 按上面三条改 B，按验证顺序跑。
2. B 全量过运动线后，在 HANDOFF 写帧率和纹理总大小（MB），然后停下等用户看演示。
3. C 接 gemcard-demo 并留精灵图开关；开始 C 前问用户。

## 命令

- A 整图：`node tools/scene/img-ref.mjs`；A 对照：`node tools/scene/batch.mjs compare --ref out/mac/新画法/ref-img`。
- B 导出：`node tools/layers/batch.mjs --id 新画法/素材名`；无 id 生成全部。演示：`node tools/layers/run.mjs`。
- B 计划：`node tools/layers/capture.mjs --id 新画法/素材名 --time 时刻 --scale 倍率`；均可省略，可重复筛选。
- B 截图：`node tools/layers/run.mjs -- --plan "$PWD/out/mac/新画法/layers/capture-plan.json"`；对照：`node tools/layers/compare.mjs`。
- 缓存：`SVG_RENDER_CACHE=/private/tmp/svg-render-mac-cache`；计算 1 worker，数值库线程 1。仅跑与改动有关的最小检查。

## 要 Claude 定的事

（GPT 填，一条一行）
