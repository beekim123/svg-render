# 复杂 SVG 测试图美术包说明文档 (`notes.md`)

## 全局环境与基准说明

- **基准浏览器版本**：`Google Chrome 157.0.8103.50`（稳定内核 / Google Chrome for Testing `157.0.8103.50` arm64）
- **配套字体**：`Noto Sans CJK SC`（使用包内 `字体/NotoSansCJKsc-Regular.otf` 与 `字体/NotoSansCJKsc-Bold.otf`；按照规范，仅 `card_foil`、`fx_circle`、`ui_hud`、`ui_hud_slot` 四个文件使用文字元素（其中 `ui_hud_slot` 额外预留空文字槽 `<g id="slot_text"></g>`），其余文件完全不含 `<text>`）
- **自包含规范**：全部 44 个 SVG 文件（原 40 个 + 新增 `ui_hud_slot.svg` 与 3 个 `currentColor` 染色图标）均无任何外链资源、无 `<script>`、无 `<foreignObject>`、无内嵌位图 `<image>`，根节点均声明匹配的 `viewBox`、`width` 与 `height`。
- **动画体系**：同时覆盖 **CSS `@keyframes`** 与 **SMIL（`<animate>`、`<animateTransform>`、`<animateMotion>`）** 两种机制；所有循环动画首尾平滑衔接；所有一次性动作（施法、受击、爆炸、闪电）均同时支持 **CSS 根元素类名触发** 与 **SMIL `begin="indefinite"` 脚本触发**。

## 一、10 张核心测试图汇总表

| 文件 ID | 画框尺寸 | 元素总数 | SVG 文件大小 | 动画机制 | 一次性动作触发方式 |
|---|---|---:|---:|---|---|
| `char_lich.svg` | `512×640` | **1272** | 137,161 字节（133.9 KB） | CSS `@keyframes` + SMIL (`animate`, `animateTransform`, `animateMotion`) | 施法：`class="act-cast"` / `#cast_std_anim`；眩晕（进场后循环）：`class="act-daze"` / `#daze_in_anim` |
| `char_golem.svg` | `512×640` | **909** | 110,964 字节（108.4 KB） | CSS `@keyframes` + SMIL (`animate`, `animateTransform`) | 受击：`class="act-hit"` / `#golem_hit_shake_smil` + `#debris_smil_0..31`；倒下（播完停住）：`class="act-down"` / `#golem_down_smil` |
| `char_swarm.svg` | `640×480` | **2108** | 258,468 字节（252.4 KB） | CSS `@keyframes` + SMIL (`animate`, `animateTransform`) | 纯循环动画（220 只独立周期与负延迟） |
| `scene_hall.svg` | `1920×1080` | **11022** | 1,440,246 字节（1406.5 KB / 1.37 MB） | CSS `@keyframes` + SMIL (`animate`, `animateTransform`) | 纯循环动画（光柱呼吸、多层雾平移、烛火湍流摇曳、250 个灰尘粒子） |
| `scene_vault.svg` | `1920×1080` | **3847** | 414,420 字节（404.7 KB） | CSS `@keyframes` + SMIL (`animate`) | 纯循环动画（55 处星芒闪烁 + 全屏 `overlay` 色调渐变） |
| `fx_explosion.svg` | `512×512` | **463** | 50,602 字节（49.4 KB） | CSS `@keyframes` + SMIL (`animate`, `animateTransform`) | 根元素加 `class="act-explode"` 或触发 `#exp_blur_anim` / `#fireball_morph_0..2.beginElement()` |
| `fx_lightning.svg` | `768×256` | **231** | 43,288 字节（42.3 KB） | CSS `@keyframes` + SMIL (`animate calcMode="discrete"`) | 根元素加 `class="act-strike"` 或触发 `#bolt_outer_d_0..2` / `#bolt_flash_smil.beginElement()` |
| `fx_circle.svg` | `512×512` | **533** | 49,832 字节（48.7 KB） | CSS `@keyframes` + SMIL (`animate`, `animateTransform`) | 纯循环动画（3s 正反转环、中心向外扩张 `mask`、`<textPath>` 滚动） |
| `card_foil.svg` | `400×600` | **970** | 88,983 字节（86.9 KB） | CSS `@keyframes` + SMIL (`animate`, `animateTransform`) | 纯循环动画（2.5s 反光带平移 `gradientTransform` + 宝石插槽缩放发光） |
| `ui_hud.svg` | `1280×240` | **686** | 69,923 字节（68.3 KB） | CSS `@keyframes` + SMIL (`animate`, `animateTransform`) | 纯循环动画（血瓶/血条液面路径形变 + 数字跳动 `transform`） |
| `ui_hud_slot.svg` | `1280×240` | **707** | 72,558 字节（70.9 KB） | CSS `@keyframes` + SMIL (`animate`, `animateTransform`) | 纯循环动画（含 ±4° 2.4s 摆动铭牌、内置空槽 `#slot_text` 与前景遮挡锁扣） |

## 二、10 张核心测试图逐项详解

### 1. `char_lich.svg` — 巫妖（角色）

- **画框尺寸**：`512×640`
- **元素个数**：**1254 个元素**（主要构成：`<circle>`×609, `<path>`×251, `<ellipse>`×64, `<polygon>`×57, `<animate>`×47, `<rect>`×47, `<g>`×38, `<stop>`×36）
- **文件大小**：**132,978 字节（129.9 KB）**
- **用到的特性**：
  - **核心几何与结构元素**：`<path>`、`<polygon>`、`<circle>`、`<ellipse>`、`<rect>`、`<line>`、`<g>`、`<mpath>`。
  - **多层渐变与焦点偏移/平铺**：使用 `#bg_crypt_grad`、`#abyss_vortex_reflect`（径向渐变焦点偏移 `fx="0.42" fy="0.42"` + `spreadMethod="reflect"`）、`#robe_silk_repeat`（线性渐变 `spreadMethod="repeat"`）、`#soul_core_grad`（`fx="0.35" fy="0.32"` + `spreadMethod="reflect"`）、`#eye_socket_grad` 等。
  - **滤镜 (`<filter>`)**：`#lich_outer_glow`（整组外发光：`feGaussianBlur` + `feColorMatrix` + `feMerge`）、`#lich_drop_shadow`（双层 `feDropShadow` 投影）、`#soul_fire_glow`（双半径高斯模糊叠加）。
  - **混合模式 (`mix-blend-mode`)**：在深渊漩涡、胸腔魂火核心、施法光环、法杖魂珠及前景冥火粒子上使用了 `mix-blend-mode: screen`；在古堡暗角阴影罩层上使用了 `mix-blend-mode: multiply`。
  - **遮罩 (`<mask>`) 与嵌套裁剪 (`<clipPath>`)**：包含 1 处亮度遮罩 `#mask_luminance_soul`（`mask-type="luminance"`，用于胸腔灵魂熔炉透光）和 1 处透明度遮罩 `#mask_alpha_cloak`（`mask-type="alpha"`，用于披风下摆渐变消隐）；包含嵌套裁剪路径 `#clip_outer_sanctum` 与 `#clip_nested_inner`（`clip-path="url(#clip_outer_sanctum)"`）。
  - **图案填充 (`<pattern>`) 与虚线描边**：`#lich_robe_pattern`（带 `patternTransform="rotate(15)"` 的哥特暗金紫绸菱格纹样）用于长袍内衬；法阵、披风金边与法杖符文广泛使用 `stroke-dasharray` 虚线描边。
  - **文字**：无（严格遵守仅在指定 3 个文件中使用文字的规范）。
- **动画清单**：

  | 目标元素 | 动画属性 | 实现方式 | 时长 | 循环 | 触发方式 |
  |---|---|---|---|---|---|
  | 胸腔脊柱与 14 根肋骨 (`#lich_torso_and_soul path`) | `d`（呼吸路径形变，前后顶点与命令完全一致） | SMIL `<animate attributeName="d">` | `4s` | 无限循环 (`indefinite`) | 自动开始 |
  | 外层披风 (`#lich_cloak_assembly > path`) & 20 条下摆布条 | `d`（披风飘动路径形变） | SMIL `<animate attributeName="d">` | `4s` | 无限循环 (`indefinite`) | 自动开始 |
  | 内层纹样长袍 (`.cloak-inner`) | `d: path(...)`（披风内衬形变） | CSS `@keyframes cloakWaveCss` | `4s` | 无限循环 (`infinite`) | 自动开始 |
  | 双眼渐变与瞳火 (`#eye_socket_grad stop`, `.eye-glow-css`) | `stop-color`、`r`、`fill`、`filter` | SMIL `<animate>` + CSS `@keyframes eyeColorShift` | `4s` | 无限循环 | 自动开始 |
  | 法杖 6 枚秘仪符文 (`.staff-rune-stroke`) | `stroke-dashoffset` (`60 -> 0 -> -60`)、`stroke` | SMIL `<animate>` + CSS `@keyframes runeDraw` | `4s` | 无限循环 | 自动开始（带错峰延迟） |
  | 24 枚环绕骨片 (`#orbiting_bone_shards > g`) | 沿 `#orbit_path_0..3` 轨道运动并自动朝向 | SMIL `<animateMotion rotate="auto">` + `<mpath>` | `4s` | 无限循环 | 自动开始 |
  | **一次性施法动作**：角色整体外发光滤镜 (`#cast_std_anim`) 与光环 (`#lich_cast_halo`) | `stdDeviation` (`5 -> 26 -> 18 -> 5`)、`transform`、`opacity` | SMIL `<animate begin="indefinite">` + CSS `svg.act-cast` | `1.2s` | 单次 (`1` / `freeze`) | 脚本调用 `document.getElementById('cast_std_anim').beginElement()`，或给 `<svg>` 添加 `class="act-cast"` |

- **最难画对的地方**：
  **整组滤镜叠加动态变形子元素（2.1 核心难点）**：`#lich_character_filtered_group` 挂载了包含 `feGaussianBlur` + `feColorMatrix` + `feMerge` 的整体外发光滤镜 `#lich_outer_glow`（施法时 `stdDeviation` 本身也在动态变化），而组内的披风、肋骨、骨片、符文以及带 `mask-type="luminance"` 和 `mask-type="alpha"` 的遮罩子树每帧都在发生几何形变。渲染器必须在每帧正确重算动态包围盒并重跑整组离屏滤镜与遮罩合成，极易出现包围盒裁剪闪烁或缓存失效问题。
- **补充（新增「眩晕」进场后循环动作）**：
  - **改动内容**：更新后元素总数为 **1272**（137,161 字节）。新增种类为「进场后循环」的**眩晕**动作：前 `0.5s`（500 毫秒）为进场阶段，巫妖头冠 (`#lich_head_and_crown`) 与死灵法杖 (`#lich_necrostaff`) 向右侧歪斜倾倒、双眼魂火 (`#lich_eyes_group`) 变暗至 `opacity: 0.22`、头顶眩晕环 (`#lich_daze_halo`) 显现；随后无缝衔接进入 `1.2s` 一圈的无限循环阶段：角色身体 (`#lich_character_filtered_group`) 左右摇晃，同时头顶一圈小骨片与四芒星光 (`#lich_daze_halo_spinner`) 以 `1.2s` 周期持续旋转，直至外部取消该状态。
  - **新增动作动画清单**：

    | 目标元素 | 动画属性 | 实现方式 | 时长 | 循环 | 触发方式 |
    |---|---|---|---|---|---|
    | 头冠与颅骨 (`#lich_head_and_crown` / `#daze_in_anim`) | `transform: rotate(0deg -> 15deg)` | CSS `svg.act-daze` (`forwards`) + SMIL `<animateTransform id="daze_in_anim" begin="indefinite" fill="freeze">` | `0.5s` | 进场单次 (`freeze`) | 给 `<svg>` 加 `class="act-daze"` 或调用 `#daze_in_anim.beginElement()` |
    | 死灵法杖 (`#lich_necrostaff` / `#daze_staff_in_anim`) | `transform: rotate(0deg -> 16deg)` | CSS `svg.act-daze` (`forwards`) + SMIL `<animateTransform begin="daze_in_anim.begin" fill="freeze">` | `0.5s` | 进场单次 (`freeze`) | 随 `act-daze` 或 `daze_in_anim.begin` 自动同步触发 |
    | 双眼魂火组 (`#lich_eyes_group` / `#daze_eyes_dim_anim`) | `opacity` (`1 -> 0.22`)、`filter: brightness(0.35)` | CSS `svg.act-daze` (`forwards`) + SMIL `<animate begin="daze_in_anim.begin" fill="freeze">` | `0.5s` | 进场单次 (`freeze`) | 随 `act-daze` 或 `daze_in_anim.begin` 自动同步触发 |
    | 头顶骨片星光环容器 (`#lich_daze_halo` / `#daze_halo_show_anim`) | `opacity` (`0 -> 1`) | CSS `svg.act-daze` (`forwards`) + SMIL `<animate begin="daze_in_anim.begin" fill="freeze">` | `0.5s` | 进场单次 (`freeze`) | 随 `act-daze` 或 `daze_in_anim.begin` 自动同步触发 |
    | 角色整体左右摇晃 (`#lich_character_filtered_group` / `#daze_body_sway_anim`) | `transform: rotate(0 -> 4.5deg -> 0 -> -4.5deg -> 0)` | CSS `svg.act-daze` (`delay: 0.5s`, `infinite`) + SMIL `<animateTransform begin="daze_in_anim.end" repeatCount="indefinite">` | `1.2s` | 进场后无限循环 (`indefinite`) | `daze_in_anim.end`（或 CSS `0.5s` 延迟后）自动接续循环 |
    | 头顶小骨片与星光转圈 (`#lich_daze_halo_spinner` / `#daze_halo_spin_anim`) | `transform: rotate(0deg -> 360deg)` | CSS `svg.act-daze` (`delay: 0.5s`, `infinite`) + SMIL `<animateTransform begin="daze_in_anim.end" repeatCount="indefinite">` | `1.2s` | 进场后无限循环 (`indefinite`) | `daze_in_anim.end`（或 CSS `0.5s` 延迟后）自动接续循环 |

### 2. `char_golem.svg` — 石像魔像（角色）

- **画框尺寸**：`512×640`
- **元素个数**：**905 个元素**（主要构成：`<polygon>`×274, `<circle>`×253, `<line>`×160, `<path>`×84, `<g>`×39, `<animateTransform>`×34, `<stop>`×19, `<animate>`×15）
- **文件大小**：**109,761 字节（107.2 KB）**
- **用到的特性**：
  - **核心几何与结构元素**：`<polygon>`、`<path>`、`<circle>`、`<ellipse>`、`<line>`、`<g>`。
  - **石头质感与三维浮雕滤镜 (`<filter>`)**：`#stone_texture_disp` 使用 `feTurbulence (fractalNoise)` + `feDisplacementMap` 制造岩石边缘风化凹凸感；`#stone_relief_lighting` 同时组合 `feTurbulence`、`feDiffuseLighting`（含 `<feDistantLight>`）与 `feSpecularLighting`（含 `<fePointLight>`），再经 `feComposite (arithmetic)` 与原图合成逼真的哥特石雕立体浮雕。
  - **裂缝岩浆（渐变 + 模糊 + `screen`）**：`#golem_magma_veins` 使用平移循环渐变 `#flowing_magma_grad`（`spreadMethod="repeat"`）、高斯模糊滤镜 `#magma_glow_blur` 以及 `mix-blend-mode: screen`。
  - **文字**：无。
- **动画清单**：

  | 目标元素 | 动画属性 | 实现方式 | 时长 | 循环 | 触发方式 |
  |---|---|---|---|---|---|
  | 全身熔岩裂缝 (`.magma-crack`) 与胸口熔炉核心 | `opacity`、`stroke-opacity`、`stroke` | CSS `@keyframes crackPulse` + SMIL `<animate>` | `1.6s–2.8s` | 无限循环 | 自动开始 |
  | 岩浆填充渐变 (`#flowing_magma_grad`) | `gradientTransform` (`translate(0,0) -> translate(0,80)`) | SMIL `<animateTransform attributeName="gradientTransform">` | `2.2s` | 无限循环 | 自动开始 |
  | **一次性受击抖动** (`#golem_main_body` / `#golem_hit_shake_smil`) | `transform`（整体位移与旋转抖动） | CSS `svg.act-hit` `@keyframes golemHitShake` + SMIL `<animateTransform begin="indefinite">` | `0.4s` | 单次 (`1`) | 给根元素 `<svg>` 加 `class="act-hit"` 或调用 `beginElement()` |
  | **一次性受击飞溅碎石**（32 块独立碎石 `#debris_0..31`） | `transform`（32 条不同方向/距离/旋转角轨迹）与 `opacity` | CSS `svg.act-hit .debris-0..31` + SMIL `#debris_smil_0..31` (`begin="indefinite"`) | `0.4s` | 单次 (`1` / `forwards`) | 给根元素 `<svg>` 加 `class="act-hit"` 或批量调用 `#debris_smil_0..31.beginElement()` |

- **最难画对的地方**：
  **动态 `gradientTransform` 与光照/置换滤镜叠加**：岩浆裂缝内部引用的线性渐变 `#flowing_magma_grad` 持续执行 `gradientTransform` 平移且配置了 `spreadMethod="repeat"`，同时外层挂有高斯模糊和 `mix-blend-mode: screen`，紧邻其下的是带 `feDiffuseLighting` + `feSpecularLighting` 浮雕滤镜的石甲层；受击瞬间主体抖动并同时迸发 32 个独立运动矩阵的碎石块。
- **补充（新增「倒下」播完停住动作 & 受击/倒下期间局部动画独立性确认）**：
  - **Chrome 157 实测确认**：已在 Chrome 157（`157.0.8103.50`）中确认，`char_golem` 触发受击（`act-hit`）时，只有身体在抖动并迸发碎石，全身裂缝的闪烁（`.magma-crack`）和岩浆流动（`#flowing_magma_grad`）照常进行，**不会停，也不会从头开始**；新增的「倒下」（`act-down`）动作通过外层姿态容器 `#golem_down_pose` 作用，同样完整保持了这一点（倒下过程中及倒下停住后，裂缝闪烁与岩浆流动均不中断、不重置）。
  - **改动内容**：更新后元素总数为 **909**（110,964 字节）。新增种类为「播完停住」的**倒下**动作：时长 `0.8s`（800 毫秒），整个魔像向右侧倾倒（旋转 `12°`，同时缩放到 `0.9` 倍并下沉），动画结束后停留在最后一帧姿势不回退（CSS 使用 `class="act-down"` 加 `forwards`；SMIL 使用 `begin="indefinite"` 加 `fill="freeze"`）。
  - **新增动作动画清单**：

    | 目标元素 | 动画属性 | 实现方式 | 时长 | 循环 | 触发方式 |
    |---|---|---|---|---|---|
    | 魔像整体倾倒姿态组 (`#golem_down_pose` / `#golem_down_smil`, `#golem_down_rot_smil`, `#golem_down_scale_smil`) | `transform`（向一侧倾倒旋转 `12°`、整体缩放到 `0.9` 倍并下沉位移，停留在末帧） | CSS `svg.act-down #golem_down_pose` (`forwards`) + SMIL `<animateTransform id="golem_down_smil" begin="indefinite" fill="freeze">`（配合 `begin="golem_down_smil.begin"` 叠加旋转与缩放） | `0.8s` | 播完停住 (`forwards` / `freeze`) | 给 `<svg>` 加 `class="act-down"` 或调用 `#golem_down_smil.beginElement()` |

### 3. `char_swarm.svg` — 一群蝙蝠与幽魂（220 只集群）

- **画框尺寸**：`640×480`
- **元素个数**：**2108 个元素**（主要构成：`<stop>`×668, `<circle>`×442, `<radialGradient>`×222, `<g>`×221, `<animateTransform>`×220, `<path>`×220, `<animate>`×110, `<svg>`×1）
- **文件大小**：**258,468 字节（252.4 KB）**
- **用到的特性**：
  - **个体数量与独立渐变**：共包含 **220 只** 独立血翼蝙蝠/幽魂个体（`#swarm_unit_0` 至 `#swarm_unit_219`），`<defs>` 中定义了 **220 个独立径向渐变**（`#bat_grad_0` 至 `#bat_grad_219`，焦点偏移 `fx`/`fy` 与色相各异），每只个体均拥有独立的 `opacity`（`0.52`–`0.92`）。
  - **半透明组重叠（2.1 核心难点）**：全部 220 只个体包裹在同一个半透明容器组 `<g id="swarm_semi_transparent_group" opacity="0.86">` 内，按螺旋涡流分布并密集互相交叠。
  - **文字**：无。
- **动画清单**：

  | 目标元素 | 动画属性 | 实现方式 | 时长 | 循环 | 触发方式 |
  |---|---|---|---|---|---|
  | 220 只蝙蝠个体 (`#swarm_unit_0..219`) | `transform` (`additive="sum"` 独立周期平移飞行，均带不同负延迟 `begin`) | SMIL `<animateTransform type="translate">` | `1.80s–4.68s`（各不相同） | 无限循环 | 自动开始 |
  | 偶数编号个体双翼 (`#swarm_unit_0, 2, ... > path`) | `d`（翅膀上下扇动路径形变） | SMIL `<animate attributeName="d">` | `0.38s–0.86s`（各不相同） | 无限循环 | 自动开始 |
  | 奇数编号个体双翼 (`.bat-wing-scale`) | `transform: scaleX(...) scaleY(...)` | CSS `@keyframes wingFlapScale`（各自独立 `animation-duration` 与 `animation-delay`） | `0.38s–0.86s`（各不相同） | 无限循环 (`alternate`) | 自动开始 |

- **最难画对的地方**：
  **半透明组（Group Opacity `< 1.0`）内 220 个动态重叠子元素的离屏合成（2.1 核心难点）**：根据 SVG 规范，`opacity="0.86"` 作用在父组 `#swarm_semi_transparent_group` 上时，渲染器必须先将 220 只各自带独立透明度与独立渐变的移动子元素在透明度为 1.0 的离屏缓冲区中按画家算法重叠混合，最后再整体乘以 `0.86` 合成到背景上；若错误地将父组透明度直接下发乘到每个子元素上，重叠区域就会出现明显的透底与混合失真。

### 4. `scene_hall.svg` — 古堡大厅背景

- **画框尺寸**：`1920×1080`
- **元素个数**：**11022 个元素**（主要构成：`<circle>`×5237, `<path>`×4385, `<polygon>`×564, `<animate>`×259, `<line>`×180, `<rect>`×146, `<ellipse>`×116, `<g>`×66）
- **文件大小**：**1,440,246 字节（1406.5 KB / 1.37 MB）**
- **用到的特性**：
  - **透视图案 (`<pattern>` + `patternTransform`)**：`#gothic_wallpaper_pat` 使用 `patternTransform="matrix(0.92, -0.08, 0.0, 1.05, 12, 8)"` 绘制哥特暗纹壁纸；`#perspective_floor_pat` 使用 `patternTransform="matrix(1.35, 0.08, -0.65, 0.58, 960, 680)"` 实现大厅地砖的斜向透视铺贴。
  - **彩色玻璃窗 (`<clipPath>` + 渐变)**：包含 6 扇哥特尖拱彩窗裁剪路径 `#clip_window_0..5` 与中央巨型玫瑰花窗 `#clip_grand_rose`，内部镶嵌超千片彩绘玻璃花格与渐变。
  - **体积雾与光柱（混合模式叠在动态元素上方，2.1 核心难点）**：`#drifting_fog_layers` 使用大半径高斯模糊 `#hall_fog_blur` (`stdDeviation="34"`)；其正上方的 7 道倾泻月光光柱 `#volumetric_light_beams` 使用多层渐变 + `mix-blend-mode: screen` 与 `overlay`。
  - **摇曳烛火 (`feTurbulence` + `feDisplacementMap`)**：4 座大型吊灯共 48 支蜡烛火焰挂载 `#candle_flame_filter`，通过动态噪声与置换实现真实火苗摇曳。
  - **灰尘粒子**：包含 **250 个** 独立漂浮发光灰尘粒子 (`#floating_dust_particles`)。
  - **文字**：无。
- **动画清单**：

  | 目标元素 | 动画属性 | 实现方式 | 时长 | 循环 | 触发方式 |
  |---|---|---|---|---|---|
  | 7 道月光光柱 (`.light-beam-pulse`) | `opacity`（明暗呼吸交替） | CSS `@keyframes beamBreathe` + SMIL `<animate>` | `4.2s–6.75s` | 无限循环 | 自动开始 |
  | 3 层大半径体积雾 (`.fog-layer-slow/mid/fast`) | `transform`（不同速度水平与垂直漂移） | CSS `@keyframes fogDrift*` + SMIL `<animateTransform>` | `6.2s / 9.5s / 14s` | 无限循环 | 自动开始 |
  | 烛火滤镜 (`#candle_flame_filter`) | `feTurbulence` 的 `baseFrequency` 与 `feDisplacementMap` 的 `scale` | SMIL `<animate attributeName="baseFrequency">` + `<animate attributeName="scale">` | `1.8s` | 无限循环 | 自动开始 |
  | 250 颗漂浮灰尘微粒 (`.dust-mote`) | `transform`、`cy`、`opacity` | CSS `@keyframes dustFloat` + SMIL `<animate attributeName="cy">` | `3.8s–8.5s` | 无限循环 | 自动开始 |

- **最难画对的地方**：
  **混合模式 (`screen` / `overlay`) 实时叠在正在平移的大半径高斯模糊体积雾与 250 个漂浮粒子之上，同时伴随 11,000+ 元素的超大规模场景与滤镜参数本身动态变化（2.1 多重难点叠加）**：渲染器既要高效处理超过 1.4 MB / 1.1 万个元素的批处理，又要在每帧正确处理背景彩窗、中层动态模糊雾和上层 `screen`/`overlay` 光柱的 Backdrop 读取合成。

### 5. `scene_vault.svg` — 宝库背景（金币堆）

- **画框尺寸**：`1920×1080`
- **元素个数**：**3824 个元素**（主要构成：`<ellipse>`×1964, `<use>`×1400, `<polygon>`×142, `<circle>`×92, `<path>`×64, `<g>`×63, `<animate>`×57, `<stop>`×15）
- **文件大小**：**411,528 字节（401.9 KB）**
- **用到的特性**：
  - **`<symbol>` 与 `<use>` 复用**：定义了 `#sym_gold_coin`（金币）、`#sym_gold_ingot`（金锭）、`#sym_chalice`（宝石圣杯）3 个 `<symbol>`，在场景中通过 1,400 个 `<use>` 实例复用。
  - **同一个渐变被数千元素同时引用（2.1 核心难点）**：`#shared_gold_grad` 被 2,100+ 个直接绘制的金币椭圆/宝石边框以及 `<symbol>` 内部图形同时引用（总计超过 3,500 处引用）。
  - **光照滤镜 (`<filter>`)**：`#vault_specular_lighting` 使用 `feTurbulence` + `feSpecularLighting` + `<fePointLight>` + `feComposite` 为金山底座赋予金属高光质感。
  - **文字**：无。
- **动画清单**：

  | 目标元素 | 动画属性 | 实现方式 | 时长 | 循环 | 触发方式 |
  |---|---|---|---|---|---|
  | 55 处随机位置十字星芒 (`.star-sparkle`) | `opacity` + `transform: scale(...) rotate(...)` | CSS `@keyframes starTwinkle` + SMIL `<animate attributeName="opacity">` | `1.5s–3.6s` | 无限循环 | 自动开始 |
  | 全屏色调罩层 (`.vault-color-overlay`) | `fill` (`#ffaa00 -> #b5179e -> #00f5d4`) 与 `opacity`（配合 `mix-blend-mode: overlay`） | CSS `@keyframes vaultToneShift` + SMIL `<animate>` | `8s / 10s` | 无限循环 | 自动开始 |

- **最难画对的地方**：
  **3,800+ 元素高密度共享同一线性渐变 `#shared_gold_grad` 与 `<use>` 实例展开**：每个元素拥有不同的包围盒（`objectBoundingBox` 渐变空间），渲染引擎在批量合批（Batching）时必须为每个金币正确计算各自的局部渐变矩阵，不能因共享同一个渐变 ID 而错误复用同一组世界坐标 UV。
- **补充（新增两种 `<symbol>` + `<use>` 颜色继承测试宝石）**：
  - **改动内容**：更新后元素总数为 **3847**（414,420 字节）。在 `<defs>` 中新增两个宝石 `<symbol>` 并在金币堆上方 `#vault_use_color_gems` 组中各放置 5 颗不同颜色的 `<use>` 实例：
    1. **甲种宝石 (`#sym_gem_inherit_fill`)**：`<symbol>` 内部的主体多边形**不写 `fill` 属性**（仅保留固定颜色的 `#ffffff` 半透明高光面），5 颗宝石的颜色分别由各自 `<use>` 上的 `fill` 属性（`#ff2a55`、`#00b4d8`、`#2ec4b6`、`#9b5de5`、`#ff9f1c`）提供；
    2. **乙种宝石 (`#sym_gem_current_color`)**：`<symbol>` 内部的主体多边形声明 `fill="currentColor"`（同样带固定颜色的 `#ffffff` 半透明高光面），5 颗宝石的颜色分别由各自 `<use>` 上的 `color` 与 `style="color: ..."`（`#ff007f`、`#3a86ff`、`#38b000`、`#ffbe0b`、`#8338ec`）提供。
  - **新增动画清单**：无新增动画（沿用原有 55 处十字星芒闪烁与全屏 `overlay` 色调渐变循环动画）。

### 6. `fx_explosion.svg` — 爆炸特效

- **画框尺寸**：`512×512`
- **元素个数**：**463 个元素**（主要构成：`<circle>`×205, `<line>`×140, `<polygon>`×70, `<stop>`×11, `<animate>`×11, `<feMergeNode>`×4, `<radialGradient>`×3, `<g>`×3）
- **文件大小**：**50,571 字节（49.4 KB）**
- **用到的特性**：
  - **径向渐变与色彩演化**：`#exp_core_grad`（带焦点偏移 `fx="0.44" fy="0.44"`）、`#exp_shockwave_grad`、`#smoke_puff_grad`。
  - **形态学滤镜 (`feMorphology`) 与动态模糊**：`#smoke_morphology_filter` 结合 `feMorphology (operator="dilate")` 与 `feMorphology (operator="erode")` 及 `feComposite (operator="out")` 塑造浓烟膨胀边缘；`#exp_fire_blur` 使用 `feGaussianBlur` + `feMerge`。
  - **混合模式 (`mix-blend-mode: screen`)**：根容器 `#explosion_root` 设置 `mix-blend-mode: screen` 且背景完全透明，可直接叠加在任意游戏画面之上。
  - **文字**：无。
- **动画清单**：

  | 目标元素 | 动画属性 | 实现方式 | 时长 | 循环 | 触发方式 |
  |---|---|---|---|---|---|
  | 3 层爆裂火球路径 (`#fireball_morph_0..2`) | `d`（32 顶点星芒火球向外剧烈膨胀形变）与 `fill`（白 -> 橙 -> 暗红） | SMIL `<animate begin="indefinite">` + CSS `svg.act-explode` | `1.0s` | 单次 (`1` / `freeze`) | 给 `<svg>` 加 `class="act-explode"` 或调用 `beginElement()` |
  | 核心径向渐变色标 (`#exp_c0..c2`) | `stop-color`（从 `#ffffff` -> `#ff9f1c` -> `#d00000` -> `#370617`） | SMIL `<animate begin="indefinite">` | `1.0s` | 单次 (`freeze`) | 调用 `#exp_c0..c2.beginElement()` |
  | 火球高斯模糊滤镜 (`#exp_blur_anim`) | `stdDeviation` (`1.5 -> 6.5 -> 18.0 -> 11.0`) | SMIL `<animate begin="indefinite">` | `1.0s` | 单次 (`freeze`) | 调用 `#exp_blur_anim.beginElement()` |
  | 浓烟环形态学滤镜与外扩 (`#exp_morph_anim`, `#explosion_smoke_ring`) | `feMorphology radius` (`2 -> 7.5 -> 12`) 与 `transform: scale` | SMIL `<animate>` / `<animateTransform begin="indefinite">` + CSS `svg.act-explode` | `1.0s` | 单次 (`freeze`) | 给 `<svg>` 加 `class="act-explode"` 或调用 `beginElement()` |

- **最难画对的地方**：
  **`feMorphology` 动态膨胀半径 + 动态 `feGaussianBlur` + 32 顶点火球路径形变 + 渐变色标同时在 1 秒内演进**：烟雾团的边缘通过 `dilate` 与 `erode` 的差集计算轮廓，且 `radius` 参数在动画中实时增长，对滤镜链实时重算要求极高。
- **补充（根元素混合模式声明）**：
  - **改动内容**：更新后元素总数为 **463**（50,602 字节）。在根元素 `<svg>` 上新增 `style="mix-blend-mode: screen"`，同时完整保留内部 `#explosion_root` 等子元素原有的混合模式声明，使整张爆炸特效图在叠加到外部场景时以滤色（`screen`）模式合成。动作清单 `fx_explosion.json` 中记录 `"混合": "screen"`，并完整列出全部 12 个 `begin="indefinite"` 的 SMIL 动画 ID。

### 7. `fx_lightning.svg` — 闪电链特效

- **画框尺寸**：`768×256`
- **元素个数**：**231 个元素**（主要构成：`<circle>`×119, `<animate>`×45, `<path>`×44, `<stop>`×7, `<feMergeNode>`×4, `<feGaussianBlur>`×3, `<svg>`×1, `<style>`×1）
- **文件大小**：**41,899 字节（40.9 KB）**
- **用到的特性**：
  - **多层模糊外发光滤镜**：`#lightning_multi_glow` 包含 3 层不同半径的 `feGaussianBlur`（`stdDeviation` 分别为 `2.2`、`7.5`、`16.0`），通过 `feMerge` 与原图四层叠加，形成极具张力的电弧外发光。
  - **多层描边与分叉电弧**：主干闪电与上下两条副电弧均采用「宽外层彩光描边 + 细内芯纯白高光描边」双轨设计，配合 38 条分叉支路与 110 颗电离火花。
  - **文字**：无。
- **动画清单**：

  | 目标元素 | 动画属性 | 实现方式 | 时长 | 循环 | 触发方式 |
  |---|---|---|---|---|---|
  | 主电弧与副电弧共 6 条路径 (`#bolt_outer_d_0..2`, `#bolt_core_d_0..2`) | `d`（6 组完全不同的锯齿折线路径每隔两三帧离散切换，`calcMode="discrete"`） | SMIL `<animate attributeName="d" calcMode="discrete" begin="indefinite">` | `0.6s` | 单次 (`freeze`) | 调用 `#bolt_outer_d_0..2.beginElement()` 等 |
  | 38 条分叉支路电弧 (`#lightning_chain_group > path`) | `d`（4 组离散跳变路径，`calcMode="discrete"`） | SMIL `<animate calcMode="discrete" begin="indefinite">` | `0.6s` | 单次 | 调用 `beginElement()` |
  | 整组电弧亮度与透明度闪烁 (`#lightning_chain_group`, `#bolt_flash_smil`) | `opacity` 与 `filter: brightness(...)` | CSS `svg.act-strike` (`steps(6, end)`) + SMIL `<animate calcMode="discrete" begin="indefinite">` | `0.6s` | 单次 | 给 `<svg>` 加 `class="act-strike"` 或调用 `#bolt_flash_smil.beginElement()` |

- **最难画对的地方**：
  **`calcMode="discrete"` 离散路径跳变与三层大半径高斯模糊的同步刷新**：闪电链每隔约 0.1 秒瞬间切换一整套 24 段折线顶点而不做插值，三层 `feGaussianBlur` 必须立即根据新折线几何重新生成辉光，不能残留上一帧的模糊残影。
- **补充（根元素混合模式声明 & 分叉电弧 SMIL ID 补全）**：
  - **改动内容**：更新后元素总数为 **231**（43,288 字节）。在根元素 `<svg>` 上新增 `style="mix-blend-mode: screen"`（保留内部元素原有混合模式），并为 38 条分叉支路电弧的离散路径动画逐一赋予显式 ID `#bolt_branch_d_0` 至 `#bolt_branch_d_37`（连同 `#bolt_flash_smil`、`#bolt_outer_d_0..2`、`#bolt_core_d_0..2` 共 45 个 SMIL ID 全部列入 `fx_lightning.json`），确保单独使用 SMIL 触发时主电弧与全部分叉支路完整同步播放。

### 8. `fx_circle.svg` — 魔法阵

- **画框尺寸**：`512×512`
- **元素个数**：**533 个元素**（主要构成：`<circle>`×237, `<line>`×134, `<polygon>`×118, `<stop>`×12, `<g>`×5, `<animate>`×3, `<animateTransform>`×3, `<radialGradient>`×2）
- **文件大小**：**49,801 字节（48.6 KB）**
- **用到的特性**：
  - **多圈虚线描边 (`stroke-dasharray`)**：外环、中环（正十二芒星与交错六芒星）、内环共包含 10 余圈不同节奏的 `stroke-dasharray` 虚线星轨。
  - **沿着圆排的文字 (`<textPath>` + `Noto Sans CJK SC`)**：定义了顺时针外环路径 `#rune_text_path_outer` 与逆时针内环路径 `#rune_text_path_inner`，使用 `Noto Sans CJK SC` 粗体排布中拉双语秘仪铭文。
  - **从中心往外显现的动态遮罩 (`<mask>`，2.1 核心难点）**：`#expanding_circle_mask` 内含径向羽化圆，其半径 `r` 在 3 秒循环内动态扩张，而被它遮住的外、中、内三层星轨环与环形文字同时在各自旋转和滚动。
- **动画清单**：

  | 目标元素 | 动画属性 | 实现方式 | 时长 | 循环 | 触发方式 |
  |---|---|---|---|---|---|
  | 外圈星轨环 (`#outer_ring_cw`) 与内圈核心星 (`#inner_core_cw`) | `transform: rotate(0deg -> 360deg)`（顺时针旋转） | CSS `.ring-cw-3s` + SMIL `<animateTransform type="rotate">` | `3.0s` | 无限循环 | 自动开始 |
  | 中圈十二芒星与符文环 (`#mid_ring_ccw`) | `transform: rotate(360deg -> 0deg)`（逆时针旋转） | CSS `.ring-ccw-3s` + SMIL `<animateTransform type="rotate">` | `3.0s` | 无限循环 | 自动开始 |
  | 中心向外显现遮罩 (`#expanding_circle_mask circle`) | `r`（半径从中心向外扩张显现） | SMIL `<animate attributeName="r">` | `3.0s` | 无限循环 | 自动开始 |
  | 外圈与内圈环形铭文 (`<textPath>`) | `startOffset` (`0% -> 100%` 及 `100% -> 0%` 双向沿圆滚动) | SMIL `<animate attributeName="startOffset">` | `3.0s` | 无限循环 | 自动开始 |

- **最难画对的地方**：
  **遮罩在动，被遮住的多层旋转几何与沿圆弧滚动的 `<textPath>` 文字也在动（2.1 核心难点）**：渲染引擎需要在每一帧同时计算圆弧路径切线上的中文字形排版矩阵（隨 `startOffset` 实时改变每个字的位置和法向角）、三组正反转子树的变换矩阵，再与动态改变半径的径向渐变 `<mask>` 进行逐像素亮度裁剪合成。
- **补充（根元素混合模式声明）**：
  - **改动内容**：更新后元素总数为 **533**（49,832 字节）。在根元素 `<svg>` 上新增 `style="mix-blend-mode: screen"`，保留内部元素原有混合模式，并在 `fx_circle.json` 中记录 `"混合": "screen"`。

### 9. `card_foil.svg` — 闪卡（卡牌正面）

- **画框尺寸**：`400×600`
- **元素个数**：**966 个元素**（主要构成：`<circle>`×622, `<path>`×117, `<polygon>`×72, `<line>`×60, `<stop>`×31, `<tspan>`×12, `<g>`×11, `<rect>`×9）
- **文件大小**：**88,414 字节（86.3 KB）**
- **用到的特性**：
  - **华丽浮雕边框（`pattern` + 渐变 + 光照滤镜）**：外框使用 `#card_border_pat` 图案填充、`#card_frame_gold` 五色金属渐变，并挂载同时包含 `feDiffuseLighting` 与 `feSpecularLighting` 的浮雕光照滤镜 `#border_emboss_light`。
  - **中文排版 (`<text>` + `<tspan>` + `Noto Sans CJK SC`)**：卡名「猩红古堡·永夜伯爵」与效果描述全部使用 `Noto Sans CJK SC`，包含多段嵌套 `<tspan>`、字间距 `letter-spacing`、粗体 `font-weight="bold"` 与正文字重切换。
  - **闪卡全息反光（渐变 + `color-dodge` / `overlay`）**：包含静态全息棱镜层 `#holo_prism_overlay`（`mix-blend-mode: overlay`）与斜向扫光层 `#foil_sheen_grad`（`mix-blend-mode: color-dodge`）。
- **动画清单**：

  | 目标元素 | 动画属性 | 实现方式 | 时长 | 循环 | 触发方式 |
  |---|---|---|---|---|---|
  | 闪卡斜向反光带渐变 (`#foil_sheen_grad`) | `gradientTransform` (`translate(-420 -420) -> translate(420 420)`) | SMIL `<animateTransform attributeName="gradientTransform">` | `2.5s` | 无限循环 | 自动开始 |
  | 5 处宝石插槽 (`.gem-socket-pulse` 及内部 `<circle>`) | `transform: scale(...)`、`filter: drop-shadow(...)`、`r` | CSS `@keyframes gemSocketBeat` + SMIL `<animate attributeName="r">` | `1.8s` | 无限循环 | 自动开始（带错峰延迟） |

- **最难画对的地方**：
  **`mix-blend-mode: color-dodge` 动态渐变扫光叠在光照浮雕边框与多层 `<tspan>` 中文排版之上**：`color-dodge`（颜色减淡）对底色极为敏感，当 `#foil_sheen_grad` 的 `gradientTransform` 斜向扫过经过 `feSpecularLighting` 浮雕处理的边框和带描边的中文文字时，稍有颜色空间（sRGB vs linearRGB）或预乘 Alpha 偏差就会导致高光过曝或发灰。
- **补充（新增 15 度倾斜小字标签）**：
  - **改动内容**：更新后元素总数为 **970**（88,983 字节）。在卡面右上角新增旋转 `15°` 的斜贴角标底座 `#card_limited_corner_badge`（`transform="rotate(15 316 96)"`）以及一行 `13px` 的 `Noto Sans CJK SC` 粗体中文加数字斜向小字 `<text x="316" y="99" transform="rotate(15 316 96)" font-size="13" ...>限定 0137/500</text>`，原有 `12.5px` 正向规则描述文字保持不变，专门用于检验文字转曲后小字号斜向字形与 Chrome 157 的栅格化一致性。

### 10. `ui_hud.svg` — 战斗界面装饰面板

- **画框尺寸**：`1280×240`
- **元素个数**：**686 个元素**（主要构成：`<circle>`×419, `<g>`×101, `<path>`×99, `<rect>`×15, `<stop>`×13, `<text>`×10, `<svg>`×7, `<polygon>`×7）
- **文件大小**：**69,923 字节（68.3 KB）**
- **用到的特性**：
  - **不随缩放变粗的描边 (`vector-effect="non-scaling-stroke"`)**：顶部与底部的 90 组非均匀缩放（`scale(sc_x, sc_y)`）哥特铁艺菱形花饰及 5 个嵌套技能图标内部几何均声明了 `vector-effect="non-scaling-stroke"`，确保在任意非等比缩放下描边粗细恒定。
  - **文字描边在填充下方 (`paint-order: stroke fill`)**：所有中文与数字标签（`840`、`血魂值`、`生命 840 / 1000`、`魔力 7 / 10`、5 个技能名、`第 12 回合`）均使用 `Noto Sans CJK SC` 并声明 `paint-order="stroke fill"`，使粗暗色描边衬托在明亮填充字形下方而不侵蚀字面。
  - **箭头标记 (`<marker>`)**：定义了 `#hud_arrow_gold`（支持 `orient="auto-start-reverse"`）与 `#hud_arrow_cyan`，挂载于面板刻度轨的 `marker-start`、`marker-mid` 与 `marker-end`。
  - **嵌套 `<svg>` 与 `preserveAspectRatio`**：包含 6 个嵌套 `<svg>` 视口（5 个技能槽与右侧首领纹章槽），分别测试了 `preserveAspectRatio="xMidYMid meet"` 与 `preserveAspectRatio="xMidYMid slice"`。
- **动画清单**：

  | 目标元素 | 动画属性 | 实现方式 | 时长 | 循环 | 触发方式 |
  |---|---|---|---|---|---|
  | 左侧血瓶液面与横向血条双层液面 (`#hud_blood_orb_and_hp_bar path`) | `d`（三次贝塞尔波浪液面起伏形变，前后命令与点数严格一致） | SMIL `<animate attributeName="d">` | `1.8s / 2.0s / 2.2s` | 无限循环 | 自动开始 |
  | 血魂值、生命值、魔力值数字组 (`.hud-num-bounce`) | `transform`（仅动位移与缩放弹跳，文字内容保持不变） | CSS `@keyframes numJump` + SMIL `<animateTransform type="translate">` | `1.6s` | 无限循环 | 自动开始 |

- **最难画对的地方**：
  **`vector-effect="non-scaling-stroke"` 在非等比缩放组与嵌套 `<svg preserveAspectRatio="...">` 中的矩阵逆变换计算，以及 `paint-order: stroke fill` 的中文字形轮廓渲染**：渲染器在绘制嵌套 `<svg>` 内部带 `non-scaling-stroke` 的多边形时，必须剥离父级 `G` 变换和内嵌 `viewBox` 缩放矩阵来保持屏幕空间线宽一致。

### 11. `ui_hud_slot.svg` — 带动态文字槽的战斗界面装饰面板（新增主图）

- **画框尺寸**：`1280×240`
- **元素个数**：**707 个元素**（在 `ui_hud.svg` 的 686 个元素基础上新增悬挂锁链、晃动铭牌底座、空文字槽 `#slot_text` 与前景遮挡锁扣 `#plaque_foreground_clasp`）
- **文件大小**：**72,558 字节（70.9 KB）**
- **用到的特性**：
  - **完整保留 `ui_hud.svg` 全部特性**：包含 90 组非均匀缩放 `vector-effect="non-scaling-stroke"` 哥特铁艺花饰、`paint-order: stroke fill` 中文描边文字、`<marker>` 箭头刻度轨与 6 个嵌套 `<svg preserveAspectRatio="...">` 技能槽。
  - **周期摆动的悬挂铭牌 (`#hud_swinging_plaque`)**：通过双侧铁链悬挂于魔力条下方（旋转轴心 `(430, 156)`），牌面字框尺寸为 `220×44`（范围 `x=320..540, y=174..218`），以 `2.4s` 为一个完整来回周期左右摆动 `±4°`（待机第 `0ms` 时处于 `0°` 水平基准位置）。
  - **内部空槽与前景遮挡关系 (`#slot_text` + `#plaque_foreground_clasp`)**：空的 `<g id="slot_text"></g>` 位于 `#hud_swinging_plaque` 组内部，随铭牌同步摆动；紧随 `#slot_text` 之后声明了前景铁链与红宝石锁扣组 `#plaque_foreground_clasp`（斜跨 `x=476..516, y=172..218`），因此在渲染顺序上会自然压在动态插入文字的右下角上方。
  - **槽位参数（已写入 `ui_hud_slot.json`）**：待机第 `0ms` 时字框中心点坐标为 `(430, 196)`，推荐字号为 `28`，即 `"槽": { "slot_text": [430, 196, 28] }`。
- **动画清单**：

  | 目标元素 | 动画属性 | 实现方式 | 时长 | 循环 | 触发方式 |
  |---|---|---|---|---|---|
  | 左侧血瓶液面与横向血条双层液面 (`#hud_blood_orb_and_hp_bar path`) | `d`（三次贝塞尔波浪液面起伏形变） | SMIL `<animate attributeName="d">` | `1.8s / 2.0s / 2.2s` | 无限循环 | 自动开始 |
  | 血魂值、生命值、魔力值数字组 (`.hud-num-bounce`) | `transform`（位移与缩放弹跳） | CSS `@keyframes numJump` + SMIL `<animateTransform type="translate">` | `1.6s` | 无限循环 | 自动开始 |
  | 悬挂铭牌整体组 (`#hud_swinging_plaque` / `#plaque_swing_smil`) | `transform: rotate(0deg -> 4deg -> 0deg -> -4deg -> 0deg)`（绕 `(430, 156)` 左右摆动 `±4°`） | CSS `.plaque-swing-css` (`@keyframes plaqueSwing`) + SMIL `<animateTransform id="plaque_swing_smil" type="rotate">` | `2.4s` | 无限循环 | 自动开始 |

- **最难画对的地方**：
  **动态宿主变换继承与画家算法层级遮挡（Slot Interleaving）**：运行时注入 `#slot_text` 的动态文字（如 `伤害 +128`）既要继承父组 `#hud_swinging_plaque` 的实时 `±4°` 旋转矩阵，又必须严格处于铭牌底板之上、前景锁链锁扣 `#plaque_foreground_clasp` 之下，任何将文字层简单提升到顶层 Canvas Overlay 的做法都会破坏前景锁扣压住文字一角的遮挡关系。

## 三、`icons/` 30 个小图标逐项说明（宝物、宝石、状态）

- **统一规格**：每个图标均为 `128×128`（`viewBox="0 0 128 128" width="128" height="128"`），独立文件，不含任何 `<text>` 文字元素。
- **共用特性**：每个图标均包含 3 个渐变（背景径向渐变 `#bg_i`、带焦点偏移 `fx`/`fy` 的主体径向渐变 `#main_i`、金属边框线性渐变 `#rim_i`）、1 个基于 `feGaussianBlur` + `feMerge` 的外发光滤镜 `#glow_i`、`stroke-dasharray` 虚线内环、哥特铆钉底座与高光切面。
- **动画比例**：30 个图标中共有 **10 个（正巧三分之一）** 带有循环小动画，同时覆盖 CSS `@keyframes` 与 SMIL（`<animate>` / `<animateTransform>`）。

| 序号 | 文件名 | 类别与名称 | 元素个数 | 文件大小 | 是否带动画 & 动画细节 |
|---:|---|---|---:|---:|---|
| 1 | `icons/icon_gem_ruby.svg` | 宝石：猩红血钻 | **116** | 10,533 字节（10.3 KB） | 是（CSS `.icon-anim-pulse` + SMIL `<animateTransform type="scale">`，2.2s 呼吸发光循环） |
| 2 | `icons/icon_gem_sapphire.svg` | 宝石：深渊蓝宝石 | **117** | 10,753 字节（10.5 KB） | 是（CSS `.icon-anim-spin` 星轨外环 4.0s 360° 旋转循环） |
| 3 | `icons/icon_gem_emerald.svg` | 宝石：剧毒祖母绿 | **120** | 11,235 字节（11.0 KB） | 是（CSS `.icon-anim-float` + SMIL `<animateTransform type="translate">`，2.4s 上下悬浮循环） |
| 4 | `icons/icon_gem_amethyst.svg` | 宝石：虚空紫水晶 | **116** | 10,534 字节（10.3 KB） | 是（CSS `.icon-anim-pulse` + SMIL `<animateTransform type="scale">`，2.2s 脉动发光循环） |
| 5 | `icons/icon_gem_topaz.svg` | 宝石：烈阳黄玉 | **116** | 9,972 字节（9.7 KB） | 否（静止图标） |
| 6 | `icons/icon_gem_diamond.svg` | 宝石：星辰棱镜钻 | **118** | 10,321 字节（10.1 KB） | 否（静止图标） |
| 7 | `icons/icon_gem_obsidian.svg` | 宝石：冥界黑曜石 | **114** | 9,617 字节（9.4 KB） | 否（静止图标） |
| 8 | `icons/icon_gem_opal.svg` | 宝石：幻彩月光石 | **116** | 9,970 字节（9.7 KB） | 否（静止图标） |
| 9 | `icons/icon_gem_amber.svg` | 宝石：远古龙血珀 | **118** | 10,324 字节（10.1 KB） | 否（静止图标） |
| 10 | `icons/icon_gem_soulstone.svg` | 宝石：缚魂魔晶 | **114** | 9,617 字节（9.4 KB） | 否（静止图标） |
| 11 | `icons/icon_relic_chalice.svg` | 宝物：鲜血圣杯 | **111** | 9,644 字节（9.4 KB） | 是（CSS `.icon-anim-float` + SMIL `<animateTransform type="translate">`，2.4s 圣杯悬浮循环） |
| 12 | `icons/icon_relic_lantern.svg` | 宝物：引魂提灯 | **110** | 9,503 字节（9.3 KB） | 是（CSS `.icon-anim-pulse` + SMIL `<animateTransform type="scale">`，2.2s 冥火脉动循环） |
| 13 | `icons/icon_relic_hourglass.svg` | 宝物：永夜沙漏 | **109** | 9,386 字节（9.2 KB） | 是（CSS `.icon-anim-spin` 时间星轨环 4.0s 旋转循环） |
| 14 | `icons/icon_relic_crown.svg` | 宝物：荆棘骨冠 | **107** | 8,532 字节（8.3 KB） | 否（静止图标） |
| 15 | `icons/icon_relic_grimoire.svg` | 宝物：禁忌魔导书 | **107** | 8,545 字节（8.3 KB） | 否（静止图标） |
| 16 | `icons/icon_relic_dagger.svg` | 宝物：祭祀仪式匕首 | **108** | 8,628 字节（8.4 KB） | 否（静止图标） |
| 17 | `icons/icon_relic_ring.svg` | 宝物：伯爵血色戒 | **107** | 8,516 字节（8.3 KB） | 否（静止图标） |
| 18 | `icons/icon_relic_mirror.svg` | 宝物：窥秘魔镜 | **107** | 8,509 字节（8.3 KB） | 否（静止图标） |
| 19 | `icons/icon_relic_key.svg` | 宝物：古堡地牢骷髅钥 | **109** | 8,620 字节（8.4 KB） | 否（静止图标） |
| 20 | `icons/icon_relic_bell.svg` | 宝物：镇魂丧钟 | **107** | 8,556 字节（8.4 KB） | 否（静止图标） |
| 21 | `icons/icon_status_burn.svg` | 状态：炼狱灼烧 | **110** | 9,724 字节（9.5 KB） | 是（SMIL `<animate attributeName="d">` 1.6s 火焰外焰路径形变循环） |
| 22 | `icons/icon_status_poison.svg` | 状态：凋零剧毒 | **110** | 9,567 字节（9.3 KB） | 是（CSS `.icon-anim-float` + SMIL `<animateTransform type="translate">`，2.4s 毒雾升腾循环） |
| 23 | `icons/icon_status_curse.svg` | 状态：深渊诅咒 | **109** | 9,442 字节（9.2 KB） | 是（CSS `.icon-anim-spin` 诅咒符文环 4.0s 旋转循环） |
| 24 | `icons/icon_status_bleed.svg` | 状态：撕裂流血 | **108** | 8,658 字节（8.5 KB） | 否（静止图标） |
| 25 | `icons/icon_status_freeze.svg` | 状态：极寒冰封 | **108** | 8,659 字节（8.5 KB） | 否（静止图标） |
| 26 | `icons/icon_status_shield.svg` | 状态：圣银壁垒 | **108** | 8,657 字节（8.5 KB） | 否（静止图标） |
| 27 | `icons/icon_status_silence.svg` | 状态：禁魔锁链 | **108** | 8,656 字节（8.5 KB） | 否（静止图标） |
| 28 | `icons/icon_status_haste.svg` | 状态：暗影疾行 | **108** | 8,656 字节（8.5 KB） | 否（静止图标） |
| 29 | `icons/icon_status_vampiric.svg` | 状态：鲜血汲取 | **108** | 8,655 字节（8.5 KB） | 否（静止图标） |
| 30 | `icons/icon_status_stun.svg` | 状态：雷霆眩晕 | **108** | 8,656 字节（8.5 KB） | 否（静止图标） |

- **图标组最难画对的地方**：
  当同屏同时渲染数百个不同图标实例时，每个图标各自拥有独立的 `<filter id="glow_...">`（`feGaussianBlur` + `feMerge`）与焦点偏移径向渐变，且其中三分之一的图标持续执行 CSS `transform-box: fill-box` 缩放/旋转或 SMIL `d` 路径形变；非常考验渲染器的纹理图集管理（Atlas Eviction）、小尺寸离屏 FBO 复用以及 `transform-box: fill-box` 局部中心点计算的准确性。

## 四、新增 3 个 `currentColor` 染色测试图标逐项说明（`128×128`）

- **共同规格**：画框尺寸均为 `128×128`（`viewBox="0 0 128 128" width="128" height="128"`），根节点统一声明默认颜色 `style="color: #b83a3a"`，无动画、无 `<text>` 文字元素。测试时仅修改根元素 `<svg>` 的 `color`（默认红 `#b83a3a`、蓝色 `#3a6fd8`、金色 `#e0b030`），内部节点不做任何改动。

| 序号 | 文件名 | 类别与名称 | 元素个数 | 文件大小 | 染色规则与特性实现 |
|---:|---|---|---:|---:|---|
| 1 | `icons/icon_tint_flat.svg` | 阵营纹章旗帜（纯 `currentColor` 剪影） | **107** | 10,493 字节（10.2 KB） | **仅用 `currentColor`**：所有形状的 `fill` 与 `stroke` 均为 `currentColor`（或 `none`），不含任何其他颜色字面量、不含渐变、不含滤镜，明暗层次完全通过 `opacity`、`fill-opacity` 与 `stroke-opacity`（`0.08`–`1.0`）表现。 |
| 2 | `icons/icon_tint_shaded.svg` | 炼金药水瓶（`currentColor` 瓶身 + 固定明暗 + 做旧颗粒滤镜） | **104** | 9,098 字节（8.9 KB） | **纯色染色叠固定明暗与滤镜**：瓶身、封蜡与绶带使用 `fill="currentColor"` 纯色；上方叠加固定颜色的半透明白色高光（`#ffffff` + `fill-opacity`/`stroke-opacity`）与半透明黑色阴影（`#000000` + `fill-opacity`）；最外层 `#tint_shaded_potion_root` 挂载做旧颗粒滤镜 `#vintage_grain_filter`（`feTurbulence type="fractalNoise"` + `feColorMatrix` + 双步 `feComposite`）。 |
| 3 | `icons/icon_tint_gradient.svg` | 棱光秘仪宝石（渐变停靠点 `currentColor` + `overlay` 反光） | **92** | 7,289 字节（7.1 KB） | **渐变色标染色叠混合模式**：径向渐变 `#gem_tint_radial` 与切面线性渐变 `#gem_facet_lit`、`#gem_facet_deep` 的亮部停靠点使用 `stop-color="currentColor"`，暗部停靠点使用固定深色（`#12071c`、`#1a0926`、`#0b0312`）；宝石切面上方再压一层声明 `style="mix-blend-mode: overlay"` 的高光反射组 `#gem_overlay_reflection`。 |

