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

## Claude 复核结论（A，2026-11-12）

- Skia 画对了；原参照 83 帧的差别来自 Chrome 页面合成层。同一冻结 SVG 用 `<img>` 整张栅格后，7 件代表帧 SSIM 0.999–1.000。
- A 比整图参照 `ref-img/`，阈值不改；不把 compositor 分块、栅格网格和采样写入场景或 Skia。
- 对原参照 7439/7522，差别来自 Chrome 合成层；原页面参照 `ref/` 留给 B 运动线。
- 复现：`实验/capture/img-ref-probe.mjs`。`tools/ref/page.mjs` 对实验 5 校准凭据和工具指纹的影响，下次全量验收一起重签。

## B 已实现

- 动画节点保层，按节点号绑定；静态连续段用 Skia 画一次，保留负坐标原点、静态祖先、裁剪与组透明度。
- Godot 用 20ms 完整局部矩阵表做变换插值，透明度线性插值；GPU SubViewport 隔离组合成，截图保存前还原 straight alpha。
- 已修：染色遗漏、250ms 动作补真实终点、ui_heart/gain 奇异隐藏首帧改用 50ms 烘焙、纯旋转系数插值缩小。
- 定向检查通过：A 默认导出、B 分层/编译/变体目录、Godot 插值/alpha/118 件装载及点击；独立代码复核完成。
- `tools/layers/run.mjs` 每次启动前重新识别内屏；本轮只有内屏，Godot 编号 0，原点 (0,0)，3600×2338。多屏匹配尚未实测。

## 现在做

1. 用户在 Claude 的 svg-render 项目聊天发送：`拉 stage-1，读 HANDOFF.md「要 Claude 定的事」，确定 B 的离线采样和纹理坐标/倍率方案，阈值不改。`
2. Claude 定方案后，把结论带回本 Codex 聊天；由当前 Codex 修 B，先验对应单帧，再在 B 里程碑结束跑全量运动线。
3. C 接 gemcard-demo 并留精灵图开关；开始 C 前问用户。

## 命令

- A 整图：`node tools/scene/img-ref.mjs`；A 对照：`node tools/scene/batch.mjs compare --ref out/mac/新画法/ref-img`。
- B 导出：`node tools/layers/batch.mjs --id 新画法/素材名`；无 id 生成全部。演示：`node tools/layers/run.mjs`。
- B 计划：`node tools/layers/capture.mjs --id 新画法/素材名 --time 时刻 --scale 倍率`；均可省略，可重复筛选。
- B 截图：`node tools/layers/run.mjs -- --plan "$PWD/out/mac/新画法/layers/capture-plan.json"`；对照：`node tools/layers/compare.mjs`。
- 缓存：`SVG_RENDER_CACHE=/private/tmp/svg-render-mac-cache`；计算 1 worker，数值库线程 1。仅跑与改动有关的最小检查。

## 要 Claude 定的事

- 固定 20ms 表会错过动作尖点：mon_lock/attack 250ms、die 150ms 在相邻样本之间，锁梁偏位约 9/14px；是否离线补 CSS 关键时刻？补表后播放器也须按 times 找相邻点。
- 快速曲线仍有采样误差：fx_rainbow/play 50ms 原旋转 -49.19°，40/60ms 插值约 -50.36°；当前 SSIM 0.586968。是否对高曲率区间离线加密采样？
- 2 倍纹理偏软：card_art_mirror@3FE3F0/待机/0@2x 仅 SSIM 0.976538 未达 0.985；当前层纹理 2 倍，静态祖先旋转仍运行时采样。定纹理坐标或倍率，阈值保持原值。
- 两图都在 `out/mac/新画法/ref/` 与 `godot/` 下，同名：`新画法/mon_lock/attack/250@1x.png`、`新画法/fx_rainbow/play/50@2x.png`、`新画法/card_art_mirror@3FE3F0/待机/0@2x.png`。
- 单帧复现：`npm run compare -- 原参照.png Godot.png --线 运动 --报告 /private/tmp/svg-render-b-frame`；实际图片路径见上一条。
