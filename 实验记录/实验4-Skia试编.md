# 实验4：Skia试编

只在Linux实测，Mac尚未验证。

- Chrome157.0.8103.50官方DEPS核对Skia提交：ca84ce0a6f1659748188469a89361ccea71e3a64。
- Chromium配置逐项表见报告/Chromium的Skia设置.md，使用同一个配置头，不用Skia默认像素设置。
- Linux静态库首次546步编译85.143秒，14,564,420字节。静态库数字不是动态库限额的比较对象。
- Linux单导出动态库2,993,632字节；text/data/bss分别2,488,270/40,156/5,652字节。唯一导出svg_render_probe，28种能力模式运行通过。
- WASM静态库编译完成，最终模块2,127,408字节；gzip9为779,632字节；brotli11为568,679字节，低于1,500,000字节。28模式运行通过。
- Mac的arm64和x86_64构建分支已写，未在Mac执行。6MB及格线、8MB停止线必须等Mac实测。x86_64只编译、检查架构/导出/体积，不额外要求Rosetta。

## 可重复命令

先设置SVG_RENDER_CACHE并运行npm run setup。然后运行：

- npm run build:skia -- linux-x64
- npm run link:skia -- linux-x64
- npm run build:skia -- wasm
- npm run link:skia -- wasm

## 已处理问题

仅在缓存构建副本移除无GN开关的BMP/WBMP编解码源及默认宏，保留原始源码。上游WASM激活动作会固定安装4.0.7，改由外层脚本显式使用已批准7.0.0，避免隐式下载换版。Emscripten只带通用lld，链接时在生成目录创建ld.lld符号链接以选择ELF驱动。

WASM首次编译已经成功但报告代码误找libskia.a，实际名称是libskia.wasm.a；已修复并重新验证增量构建。完整命令、每模式指纹和体积见报告/linux/Skia-Linux.json与Skia-WASM.json。
