# 交接

> 2026-11-12。方向、判法、阈值由 Claude 定，先读 AGENTS.md。

## 当前

- 分支 stage-1，起点 stage-0 的 309f309；每完成一步提交并推送 stage-1。
- A0 完成：118 件、126 染色变体、241 个参照动作、7522 帧及值表。来源 gemcard-demo a66b9ce 工作区，含 08、09 包 17 件返修，记在 素材/新画法/来源.json。
- A1 导出 7522/7522，A2 绘制 7522/7522。
- A3 对原参照：111/118 件、7439/7522 帧过静止线；7 件 83 帧未过，全是 1 倍。

## Claude 复核结论（2026-11-12）

**Skia 画对了，83 帧的差别来自 Chrome 页面的合成层，不是 SVG 本身。**

- 证据：同一张冻结 SVG，放进 `<img>` 让 Chrome 整张一次栅格（不拆合成层），和我们的 Skia 图比：7 件代表帧 SSIM 0.999–1.000，不算边大差 0；fx_kill 逐像素相同。
- 同一张 `<img>` 图和原参照比：0.981–0.997，正好就是 A3 的那个差。
- 删掉冻结 SVG 里的动画规则，合成层数不变，差也不变，所以和动画无关。
- 复现脚本：`实验/capture/img-ref-probe.mjs`。

**判法（Claude 定）：**

1. A 的静止线改比「整图参照」：Chrome 把冻结 SVG 当 `<img>` 画出来的图。
2. 不把 compositor 分块、栅格网格、采样写进 JSON 场景或 Skia。
3. 原参照（页面渲染，带合成层）留给 B 的运动线用。B 本来就是先把层画成纹理再变换，会有同类的软边。
4. 阈值不改。

## 现在做

1. 出整图参照：照 `实验/capture/img-ref-probe.mjs` 的做法，从 `out/mac/新画法/ref/` 的冻结 SVG 给全部 7522 帧出图，放 `out/mac/新画法/ref-img/`，同名，尺寸和原参照一致。只截图，不开活图页。
2. 用 `tools/scene/batch.mjs compare` 改比 ref-img（加个选项选参照目录），重出 `报告/阶段1A/`。
3. 118 件全过：A 完成。报告页写一行「对原参照 7439/7522，差别来自 Chrome 合成层，见 HANDOFF」。
4. 收尾：
   - 删 `docs/v2/status.md`。`docs/` 只读，进度只写 HANDOFF。
   - `报告/` 现在 35.8 MB，超 20 MB。`报告/阶段1A/结果.json`（10 MB）只留汇总和未过帧，逐帧数据留在 `out/`；删 `报告/阶段1A/原生合成/`。
   - `tools/ref/page.mjs` 改过，实验 5 校准凭据和工具指纹已失效。现在不重签，下次跑全量验收时一起重签。
5. A 过了直接开始 B，不用等 Claude。有要定的再写到下面。

## A 的命令

- 收素材：`node tools/art/receive-new.mjs`；刷新单件给 `--id`。
- 参照：`npm run ref -- --manifest 素材/新画法/清单.json --out out/mac/新画法 --concurrency 1`。
- 编译：`node tools/scene/build.mjs out/mac/scene`；绘制：`out/mac/scene/scene-draw 场景.json 倍率 输出.png`。
- 全量：`node tools/scene/batch.mjs export|draw|compare`，可加 `--id 新画法/素材名`。
- 缓存：`SVG_RENDER_CACHE=/private/tmp/svg-render-mac-cache`。

## 之后：B

- 每个有动画的元素切成一层；层里不动的内容用 Skia 画一次，变成纹理。
- Godot 每帧只按值表改每层的变换和透明度，不重画。值表用 `out/mac/新画法/values/`，按 20 毫秒采样插值，先不做时间线求值器。
- 裁剪路径常包着会动的部件：层合成时要带上裁剪。
- 演示工程：118 件排成网格播待机，点一下切动作。记录帧率。
- 对照：Godot 离屏截图和原参照（带合成层的那份）比，用运动线。
- C 接 gemcard-demo 并留精灵图开关；开始 C 前问用户。

## 要 Claude 定的事

（GPT 填，一条一行）
