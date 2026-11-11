# Blink对照表初稿

本表严格区分官方源码核对与实际绘制指令。固定Chrome157.0.8103.50目前在Linux无法启动，**本任务没有取得实际LayerTree绘制记录**。此表是后续校准的起点，不能用来声称实验5通过。

| 特性 | 当前依据与调用 | 尚需实际指令核对 |
|---|---|---|
| 线性渐变 | 官方layout_svg_resource_linear_gradient.cc明确非预乘插值；gradient.cc使用SkShaders::LinearGradient，sRGB与抖动 | 渐变坐标变换、裁剪、画笔全部标志 |
| 焦点偏移径向渐变 | 官方layout_svg_resource_radial_gradient.cc与gradient.cc使用TwoPointConicalGradient，非预乘插值 | 焦半径、local matrix、所有倍率下实际图元 |
| 高斯模糊 | 官方fe_gaussian_blur.cc按滤镜横纵比例缩放σ，kDecal，并传裁剪区域 | 分层边界、最终crop、σ小值路径 |
| 投影 | 官方fe_drop_shadow.cc为shadow+foreground，并有明确crop | 合成顺序、色彩空间及最终层边界 |
| 矩形/圆/椭圆 | docs/试验说明中设计作者既有试验观察到drawRect/drawOval，本任务尚未重取 | 必须在157.0.8103.50重取并保存原始指令 |
| 圆角矩形/路径 | 当前微场景C++用Skia对应图元和PathBuilder；设计作者旧试验记录圆角矩形可能走带conic路径 | 实际Chrome是否保留图元或改路径，以及填充/抗锯齿标志 |
| 组透明度/滤镜组 | 当前C++使用saveLayer；设计作者旧试验见“存层” | 层范围、回放顺序、clip和paint |
| 描边/虚线/裁剪/遮罩/混合 | 微场景已实现，但尚无本版本实际指令证据 | 全部需核对，亮度遮罩和linearRGB尤其不能仅凭视觉推断 |

已读取的固定版本源码URL、行范围与SHA256见实验/micro/sources.json。工具会保存每素材0毫秒1倍原始指令；梯度和滤镜内部参数在CDP日志可能为空，必须结合上述源码解释，而不是把空日志当默认参数。
