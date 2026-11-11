// Chromium 157.0.8103.50 的 CPU 光栅设置。
// 来源、逐项取舍和未验证部分见《Chromium的Skia设置.md》。
// 通过 SK_USER_CONFIG_HEADER 引入；库和调用方必须使用同一份设置。
#ifndef SVG_RENDER_CHROMIUM_CONFIG_H_
#define SVG_RENDER_CHROMIUM_CONFIG_H_

#define SK_CANVAS_SAVE_RESTORE_PREALLOC_COUNT 16
#define SK_ALLOW_STATIC_GLOBAL_INITIALIZERS 0
#define SK_A32_SHIFT 24
#ifndef SK_R32_SHIFT
#define SK_R32_SHIFT 16
#endif
#define SK_G32_SHIFT 8
#define SK_B32_SHIFT 0

#if defined(SK_BUILD_FOR_MAC)
#define SK_CPU_LENDIAN
#undef SK_CPU_BENDIAN
#elif defined(SK_BUILD_FOR_UNIX) && defined(SK_CPU_BENDIAN)
#error 本实验不支持大端目标
#endif

#if defined(__has_attribute)
#if __has_attribute(trivial_abi)
#define SK_TRIVIAL_ABI [[clang::trivial_abi]]
#else
#define SK_TRIVIAL_ABI
#endif
#else
#define SK_TRIVIAL_ABI
#endif

#define SK_SUPPORT_LEGACY_ANISOTROPIC_MIPMAP_SCALE
#define SK_SUPPORT_LEGACY_CONIC_CHOP
#define SK_USE_PADDED_BLUR_UPSCALE
#define SK_LEGACY_INITWITHPREV_LAYER_SIZING
#define SK_AVOID_SLOW_RASTER_PIPELINE_BLURS
#define SK_SUPPORT_LEGACY_RRECT_TRANSFORM
// 即使目前仅 GPU 使用，也保留此采样兼容开关以防漏判。
#define SK_USE_SAFE_INSET_FOR_TEXTURE_SAMPLING
#define SK_USE_DISCARDABLE_SCALEDIMAGECACHE

#define SK_ENABLE_SKSL
#define SK_ENABLE_LEGACY_SHADERCONTEXT
#define SK_LEGACY_DESERIAL_IMAGE_PROC
#ifndef SK_ENABLE_AVX512_OPTS
#define SK_ENABLE_AVX512_OPTS
#endif
// 禁止上游默认注册图片解码器；仍需从构建副本移除 BMP/WBMP 源文件。
#define SK_DISABLE_LEGACY_INIT_DECODERS
#define SK_DISABLE_LEGACY_PNG_WRITEBUFFER
// 独立构建默认额外打开 A8 字体伽马；Chromium 的 Linux/Mac 没有。
#undef SK_GAMMA_APPLY_TO_A8

#if defined(SK_DEBUG)
#define SKIA_LOWEST_ACTIVE_LOG_PRIORITY SkLogPriority::kWarning
#else
#define SKIA_LOWEST_ACTIVE_LOG_PRIORITY SkLogPriority::kInfo
#endif

// 不覆盖 SK_API / SkDebugf / SK_ABORT / SK_REF_CNT_MIXIN_INCLUDE。
// 它们在 Chromium 依赖 base、日志和 Blink；这里用 Skia 独立实现。
#endif
