# Chromium 的 Skia 设置

版本：Chromium 157.0.8103.50；Skia ca84ce0a6f1659748188469a89361ccea71e3a64。核对日期：2026-11-11。

## 范围与验证状态

已完整读取标签下 skia/BUILD.gn、skia/config/ 的全部三个文件，以及 skia/features.gni、build/config/avx512.gni。config 目录经官方 Gitiles JSON 列举，只有 SkUserConfig.h、sk_ref_cnt_ext_debug.h、sk_ref_cnt_ext_release.h。来源：[Chromium 标签](https://chromium.googlesource.com/chromium/src/+/157.0.8103.50/skia/)、[Skia 固定提交](https://skia.googlesource.com/skia/+/ca84ce0a6f1659748188469a89361ccea71e3a64/)。DEPS 提交核对由主构建流程负责，本表不冒充已独立核对。

Linux x64 参数已用现有 GN 执行 gen 成功（91 targets、39 files），随后 gn args --list --short 成功。审计输出独立存于缓存 skia-args-audit；编译器为现有 Emscripten 7.0.0 包中的 LLVM 24 clang/clang++。这里只验证参数图，不编译，不验证 Mac/WASM 工具链，不给体积和像素验收结论。

本表是 Chromium Skia 局部配置的完整清单，不是官方 CfT 二进制全量编译参数证明。Chromium 的全局 compiler、PGO、链接器版本、运行时 CPU 分派和 Blink 滤镜输入仍会影响结果；尚未取得官方 CfT 的 args.gn，不能把标签默认值冒称发布包实际值。

## 宏逐条核对

表中保留重复定义及其行号，条件以对应源行上下文为准；例如 release 不会执行 DCHECK_ALWAYS_ON 分支。三个目标均非 Android。字体伽马分支：Linux exponent=1.2 / contrast=0.2；Mac sRGB / contrast=0；Android exponent=1.4 / contrast=0 且 APPLY_TO_A8；Windows sRGB / contrast=1。本次字体全关，因此不施加这些字体专用宏；头中显式 undef 独立 Skia 默认加的 APPLY_TO_A8，防止以后误认与 Chromium 一致。

| 来源:行 | 宏及原值 | 取舍 | 理由/替代 |
|---|---|---|---|
| skia/config/SkUserConfig.h:11 | `define SKIA_CONFIG_SKUSERCONFIG_H_` | 和我们无关 | 原文件 include guard；替代头用自己的 guard，扩展头不编译。 |
| skia/config/SkUserConfig.h:31 | `undef SK_RELEASE` | 照抄 | official release 不启用 DCHECK_ALWAYS_ON；由 Skia NDEBUG/SkTypes 选择 release，不强制调试。 |
| skia/config/SkUserConfig.h:32 | `define SK_DEBUG` | 照抄 | 仅 DCHECK_ALWAYS_ON 才覆写；本实验不定义该条件，不强行打开 SK_DEBUG。 |
| skia/config/SkUserConfig.h:38 | `define SK_PDF_USE_HARFBUZZ_SUBSET` | 和我们无关 | 只影响已关闭的 PDF/图片编解码与元数据读取。 |
| skia/config/SkUserConfig.h:44 | `define SK_CANVAS_SAVE_RESTORE_PREALLOC_COUNT 16` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:47 | `define SK_API COMPONENT_EXPORT(SKIA)` | 抄不了 | COMPONENT_EXPORT(SKIA) 依赖 base；使用 Skia 自带 SK_API，静态链接进只导出包装函数的动态库。 |
| skia/config/SkUserConfig.h:51 | `define SK_PDF_DO_NOT_SUPPORT_TYPE_1_FONTS` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/config/SkUserConfig.h:54 | `define SK_REF_CNT_MIXIN_INCLUDE "skia/config/sk_ref_cnt_ext_debug.h"` | 抄不了 | Blink WTF 引用计数适配；不 include Chromium 两个扩展头，使用 Skia 原生 SkRefCnt。release 扩展主要增加 deref 别名；debug 增加 adoption 检查。 |
| skia/config/SkUserConfig.h:56 | `define SK_REF_CNT_MIXIN_INCLUDE "skia/config/sk_ref_cnt_ext_release.h"` | 抄不了 | Blink WTF 引用计数适配；不 include Chromium 两个扩展头，使用 Skia 原生 SkRefCnt。release 扩展主要增加 deref 别名；debug 增加 adoption 检查。 |
| skia/config/SkUserConfig.h:60 | `define SkDebugf(...) SkDebugf_FileLine(__FILE__, __LINE__, __VA_ARGS__)` | 抄不了 | SkDebugf_FileLine 依赖 ext/google_logging.cc 和 base，保留 Skia 原生日志。 |
| skia/config/SkUserConfig.h:61 | `define SkLog(...) SkLog_FileLine(__FILE__, __LINE__, __VA_ARGS__)` | 抄不了 | SkLog_FileLine 依赖 Chromium 日志实现，保留 Skia 原生日志。 |
| skia/config/SkUserConfig.h:72 | `define SK_ABORT(format, ...) SkAbort_FileLine(__FILE__, __LINE__, \` | 抄不了 | SkAbort_FileLine 依赖 Chromium 日志，保留 Skia 原生失败终止实现。 |
| skia/config/SkUserConfig.h:80 | `define SK_A32_SHIFT    24` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:81 | `define SK_R32_SHIFT    16` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:82 | `define SK_G32_SHIFT    8` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:83 | `define SK_B32_SHIFT    0` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:88 | `define SK_CPU_LENDIAN` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:89 | `undef SK_CPU_BENDIAN` | 照抄 | Mac undef；UNIX 大端直接报错，三个目标均小端。 |
| skia/config/SkUserConfig.h:96 | `define SK_USE_FREETYPE_EMBOLDEN` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/config/SkUserConfig.h:113 | `define SK_TRIVIAL_ABI [[clang::trivial_abi]]` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:115 | `define SK_TRIVIAL_ABI` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:118 | `define SK_TRIVIAL_ABI` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:129 | `define SK_SUPPORT_LEGACY_ANISOTROPIC_MIPMAP_SCALE` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:132 | `define GR_AA_TESSELLATOR_MAX_VERB_COUNT 100` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/config/SkUserConfig.h:134 | `define SK_SUPPORT_LEGACY_CONIC_CHOP` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:136 | `define SK_USE_PADDED_BLUR_UPSCALE` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:138 | `define SK_LEGACY_INITWITHPREV_LAYER_SIZING` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:140 | `define SK_AVOID_SLOW_RASTER_PIPELINE_BLURS` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:142 | `define SK_SUPPORT_LEGACY_RRECT_TRANSFORM` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:144 | `define SK_USE_SAFE_INSET_FOR_TEXTURE_SAMPLING` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:146 | `define SK_GRAPHITE_USE_LEGACY_RRECT_CLIP_SHADER` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/config/SkUserConfig.h:148 | `define SK_SUPPORT_LEGACY_GRAPHITE_RRECT_BLUR` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/config/SkUserConfig.h:150 | `define SK_DISABLE_GRAPHITE_NONINTEGRAL_VARYINGS_FLAT_INTERPOLATION` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/config/SkUserConfig.h:157 | `define SK_ALLOW_STATIC_GLOBAL_INITIALIZERS 0` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:160 | `define SK_FONT_CONFIG_INTERFACE_ONLY_ALLOW_SFNT_FONTS` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/config/SkUserConfig.h:163 | `define SK_STRIKE_CACHE_DOESNT_AUTO_CHECK_PINNERS` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/config/SkUserConfig.h:165 | `define SK_USE_DISCARDABLE_SCALEDIMAGECACHE` | 照抄 | 保留宏，但 Chromium 跨进程池抄不了；独立 SkDiscardableMemory_none.cpp 实际接 SkGetGlobalDiscardableMemoryPool，非空壳，记录替代。 |
| skia/config/SkUserConfig.h:168 | `define GR_GL_CHECK_ERROR_START 0` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/config/SkUserConfig.h:171 | `define SKIA_LOWEST_ACTIVE_LOG_PRIORITY SkLogPriority::kWarning` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/SkUserConfig.h:173 | `define SKIA_LOWEST_ACTIVE_LOG_PRIORITY SkLogPriority::kInfo` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/config/sk_ref_cnt_ext_debug.h:6 | `define SKIA_CONFIG_SK_REF_CNT_EXT_DEBUG_H_` | 和我们无关 | 原文件 include guard；替代头用自己的 guard，扩展头不编译。 |
| skia/config/sk_ref_cnt_ext_release.h:6 | `define SKIA_CONFIG_SK_REF_CNT_EXT_RELEASE_H_` | 和我们无关 | 原文件 include guard；替代头用自己的 guard，扩展头不编译。 |
| skia/BUILD.gn:32 | `SKIA_SUPPORT_SKOTTIE=$skia_support_skottie` | 和我们无关 | Skottie/文字整形关闭。 |
| skia/BUILD.gn:33 | `SKIA_USE_DAWN=$skia_use_dawn` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/BUILD.gn:34 | `SKIA_USE_GRAPHITE_VULKAN=$skia_use_graphite_vulkan` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/BUILD.gn:64 | `SK_ENABLE_SKSL` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/BUILD.gn:65 | `SK_UNTIL_CRBUG_1187654_IS_FIXED` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:66 | `SK_USER_CONFIG_HEADER=\"../../skia/config/SkUserConfig.h\` | 照抄 | 改为本仓库 chromium-config.h 的绝对路径，通过 extra_cflags 传给库和调用方。 |
| skia/BUILD.gn:67 | `SK_USE_PARTITION_ALLOC` | 抄不了 | 本次最小依赖构建不接 Chromium PartitionAlloc/raw_ptr；skia_use_partition_alloc=false 使用 Skia 包装与系统分配器。影响内存、性能和诊断，不能宣称完全相同构建。 |
| skia/BUILD.gn:68 | `SK_WIN_FONTMGR_NO_SIMULATIONS` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:71 | `SK_ENABLE_LEGACY_SHADERCONTEXT` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/BUILD.gn:72 | `SK_LEGACY_DESERIAL_IMAGE_PROC` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/BUILD.gn:78 | `SK_CODEC_DECODES_PNG` | 和我们无关 | 只影响已关闭的 PDF/图片编解码与元数据读取。 |
| skia/BUILD.gn:79 | `SK_CODEC_DECODES_PNG_WITH_RUST` | 和我们无关 | 只影响已关闭的 PDF/图片编解码与元数据读取。 |
| skia/BUILD.gn:80 | `SK_CODEC_ENCODES_PNG` | 和我们无关 | 只影响已关闭的 PDF/图片编解码与元数据读取。 |
| skia/BUILD.gn:81 | `SK_CODEC_ENCODES_PNG_WITH_RUST` | 和我们无关 | 只影响已关闭的 PDF/图片编解码与元数据读取。 |
| skia/BUILD.gn:83 | `SK_CODEC_DECODES_BMP_WITH_RUST` | 和我们无关 | 只影响已关闭的 PDF/图片编解码与元数据读取。 |
| skia/BUILD.gn:84 | `SK_CODEC_DECODES_ICO_WITH_RUST` | 和我们无关 | 只影响已关闭的 PDF/图片编解码与元数据读取。 |
| skia/BUILD.gn:85 | `SK_CODEC_COLOR_PROFILE_PARSE_WITH_RUST` | 和我们无关 | 只影响已关闭的 PDF/图片编解码与元数据读取。 |
| skia/BUILD.gn:86 | `SK_EXIF_PARSE_WITH_RUST` | 和我们无关 | 只影响已关闭的 PDF/图片编解码与元数据读取。 |
| skia/BUILD.gn:90 | `SK_DISABLE_AVX512_OPTS" ]` | 照抄 | 仅 !allow_avx512；标签默认 true，因此不定义此宏。 |
| skia/BUILD.gn:93 | `SK_ENABLE_AVX512_OPTS" ]` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/BUILD.gn:104 | `SK_CODEC_DECODES_JPEG` | 和我们无关 | 只影响已关闭的 PDF/图片编解码与元数据读取。 |
| skia/BUILD.gn:105 | `SK_CODEC_ENCODES_JPEG` | 和我们无关 | 只影响已关闭的 PDF/图片编解码与元数据读取。 |
| skia/BUILD.gn:111 | `SKIA_DLL" ]` | 和我们无关 | 仅 is_component_build；实验是静态 Skia + 自己的单函数动态库。 |
| skia/BUILD.gn:118 | `SK_GAMMA_EXPONENT=1.2` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:119 | `SK_GAMMA_CONTRAST=0.2` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:123 | `SK_BUILD_FOR_ANDROID` | 和我们无关 | Android/iOS 专用分支，不属于 Linux、Mac、WASM 目标。 |
| skia/BUILD.gn:124 | `USE_CHROMIUM_SKIA` | 和我们无关 | Android/iOS 专用分支，不属于 Linux、Mac、WASM 目标。 |
| skia/BUILD.gn:125 | `SK_GAMMA_APPLY_TO_A8` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:126 | `SK_GAMMA_EXPONENT=1.4` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:127 | `SK_GAMMA_CONTRAST=0.0` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:131 | `SK_BUILD_FOR_MAC` | 照抄 | Mac 目标由 Skia 平台探测定义；Linux/WASM 不伪装成 Mac。 |
| skia/BUILD.gn:132 | `SK_GAMMA_SRGB` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:133 | `SK_GAMMA_CONTRAST=0.0` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:136 | `SK_BUILD_FOR_IOS" ]` | 和我们无关 | Android/iOS 专用分支，不属于 Linux、Mac、WASM 目标。 |
| skia/BUILD.gn:138 | `SK_BUILD_FOR_IOS_APP_EXTENSION" ]` | 和我们无关 | Android/iOS 专用分支，不属于 Linux、Mac、WASM 目标。 |
| skia/BUILD.gn:142 | `GR_GL_FUNCTION_TYPE=__stdcall` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/BUILD.gn:143 | `SK_GAMMA_SRGB` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:144 | `SK_GAMMA_CONTRAST=1.0` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:152 | `SK_GANESH` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/BUILD.gn:153 | `SK_GPU_WORKAROUNDS_HEADER=\"$workaround_header\` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/BUILD.gn:156 | `SK_GL" ]` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/BUILD.gn:159 | `SK_VULKAN=1" ]` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/BUILD.gn:164 | `SK_GRAPHITE" ]` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/BUILD.gn:166 | `SK_DAWN" ]` | 和我们无关 | 只影响已关闭的 Ganesh/Graphite、GPU API 或 GPU 着色器。 |
| skia/BUILD.gn:181 | `IS_SKIA_IMPL=1" ]` | 抄不了 | Chromium component_export 内部标记；独立构建用 SKIA_IMPLEMENTATION，二者不可机械替换头文件。 |
| skia/BUILD.gn:183 | `SKCMS_DISABLE_SKX=1" ]` | 照抄 | 仅 !allow_avx512；默认 true，故不定义。不得为省体积关闭它。 |
| skia/BUILD.gn:187 | `SK_DISABLE_LEGACY_INIT_DECODERS` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/BUILD.gn:188 | `SK_DISABLE_LEGACY_PNG_WRITEBUFFER` | 照抄 | 按原条件和值放入 chromium-config.h；CPU 行为或无法排除影响，保留。 |
| skia/BUILD.gn:192 | `SK_TYPEFACE_FACTORY_FONTATIONS" ]` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:195 | `SK_FREETYPE_MINIMUM_RUNTIME_VERSION_IS_BUILD_VERSION" ]` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:199 | `SK_TYPEFACE_FACTORY_FREETYPE` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:200 | `SK_FONTMGR_FREETYPE_EMPTY_AVAILABLE` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:204 | `SK_TYPEFACE_FACTORY_DIRECTWRITE" ]` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:207 | `SK_TYPEFACE_FACTORY_CORETEXT" ]` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:211 | `SK_ARM_HAS_NEON" ]` | 和我们无关 | Chromium 此处只为 32 位 arm；Mac arm64 由编译器/Skia 自己选择 NEON，不强加 32 位宏。 |
| skia/BUILD.gn:219 | `SK_DEFAULT_FONT_CACHE_LIMIT=1048576",  # 1024 * 1024` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:222 | `SK_DEFAULT_FONT_CACHE_LIMIT=20971520" ]  # 20 * 1024 * 1024` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:230 | `SK_DEFAULT_FONT_CACHE_COUNT_LIMIT=256` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:411 | `SK_CODEC_DECODES_JPEG_GAINMAPS" ]` | 和我们无关 | 只影响已关闭的 PDF/图片编解码与元数据读取。 |
| skia/BUILD.gn:632 | `SK_SHAPER_PRIMITIVE_AVAILABLE` | 和我们无关 | Skottie/文字整形关闭。 |
| skia/BUILD.gn:633 | `SKOTTIE_TRIVIAL_FONTRUN_ITER` | 和我们无关 | 只影响已关闭的字体后端、文字缓存/文字像素；不用于普通路径和图像滤镜。 |
| skia/BUILD.gn:650 | `SKIA_SWITCHES_IMPLEMENTATION" ]` | 和我们无关 | Chromium 命令行开关组件导出标记，不是光栅核心。 |
| skia/BUILD.gn:1133 | `SKCMS_DLL=1" ]` | 和我们无关 | 仅 component DLL 导出；实验静态 skcms。 |
| skia/BUILD.gn:1138 | `SKCMS_IMPLEMENTATION=1" ]` | 照抄 | 值 1，交由上游 modules/skcms 的 implementation config 施加，不能全局污染使用方。 |

## GN、编译与源文件选择

| Chromium 项目 | 取舍 | 独立构建处理与理由 |
|---|---|---|
| skia_support_gpu=use_blink；skia_use_gl=true；skia_use_dawn；skia_use_graphite_vulkan；enable_vulkan | 和我们无关 | 两套 GPU 后端全部 false；GPU workaround header、Dawn/Vulkan headers、Graphite/SKSL GPU backend 源组不接入。不要将 Chrome 启动 --disable-gpu 误认为其库本来没有 GPU。 |
| skia_support_pdf=use_blink && (enable_printing || enable_printing_tests) | 和我们无关 | skia_enable_pdf=false；不链接 HarfBuzz 子集化、zlib、PDF 实现，允许 PDF None stub。 |
| skia_support_skottie=!is_android | 和我们无关 | skia_enable_skottie=false；不接 jsonreader、skresources、sksg、primitive shaper。 |
| skia_support_xmp=use_blink | 和我们无关 | XMP/增益图/SVG 输出/expat 关闭；注意 standalone 中 SkParsePath 属于普通工具源，不必因此移除。 |
| use_blink / enable_freetype / use_system_freetype / is_apple / is_win 字体选择 | 和我们无关 | FreeType、Fontations、CoreText、DirectWrite、fontconfig、Android/Fuchsia 字体后端全关；空接口不等于保留字体后端。 |
| rust_common_ffi、PNG/BMP/ICO/JPEG/ICC/EXIF rust_* 及 cxx bridge | 和我们无关 | 全部图片编解码/元数据 Rust 功能关闭，不取 Rust crate。SkColorSpace/skcms 仍须保留，不能把色彩转换也误删。 |
| skia_core_sources / colorfilters / effects / effects_imagefilter / pathops | 照抄 | 完整保留五组。不得因 optimize_size 删光照、置换、算术、卷积等滤镜。 |
| skia_sksl_core_sources / skia_sksl_core_module_sources | 照抄 | 即使 GPU 关掉也保留 CPU runtime effect / RasterPipeline 支持及所需 SkSL 代码。SK_ENABLE_SKSL 在此提交可能已无消费点，仍按保守原则保留。 |
| skia_utils_private / skia_utils_chromium / skia_ports_sources | 照抄 | 保留独立上游同名组，以及当前目标的 POSIX ports；Chromium ext 的重采样、日志、内存跟踪等不是同名组的替代。 |
| skia_codec_shared / skia_codec_* / skia_encode_* / skia_xps_sources | 和我们无关 | 编码器和解码器实现关闭；shared 的类型/胶水与空 encoder 桩可能被核心引用，不假称这些文件也完全消失。XPS false。 |
| use_partition_alloc_as_malloc、PartitionAlloc raw_ptr、SkMemory_new_handler.cpp | 抄不了 | 不带 Chromium base/PA 构建，使用上游 SkMemory_malloc.cpp、raw_ptr wrapper。须在报告承认分配和性能不同。 |
| SkDiscardableMemory_chrome.cc / skia_discardable_memory_chromium | 抄不了 | 保留宏与缓存算法，改接上游本地 discardable pool；不复刻跨进程共享内存协议。需同时链接 SkDiscardableMemory_none.cpp 与 SkDiscardableMemoryPool.cpp。 |
| component_export / google_logging / histogram / tracing / switches / memory dump / base 与 ui 依赖 | 抄不了 | 使用上游日志、abort 与系统分配；关闭 Perfetto/tracing；不接 Chromium 指标及命令行组件。不宣称诊断行为相同。 |
| is_component_build / IS_SKIA_IMPL / public_configs / all_dependent_configs | 照抄 | 保留库与调用方配置一致的要求；本项目固定静态 Skia，最终包装动态库只有一个导出符号；不以 component 构建导出全 Skia。 |
| !is_debug -> optimize_max | 照抄 | is_official_build=true / is_debug=false / -O3；不得换 -Os 并声称相同。额外启用薄 LTO、分节与死代码去除用于需求中的体积实验。 |
| chromium_code -> no_chromium_code；no_exit_time_destructors；check_includes*；visibility；no_clippy | 和我们无关 | 构建警告、头依赖检查和目标可见性，不是 CPU 像素开关；独立 GN 自己管理。 |
| is_apple -> 禁用 ARC | 照抄 | 不添加 -fobjc-arc，字体/GPU Objective-C ports 已关；Mac 独立工具链负责系统 SDK。 |
| using_mismatched_sample_profile -> 移除 afdo_optimize_size | 和我们无关 | Android AFDO 体积配置；本次无 Android、无该 profile。官方 CfT 全局 PGO 未核对，不能复制未知 profile。 |
| x86/x64 ml3: -mavx2 -mbmi -mbmi2 -mf16c -mfma | 照抄 | 保留上游 ml3 源组及 x64 -march=x86-64-v3；指令集合语义对应，但不是逐字符相同命令。不把这些 flags 全局套到所有源文件。 |
| allow_avx512=true；ml4 -march=x86-64-v4 -mprefer-vector-width=512 | 照抄 | 标签 build/config/avx512.gni 默认为 true；保留 ml4 及运行时选择，不能主动 SK_DISABLE_AVX512_OPTS。M3 不编 x86 目标的 ml3/ml4。 |
| skcms TransformBaseline / TransformHsw / TransformSkx | 照抄 | 保留 skcms。x64 Hsw -mavx2 -mf16c 与 Skx AVX512；非 x64 平台空优化 target，用基线/本机路径。 |
| skcms -std=c11 / -w；SKCMS_IMPLEMENTATION；component DLL | 照抄 | 交上游 modules/skcms GN 管理 C 源与实施宏；-w 仅影响警告。仅静态构建，不打开 DLL。 |
| 32 位 arm -fomit-frame-pointer / SK_ARM_HAS_NEON；GCC arm -mfp16-format=ieee | 和我们无关 | 本次 Linux x64、Mac arm64/x64、WASM，不属于 32 位 ARM/GCC。 |
| mipsel/mips64el、loong64 LSX/LASX、ppc64、s390x、riscv64 分支 | 和我们无关 | 不属于请求目标；loong -flax-vector-conversions=all 不传播到其它架构。 |
| Windows /arch:AVX2、/arch:AVX512、/wd5041、fontsub.lib、GDI；iOS ImageIO 等 | 和我们无关 | 无 Windows/iOS 目标；Mac 的 SDK/系统库由独立工具链解决，不能照抄 Windows 标志。 |
| test_fonts / copy_fuchsia_fonts_manifest / test_fonts_resources / skia_unittests / fuzzers / benches | 和我们无关 | Chromium 测试/基准与字体资源，不进最小库；不把未运行的 Chromium 单测写成通过。 |
| is_mac && current_cpu==x64 -> use_libcxx_modules=false | 照抄 | 不启用 libc++ modules；独立 GN 本身未启用这一 Chromium 模块构建开关。 |
| Chrome 全局 compiler/compiler.gni、sanitizers、features、Rust 等 import | 抄不了 | 本次仅复现 Skia 局部决策。CfT 实际全局参数、PGO 和完整工具链未取得；以显式 O3、ffp-contract=off、固定本地 LLVM 和像素比较替代验证，不声称 bit-identical。 |

## 可复用参数与三个平台

参数在 `实验/skia/args-draft.json`，所有 common 参数名在本提交声明中核验，并已通过 Linux GN 生成。脚本须替换 `${CHROMIUM_CONFIG_HEADER}` 为头的绝对路径；合并平台时数组追加。`${EMSDK}` 是启用后的 SDK 根目录。生成后保存 `gn args --list`，不要把 JSON 元数据直接作为 GN 参数。

- Linux x64：Clang、PIC、ThinLTO、lld、--gc-sections；保留 ml3/ml4。写 PNG 时通过明确 RGBA readPixels 转换，不能把 N32 原始 BGRA 字节当 RGBA。
- Mac arm64：Xcode SDK、本机 ARM64/NEON，不强加 x86 指令；ThinLTO、-dead_strip；Mac x64 保留 ml3/ml4。两种架构分别产物和测量，实际 Mac 构建尚未验证。
- WASM：GN target_cpu="wasm"、target_os="wasm"；上游默认 SKVX_DISABLE_SIMD / SK_FORCE_8_BYTE_ALIGNMENT / SK_DISABLE_TRACING 必须记录，这是架构替代，不能声称与原生同指令。不是 CanvasKit，不复制其效果裁减宏；Emscripten LTO、导出和内存 flags 需在脚本中实际验证。

Chromium 非 Android N32 四通道位移是 A24/R16/G8/B0，三个目标照抄。Mac 强制小端。不得为方便输出 PNG 改 R/B 位移。字体关闭不意味着普通渐变的插值颜色空间可忽略；SVG `color-interpolation` 与 `color-interpolation-filters` 仍要显式映射。

## 不能漏掉的构建补丁与检查

1. 该 Skia 提交的 BUILD.gn 无条件将 `skia_codec_decode_bmp` 加进 :skia，并无条件定义 SK_CODEC_DECODES_BMP / SK_CODEC_DECODES_WBMP。不存在“关掉所有 codecs”的单一 GN 开关。只在缓存构建副本删除这两条 define 和该 sources 加法，按唯一精确匹配失败即停；留原始源与补丁指纹。用最终 target sources 和符号表确认 BMP/WBMP 不在产物，不能只看 JSON 全 false。
2. 其它图片格式通过 JSON 显式关闭；空 JPEG/PNG/WebP encoder 桩设 true。保留 `skia_codec_shared` 是为核心 API 胶水，不能把它误报成解码能力仍开；反过来也不能声称没有任何 codec 文件参与编译。
3. 不启用 SK_ENABLE_OPTIMIZE_SIZE，保留所有图像滤镜组、SkSL、SkPictureShader、SkImageShader、SkPerlinNoiseShader、pathops、SkPathMeasure 与 skcms。全能力包装函数必须真实调用并保留全部要求能力，防止死代码剔除得到虚假的小体积。
4. 库与调用方相同 SK_USER_CONFIG_HEADER、SK_TRIVIAL_ABI、颜色顺序和 release 状态。上游 is_trivial_abi=true 与头文件 clang 属性要一致。
5. 头中保留 CPU 不确定的兼容宏，即使当前搜索只见 GPU 消费点的 SK_USE_SAFE_INSET_FOR_TEXTURE_SAMPLING 也保留；其余明确 Graphite/GPU 宏不带进 CPU 目标。
6. 不把参数生成成功当链接成功、能力覆盖成功或像素一致。Mac 仍需用户实跑，WASM 仍需编译与压缩测量；每个失败须单列。

## 源文件指纹

| 文件 | SHA-256 |
|---|---|
| skia/config/SkUserConfig.h | fadc9f4b6a5265745c94f16db9cd5a68e6c551fbf0af46ecb78f0586c0dbb244 |
| skia/config/sk_ref_cnt_ext_debug.h | 668204e35c10b4a66c1e8bbac733e18a8f8af72d540419aeb82dfd2affd4c5f2 |
| skia/config/sk_ref_cnt_ext_release.h | 61ef8211459628e7a8dba327475bcc1c54885fbf7980e0ce3baede3641bf2863 |
| skia/BUILD.gn | 2eab22d56eca55d16964a569cea0afaa848e14f3be9da27216c05dac3ac9b586 |
| skia/features.gni | 58c7a75c4c9244588e4e4b184a9f7d2ede60765c1dccf31a1a851e239ad5e56f |
| build/config/avx512.gni | 50c95780ea96ca8493129ebc3470c0bcfde5ef1a3452a7f8dba59c517d254d3c |

## 构建接入补记

外层构建记录：上游 `gn/toolchain/BUILD.gn` 的 WASM target 依赖 `bin/activate-emsdk`，该脚本固定激活 4.0.7，与本次获准使用的 7.0.0 不同。构建者只在缓存构建副本移除该 activate 依赖，由外层脚本明确设置已下载的 7.0.0、EM_CONFIG 与 EM_CACHE；第一轮因缺 `third_party/emsdk.py` 失败已留日志。这是 SDK 激活流程补丁，不是 Skia 像素宏调整，不能因此宣称 WASM 已成功。

`实验/skia/capabilities.cpp` 的模式 0..27 分别保留需求的能力：图元/路径/描边/虚线；线性和径向渐变；分形噪声和湍流；原始像素图片与录制着色器；全部 SkBlendMode 的画笔和图像滤镜混合及存层；路径测量与三类颜色滤镜；模糊、投影、偏移、合并、颜色滤镜、合成、混合、算术、置换、膨胀/腐蚀、三种光源的漫反射/镜面反射、矩阵卷积、平铺、裁剪，另含单投影和矩阵变换。函数返回明确错误码，工厂返回空不伪装成功。已用 LLVM 24、C++20、NDEBUG 和相同配置头执行 `-fsyntax-only` 通过；链接及运行结果由实际构建记录补充。

Linux 探针随后已实际链接并运行：`out/linux/skia/libsvg-render-probe.so` 未 strip 大小 **2,993,632 字节**，GNU size 的 text/data/bss 为 **2,488,270 / 40,156 / 5,652 字节**。链接启用 ThinLTO、PIC、gc-sections、no-undefined、exclude-libs,ALL 和只允许 `svg_render_probe` 的 version script；`nm -D --defined-only` 确认只有这个导出。28 个模式（0..27）在 128×128 全部返回 0 且有非透明像素，逐模式 SHA-256 和像素数保存于 `out/linux/skia/capabilities-smoke.json`。这只是能力触达与运行冒烟，不是 Chrome 像素一致性检查，不代替 Mac 体积验收。

首次模式 4 暴露了一个探针错误：`SkImageFilters::Blend(kDst, nullptr, foreground)` 会合法简化为代表原图的 nullptr，并非功能缺失。探针改用非空 Offset 背景后重新跑完 28 个模式。LLVM SDK 只有名为 `lld` 的通用驱动；需要在缓存建名为 `ld.lld` 的符号链接并传给 `--ld-path`，不能直接把通用驱动当 ELF 链接器。这些修复不改变 Skia 光栅宏。

## WASM 最终结果与重复运行

同一份能力探针随后用已固定 Emscripten 7.0.0 真正链接成最终 WASM 并运行 28 模式，全部返回 0 且有非透明像素。启用与 GN 一致的 SKVX_DISABLE_SIMD / SK_FORCE_8_BYTE_ALIGNMENT / SK_DISABLE_TRACING、ThinLTO、O3、ffp-contract=off；没有为了达标裁减滤镜。原始 **2,127,408 字节**，gzip level 9 **779,632 字节**，brotli quality 11 **568,679 字节**，低于按十进制 1,500,000 字节解释的 1.5 MB 限制。大小指 `.wasm` 本体，JS 引导文件另记在结果 JSON，不含运行内存。导出的调用接口包含 svg_render_probe、malloc、free 及 Emscripten 必需的引导辅助，不把 WASM 说成原生动态库的“唯一一个符号”。

重复链接及冒烟命令为 `node 实验/skia/link.mjs linux-x64` 和 `node 实验/skia/link.mjs wasm`；该脚本使用统一的 root/cache 解析，接受 `SVG_RENDER_CACHE` 覆盖。它只消费已编好的静态库，不下载 SDK，不修改 build.mjs。完整命令、参数、cwd、体积、SHA-256、导出核对和 28 模式结果写入 `out/linux/skia/<目标>/link-result.json`。Linux 可重复执行所得大小仍为 2,993,632 字节。`link_and_smoke_seconds` 包含最终链接和冒烟，不是 Skia 首次完整编译时间，也不包括后续压缩时间。

Mac 链接分支已写但未实际执行，必须在 Mac 上运行 `mac-arm64` 和 `mac-x64`。ARM Mac 的 x64 目标只做链接、架构、单导出和体积检查，不引入 Rosetta/x64 Python；modes 为 null，并明确标成未运行 x64 动态库。arm64 目标照常执行 28 模式。构建通过和运行验证分别记载，Mac 正式体积验收仍待用户运行。
