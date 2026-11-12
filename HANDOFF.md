# 交接

> 2026-11-12。方向、判法、阈值由 Claude 定；先读 AGENTS.md，进度只写本文件。

## 当前

- 分支 stage-1。A 技术验证完成：118/118 件、7522/7522 帧，最低 SSIM 0.9956843486887914；用户验收未进行。
- A 报告 `报告/阶段1A/index.html`；版本库内报告 19,925,701 字节。旧原生合成诊断和 `docs/v2/status.md` 已删。
- B 范围 118 件、126 染色变体、241 动作、7522 个参照帧，来源 gemcard-demo a66b9ce 工作区。
- 本轮改造已通过三帧：mon_lock/attack/250@1x SSIM 0.983309；fx_rainbow/play/50@2x 0.986148；card_art_mirror@3FE3F0/待机/0@2x 0.999660。
- 第二步定向对照 551/580，剩 29 帧全部 2 倍；正在诊断重采样/密度。全量运动线尚未执行。

## A 的判法（Claude）

- A 比 Chrome 整图参照 `ref-img/`；页面参照 `ref/` 带合成层，留给 B 运动线；阈值保持原值。
- 对原参照 7439/7522，差别来自 Chrome 合成层；复现 `实验/capture/img-ref-probe.mjs`。
- `tools/ref/page.mjs` 改动影响的校准凭据，下次全量验收重签。本轮不动 `tools/ref/`。

## Claude 定：B 的采样与纹理（2026-11-12）

- 阈值不改，三条均离线完成；新工具放 `tools/layers/`，播放器只查表、插值和合成纹理。
- 关键时刻：用 `document.getAnimations()` / `effect.getKeyframes()` 取 `delay + (迭代 + offset) × duration` 及开始、结束时刻，在 Chrome seek 真值；包括动作触发前环境动画的相位。
- 基于 20ms 网格加关键点；`times` 为不等间距，播放器二分查相邻点，删除 `/20` 下标算法。
- 每区间取中点真实值，对比播放器插值：2 倍输出下实际层纹理矩形四角位置误差 >0.25px 或透明度误差 >1/255 则二分，最短 1ms。
- JS/GDScript 用同一显式变换分解与插值公式，小检查逐分量核对；最终实际纹理/合成矩形改变后重新检查采样。批量完成记每件样本数的最多、中位数。
- 静止姿态为去掉全部动画的原 SVG；每层完整参考矩阵 R 含静态祖先和小数位移。R 不可逆时，选全部样本中缩放最大的可逆姿态。
- Skia 按参考完整设备矩阵直接画，纹理边界落整数像素；每染色变体一套纹理，所有动作共用。
- `D(t)=M(t)·R⁻¹`，相对变换离线算 `D父⁻¹·D自己`；父奇异时用严格等价的 `R父·局部矩阵(t)·R自己⁻¹`，Godot 直接赋表值。
- SubViewport 和裁剪也在静止设备坐标系；用户本轮已允许无裁剪组用全部样本运动包围盒并集，避免切掉下落碎片；有裁剪组按遮罩范围。
- 每层倍率 `2 × 所有动作 D 的最大缩放`，限 1–2，向上取 0.25 的倍数。缩放取最大奇异值。

## 本轮已实现

- 离线关键点/相位读取、四角误差加密、不等间距表、JS/GDScript 共用公式及设备空间共享纹理已接入。
- 去动画姿态保留所有动画节点；每动作读取真实默认透明度；scale(0) 父层保持子局部矩阵，不丢几何。
- GPU 在预乘空间做重采样，缩小用双线性、旋转/放大用 Lanczos3，像素一一对应时直取；截图保存前还原 straight alpha。
- 最小检查已过：Chrome 关键时刻与静止姿态；36 组 JS/Godot 插值；设备矩阵、整数像素、小数位移和奇异父姿态；加密手算样例。
- 演示仍为 118 件网格待机，点击切动作；`run.mjs` 每次启动前重新识别内屏。当前仅内屏，Godot 0、原点 (0,0)、3600×2338；多屏匹配尚未实测。

## 验证顺序与现在做（当前 Codex 执行）

1. 指定三帧运动线已 3/3 通过。
2. 五件定向：gem_red_cut、ui_heart、mon_lock、fx_rainbow、card_art_mirror 两染色，目标 580/580；目前 551/580，未达到进入全量的条件。
3. 第二步通过后导出全部共享纹理，在 B 里程碑结束跑一次全量运动线；未过帧和原因写在下面。
4. 全量通过后记录帧率、纹理总大小（MB）、每件样本数的最多和中位数，再停下等用户看演示。
5. C 接 gemcard-demo 并留精灵图开关；开始 C 前问用户。

## 命令

- 缓存 `SVG_RENDER_CACHE=/private/tmp/svg-render-mac-cache`；计算 1 worker，数值库线程 1。
- 导出 `node tools/layers/batch.mjs --id 新画法/素材名`；省略 id 生成全部。演示 `node tools/layers/run.mjs`。
- 计划 `node tools/layers/capture.mjs --id 新画法/素材名 --time 时刻 --scale 倍率`；均可省略或重复筛选。
- 截图 `node tools/layers/run.mjs -- --plan "$PWD/out/mac/新画法/layers/capture-plan.json"`；对照 `node tools/layers/compare.mjs`。
- B 报告 `out/mac/新画法/layers/compare/index.html`；各来源子目录保存两图与差异，总表不嵌全部图。

## 要 Claude 定的事

（暂无）
