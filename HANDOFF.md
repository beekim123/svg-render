# 交接

> 2026-11-12。方向、判法、阈值由 Claude 定，先读 AGENTS.md。

## 当前

- 分支 stage-1，起点 stage-0 的 309f309；每个完成步骤提交并推送 stage-1。
- 阶段 0 已完成：Mac 全量验收 10/10，阈值.json 保持原值。
- A0 收素材已完成：118 SVG、218 个动作、8 件染色素材。
- 来源 gemcard-demo 提交 a66b9ce1f524a17a669c78afc64523192a0a7289 的工作区，含未提交新画法。
- 第 08 包 14 件、第 09 包 3 件返修已包含，来源记在 素材/新画法/来源.json。
- A0 完成：118 件、126 个染色变体、241 个参照动作、7522 帧及值表，全部通过；结果在 报告/阶段1A0/参照.json。
- A3 全量对照完成：111/118 件、7439/7522 帧过静止线；7 件 83 帧未过，全部为 1 倍，阈值未改。
- 当前为 A 技术候选；A 过线门槛未达，用户验收未进行，main 未合并。
- A1 场景导出完成：7522/7522 帧，结果在 out/mac/新画法/scene/；导出器定向夹具通过。
- A2 全量绘制完成：7522/7522 帧透明 PNG，结果在 out/mac/新画法/skia/。
- 报告：报告/阶段1A/index.html；最差 20 帧在前，可筛选全部帧；报告/阶段1A/未过线.json 含全部失败帧、原因、命令与代表两图。
- 未过素材：fx_kill、mon_portrait、mon_dragon、mon_box、mon_chest、mon_lock、mon_tree；原生合成例证在 报告/阶段1A/原生合成/。
- 原 main 未跟踪报告备份在 /private/tmp/svg-render-preserved-reports-20261112；非冲突文件已恢复，2 件不同文件留在备份。

## A0

1. 收 SVG 并转换清单：node tools/art/receive-new.mjs。
2. 固定 SVG_RENDER_CACHE=/private/tmp/svg-render-mac-cache。
3. npm run ref -- --manifest 素材/新画法/清单.json --out out/mac/新画法 --concurrency 1。
4. 全部参照帧、冻结 SVG、20 毫秒值表保留 out/mac/新画法；只处理这 118 件。
5. 来源刷新可给 receive-new.mjs 重复 --id，再给 ref 重复 --id 新画法/素材名。

## A

1. Chrome 读取冻结 SVG，导出 JSON 场景：绘制顺序、路径、完整矩阵、填充/描边、透明度、裁剪。
2. C++ 链接阶段 0 Skia，读取 JSON、按倍率绘透明 PNG；参照 实验/micro/draw.cpp。
3. 比较全部 1 倍、2 倍参照帧：npm run compare -- --线 静止。
4. 对照网页放 报告/阶段1A/，最差 20 帧在前；118 件全部过线，未过帧带原因交 Claude。
5. 支持形状、描边/虚线、纯色、线性/径向渐变、clipPath、pattern、fill-rule、变换和透明度；其他元素直接报名称。
6. 不做二进制格式、量化、包体、速度基准、Blink 对照表、动画求值。
7. 编译：node tools/scene/build.mjs out/mac/scene；实际绘制 CLI：out/mac/scene/scene-draw 场景.json 倍率 输出.png。
8. 全量依次运行 node tools/scene/batch.mjs export、draw、compare；可加 --id 新画法/素材名。
9. 未过线交接：node tools/scene/handoff.mjs；不重复运行无改动的全部比较。

## 后续

- B 在 A 过线后做：Godot 按动画元素分层，Skia 纹理缓存，值表插值更新变换/透明度并保留裁剪。
- B 演示 118 件网格待机、点切动作，截图对运动线、记录帧率。
- C 接 gemcard-demo 并留精灵图开关；开始 C 前问用户。
- 旧 82 + 35 件已退出目标，公开集排除项保持排除。

## 要 Claude 定的事

- fx_kill 的 Chrome 原生层已确认先栅格为独立位图再变换；当前直接矢量场景未复现此采样，其他 6 件的半透明组疑似同类。
- 请 Claude 确定原生 compositor 分块、栅格网格及采样如何进入 JSON 场景与 Skia 绘制；维持原阈值。
- 下一步由用户在 Claude 的 svg-render 项目聊天发送：`读 stage-1 的 AGENTS.md、HANDOFF.md 和 报告/阶段1A/未过线.json，确定 7 件半透明 SVG 组的 compositor 分块与采样方案；阈值不改。`
- Claude 定方案后，用户将结论贴回本 Codex 聊天；由当前代理继续修这 7 件并跑对应帧，更新报告及 stage-1。
