# 八个微场景（实验 5）

这是一次性的 SVG/Skia 对照实验，不是 SVG 解析器、编译器或运行时。

## 状态

- 已手写 8 个 SVG 和一份对应 C++，每场景 256×256。
- 固定 Skia 提交的真实头文件语法检查已通过；Linux 上已用实验 4 的 Chromium 配置静态库和 LLVM 24 实际链接、运行，产出 24 张 RGBA 和 PNG。
- 渐变和滤镜内部参数已读取 Chromium 157.0.8103.50 的 Blink 源码核对；来源、行号和完整文件指纹见 `sources.json`。
- **没有 Chrome 像素参照，没按实际绘制指令校准，不能判实验 5 及格。** 当前 Linux 环境的 Chrome 启动受本地 socket 权限限制。Mac 未测。
- 未编默认配置 Skia，尚无“默认配置对 Chromium 配置”的像素数字；只有测出差异后才进入该排查步骤。

## 运行

先按实验 4 编好相应平台的 Skia，使用相同 `SVG_RENDER_CACHE`：

```sh
node 实验/micro/run.mjs
node 实验/micro/run.mjs --skia-only
node 实验/micro/run.mjs --output=/tmp/micro
```

完整模式使用 `tools/ref/index.mjs` 的参照会话出冻结 PNG、SVG、元数据和每帧指令记录，然后用正式 `compareFiles` API 比图。默认输出 `out/linux/micro/` 或 `out/mac/micro/`。复用一个 Chrome 会话，避免 24 次启动；只关闭自身会话。

`--skia-only` 只编译并画 24 张图，成功退出 0 **不表示实验通过**；`result.json` 的 `及格` 和 `像素及格` 仍为 false，指标保持 null。完整模式缺参照、链接失败等情况都会留下阻塞原因并退出 2，不生成虚构指标。代码当前有人工指令核对门槛，即便将来像素全过，`及格` 也保持 false，直到核对实际指令后更新代码及验证记录。

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

## 源码核对和待查问题

`gradient.cc` 的 ApplyToFlags 固定开抖动。SVG resource 两种渐变明确选择非预乘插值，ResolveSkInterpolation 对旧式颜色选择 sRGB；本实现显式设置这两项，不能仅凭 Skia 默认值碰巧相同。径向渐变传焦点半径 0 到中心半径 106。

`FEGaussianBlur::CreateImageFilter` 使用 kDecal 并携带裁剪区域。`FEDropShadow::CreateImageFilter` 选择阴影加前景，颜色 alpha 乘 flood-opacity。本实验两者都用 sRGB，绘图 CTM 带倍率，不能再手动给 σ 乘一次倍率。

仍须在可运行固定 Chrome 的机器获取指令，核对图元路径表达、抗锯齿、存层边界、遮罩和混合模式层次；量出全部 24 帧。出现失败时先核查实验 4 的宏，再查分块、倍率、裁剪、抖动、颜色空间、小 σ 的模糊路径。原因无法查明时停止并询问，不通过加宽阈值蒙混。

链接器注意：Emscripten 包含 `lld` 通用驱动而不一定有 `ld.lld`。Linux 脚本仅在输出目录创建 `ld.lld` 符号链接来选择 GNU 驱动。不会修改下载缓存内容。Mac 使用系统 clang++ 的 Apple 链接器，调用方和静态库须使用相同实验 4 配置；Mac 尚未实际验证。
