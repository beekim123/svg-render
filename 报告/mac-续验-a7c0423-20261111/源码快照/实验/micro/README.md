# 八个微场景（实验 5）

这是一次性的 SVG/Skia 对照实验，不是 SVG 解析器、编译器或运行时。

## 状态

- 已手写 8 个 SVG 和一份对应 C++，每场景 256×256。
- 固定 Skia 提交的真实头文件语法检查已通过；Linux 上已用实验 4 的 Chromium 配置静态库和 LLVM 24 实际链接、运行，产出 24 张 RGBA 和 PNG。
- 渐变和滤镜内部参数已读取 Chromium 157.0.8103.50 的 Blink 源码核对；来源、行号和完整文件指纹见 `sources.json`。
- 2026-11-11，Mac arm64 在基提交 `a7c0423` 加当前本地补丁上，已取得固定 Chrome 的 24 份真实指令，完成调用、画笔、裁剪和层结构校准；当前 Chromium 配置的 24/24 帧通过三条像素线，最低 SSIM 为 `0.9993431303`。校准记录见 `报告/mac-续验-a7c0423-20261111/指令校准.md`。这是本次确切场景的实验 5 技术结果，阶段 0 整体验收和用户验收仍分别判定。
- 同一 CPU 最小模块集合与工具链下，去掉 Chromium 用户配置头的默认宏版本已完成 24 帧对照；相对 Chromium 宏版本的最低 SSIM 为 `0.9980351`。该结果证明本组场景存在实际像素差异；默认宏版本不作为实验 5 放行依据，也不代表启用所有模块的 Skia 默认包。
- Linux 已有真实 Skia 输出，但仍未取得真实 Chrome 指令和像素验证；Mac 的校准凭据不能用于 Linux。

## 运行

先按实验 4 编好相应平台的 Skia，使用相同 `SVG_RENDER_CACHE`：

```sh
node 实验/micro/run.mjs
node 实验/micro/run.mjs --skia-only
node 实验/micro/run.mjs --output=/tmp/micro
```

完整模式使用 `tools/ref/index.mjs` 的参照会话出冻结 PNG、SVG、元数据和每帧指令记录，然后用正式 `compareFiles` API 比图。默认输出 `out/linux/micro/` 或 `out/mac/micro/`。复用一个 Chrome 会话，避免 24 次启动；只关闭自身会话。

`--skia-only` 只编译并画 24 张图，成功退出 0 **不表示实验通过**；`result.json` 的 `及格` 和 `像素及格` 仍为 false，指标保持 null。完整模式只有 24 帧像素全部达标、当前校准凭据有效且清理成功时，才写入 `及格=true` 并退出 0。

`calibration.json` 绑定 Mac arm64、当前 C++、源码依据、Chromium 配置头、Chrome 启动代码、参照配置、8 个 SVG、两份静态库、实际 GN 参数及 24 份归一化指令的 SHA256；指令指纹只去掉会话相关的 `layerId`，保留层尺寸、顺序和完整 commands。凭据缺失、输入变化或平台不符都会使校准失效，即使像素通过也退出 2，不能自动更新凭据放行。凭据须在重新技术核对后更新。

缺参照、链接失败等执行异常退出 2；像素不达标触发需求第 9 节并退出 3。像素与指令已通过后，若本次 Chrome 进程或 profile 清理失败，仍撤销整体通过、记录清理失败并退出 2，保留原像素与校准结果供排查。

输出位图先用 RGBA8888、预乘 alpha、sRGB 光栅化，再通过 Skia `readPixels` 转成非预乘 RGBA。Node 用固定依赖 pngjs 编码 PNG，不调用 Skia 编解码。原始 `.rgba` 方便独立检查通道和 alpha。Chrome PNG 保留原字节，不重新编码。

完整对照产物在 `compare/index.html` 和 `compare/结果.json`。判定三项：SSIM≥0.999、不算边大差比例≤0.0001、最大差异块=0。平均偏色照常给出，但需求没有给实验 5 的偏色门槛，故不会另加门槛。

## 覆盖

1. 凸/凹/自交路径，nonzero/evenodd，小数坐标，全组旋转 17 度。
2. 矩形、带椭圆半径的圆角矩形、圆、椭圆、线。
3. butt/round/square 端点，miter/round/bevel 拐角，miterlimit 4/1，四段虚线及偏移 9；子变换 scale(2) 加 non-scaling-stroke。最后一条线在三种根倍率下都是 5 个 CSS 像素粗。
4. pad/repeat/reflect，12 度 gradientTransform，四个停靠点及 0.3/0.75 alpha；非预乘 sRGB 插值及抖动。
5. 焦点 (87,93) 偏离中心 (128,128)，半径 106，双圆锥梯度。
6. 组 opacity=0.45 内重叠矩形、圆和三角形，单个离屏层合成，不能逐元素乘 alpha。
7. σ=0.8/3/12，投影 (8,6)、σ=3、alpha=0.65，显式裁掉模糊及阴影一部分。SVG 显式使用 sRGB 滤镜插值，避免把默认 linearRGB 当成 sRGB。
8. 路径 clipPath，彩色亮度 mask，独立隔离组内 multiply 和 screen。亮度遮罩必须转换为 alpha，不能直接拿彩色遮罩的不透明度。

## 源码核对和后续验证

`gradient.cc` 的 ApplyToFlags 固定开抖动。SVG resource 两种渐变明确选择非预乘插值，ResolveSkInterpolation 对旧式颜色选择 sRGB；本实现显式设置这两项，不能仅凭 Skia 默认值碰巧相同。径向渐变传焦点半径 0 到中心半径 106。

`FEGaussianBlur::CreateImageFilter` 使用 kDecal 并携带裁剪区域。`FEDropShadow::CreateImageFilter` 选择阴影加前景，颜色 alpha 乘 flood-opacity。本实验两者都用 sRGB，绘图 CTM 带倍率，不能再手动给 σ 乘一次倍率。

本次 Mac 已按真实指令核对图元路径表达、抗锯齿、存层边界、遮罩和混合模式层次，并重新运行全部 24 帧。CDP 未展开的 shader、imageFilter、colorFilter 和 pathEffect 内部参数，由固定 Blink/cc 源码及 SVG 明确数值补证，范围限于本组场景。后续源码、配置、静态库或指令变化后须复核凭据并重跑；出现失败时先核查实验 4 的宏，再查分块、倍率、裁剪、抖动、颜色空间、小 σ 的模糊路径。原因无法查明时停止并询问，不通过加宽阈值蒙混。

链接器注意：Emscripten 包含 `lld` 通用驱动而不一定有 `ld.lld`。Linux 脚本仅在输出目录创建 `ld.lld` 符号链接来选择 GNU 驱动。不会修改下载缓存内容。Mac 使用系统 clang++ 的 Apple 链接器，调用方和静态库须使用相同实验 4 配置；本次 Mac arm64 已实际编译、链接并运行。
