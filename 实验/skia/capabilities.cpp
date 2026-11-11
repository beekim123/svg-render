// 阶段 0 的一次性能力探针，不是 SVG 运行时。
// 必须与静态 Skia 一起使用 chromium-config.h 和相同 release/ABI 宏。
#include "include/core/SkCanvas.h"
#include "include/core/SkColorFilter.h"
#include "include/core/SkColorSpace.h"
#include "include/core/SkImage.h"
#include "include/core/SkPathBuilder.h"
#include "include/core/SkPathMeasure.h"
#include "include/core/SkPicture.h"
#include "include/core/SkPictureRecorder.h"
#include "include/core/SkPoint3.h"
#include "include/core/SkRRect.h"
#include "include/core/SkSurface.h"
#include "include/effects/SkDashPathEffect.h"
#include "include/effects/SkGradient.h"
#include "include/effects/SkImageFilters.h"
#include "include/effects/SkLumaColorFilter.h"
#include "include/effects/SkPerlinNoiseShader.h"
#include <cstddef>
#include <cstdint>

namespace {
constexpr float kColorMatrix[20] = {
    .8f, .1f, 0, 0, .05f, 0, .9f, .1f, 0, 0,
    .1f, 0, .8f, 0, .04f, 0, 0, 0, .85f, 0,
};

SkPath make_path() {
    SkPathBuilder b;
    b.moveTo(12, 90).lineTo(28, 20).quadTo(50, 5, 70, 28)
     .conicTo(90, 5, 110, 30, .7f).cubicTo(120, 60, 82, 110, 50, 90).close();
    return b.detach();
}

// 所有滤镜均被运行时的 mode 选择，不能被 LTO 当未使用代码整体删除。
sk_sp<SkImageFilter> image_filter(unsigned mode) {
    using F = SkImageFilters;
    const SkRect crop = SkRect::MakeLTRB(8, 8, 120, 120);
    const SkPoint3 light{32, 24, 80}, target{64, 64, 0}, direction{.3f, .5f, 1};
    auto offset = F::Offset(5, 3, nullptr);
    switch (mode) {
        case 6: return F::Blur(3, 5, SkTileMode::kDecal, nullptr);
        case 7: return F::DropShadow(6, 7, 3, 3, SK_ColorBLUE, nullptr);
        case 8: return offset;
        case 9: return F::Merge(F::Blur(2, 2, nullptr), offset);
        case 10: return F::ColorFilter(SkColorFilters::Matrix(kColorMatrix), nullptr);
        case 11: return F::Compose(F::Blur(2, 2, nullptr), offset);
        case 12: return F::Blend(SkBlendMode::kMultiply, nullptr, offset);
        case 13: return F::Arithmetic(.2f, .6f, .4f, .05f, true, nullptr, offset);
        case 14: return F::DisplacementMap(SkColorChannel::kR, SkColorChannel::kG, 12,
                                          F::Shader(SkShaders::MakeTurbulence(.04f, .05f, 2, 7)),
                                          nullptr);
        case 15: return F::Dilate(3, 2, nullptr);
        case 16: return F::Erode(2, 3, nullptr);
        case 17: return F::DistantLitDiffuse(direction, SK_ColorWHITE, 4, .8f, nullptr);
        case 18: return F::PointLitDiffuse(light, SK_ColorWHITE, 4, .8f, nullptr);
        case 19: return F::SpotLitDiffuse(light, target, 2, 50, SK_ColorWHITE, 4, .8f, nullptr);
        case 20: return F::DistantLitSpecular(direction, SK_ColorWHITE, 4, .8f, 8, nullptr);
        case 21: return F::PointLitSpecular(light, SK_ColorWHITE, 4, .8f, 8, nullptr);
        case 22: return F::SpotLitSpecular(light, target, 2, 50, SK_ColorWHITE, 4, .8f, 8, nullptr);
        case 23: {
            const float kernel[9] = {0, -1, 0, -1, 5, -1, 0, -1, 0};
            return F::MatrixConvolution({3, 3}, kernel, 1, 0, {1, 1},
                                        SkTileMode::kClamp, true, nullptr);
        }
        case 24: return F::Tile(SkRect::MakeLTRB(24, 24, 56, 56), crop, nullptr);
        case 25: return F::Crop(crop, SkTileMode::kDecal, nullptr);
        case 26: return F::DropShadowOnly(6, 7, 3, 3, SK_ColorBLUE, nullptr);
        case 27: return F::MatrixTransform(SkMatrix::Scale(.9f, .8f),
                                           SkSamplingOptions(SkFilterMode::kLinear), nullptr);
        default: return nullptr;
    }
}
}  // namespace

// 唯一对外函数。输出 width*height*4 字节的非预乘 RGBA/sRGB。
// 调用者保证缓冲区足够；mode 0..27。返回 0 成功，1 参数错，2 分配错，
// 3 功能工厂/路径测量失败，4 像素回读失败。mode 6..27 对应上面的滤镜。
extern "C" __attribute__((visibility("default")))
int svg_render_probe(unsigned mode, unsigned char* rgba, int width, int height) {
    if (!rgba || width <= 0 || height <= 0 || width > 8192 || height > 8192 || mode > 27) {
        return 1;
    }
    auto cs = SkColorSpace::MakeSRGB();
    auto surface = SkSurfaces::Raster(SkImageInfo::MakeN32Premul(width, height, cs));
    if (!surface) return 2;
    SkCanvas* c = surface->getCanvas();
    c->clear(SK_ColorTRANSPARENT);
    c->scale(width / 128.f, height / 128.f);
    SkPaint p;
    p.setAntiAlias(true);
    p.setColor(0xDDE95338);
    const SkPath path = make_path();
    if (mode == 0) {
        // 路径、基本图元、描边与虚线。
        c->drawRect(SkRect::MakeLTRB(6, 8, 44, 34), p);
        c->drawOval(SkRect::MakeLTRB(52, 8, 110, 40), p);
        c->drawRRect(SkRRect::MakeRectXY(SkRect::MakeLTRB(8, 92, 48, 120), 7, 9), p);
        c->drawCircle(100, 105, 15, p);
        c->drawPath(path, p);
        p.setStyle(SkPaint::kStroke_Style);
        p.setStrokeWidth(3);
        p.setStrokeCap(SkPaint::kRound_Cap);
        p.setStrokeJoin(SkPaint::kRound_Join);
        const float intervals[] = {7, 3, 2, 3};
        p.setPathEffect(SkDashPathEffect::Make({intervals, 4}, 1));
        if (!p.getPathEffect()) return 3;
        p.setColor(SK_ColorBLUE);
        c->drawPath(path, p);
        c->drawLine(8, 122, 120, 122, p);
    } else if (mode == 1) {
        const SkColor4f colors[] = {{1, .1f, .1f, 1}, {.1f, .7f, 1, .4f}, {.4f, 1, .2f, 1}};
        const float stops[] = {0, .4f, 1};
        SkGradient::Interpolation interpolation;
        interpolation.fInPremul = SkGradient::Interpolation::InPremul::kYes;
        interpolation.fColorSpace = SkGradient::Interpolation::ColorSpace::kSRGB;
        SkGradient gradient(SkGradient::Colors({colors, 3}, {stops, 3}, SkTileMode::kClamp, cs),
                            interpolation);
        const SkPoint points[] = {{0, 0}, {128, 0}};
        p.setShader(SkShaders::LinearGradient(points, gradient));
        if (!p.getShader()) return 3;
        c->drawRect(SkRect::MakeWH(128, 64), p);
        p.setShader(SkShaders::RadialGradient({64, 96}, 40, gradient));
        if (!p.getShader()) return 3;
        c->drawRect(SkRect::MakeLTRB(0, 64, 128, 128), p);
    } else if (mode == 2) {
        p.setShader(SkShaders::MakeFractalNoise(.04f, .06f, 3, 17));
        if (!p.getShader()) return 3;
        c->drawRect(SkRect::MakeWH(64, 128), p);
        p.setShader(SkShaders::MakeTurbulence(.05f, .03f, 3, 29));
        if (!p.getShader()) return 3;
        c->drawRect(SkRect::MakeLTRB(64, 0, 128, 128), p);
    } else if (mode == 3) {
        // 原始像素图片，不依赖任何图片解码器；另录制图元生成 SkPictureShader。
        auto tile = SkSurfaces::Raster(SkImageInfo::MakeN32Premul(16, 16, cs));
        if (!tile) return 2;
        tile->getCanvas()->clear(SK_ColorGREEN);
        tile->getCanvas()->drawCircle(8, 8, 6, p);
        auto image = tile->makeImageSnapshot();
        if (!image) return 2;
        p.setShader(image->makeShader(SkTileMode::kRepeat, SkTileMode::kMirror,
                                      SkSamplingOptions(SkFilterMode::kLinear)));
        if (!p.getShader()) return 3;
        c->drawRect(SkRect::MakeWH(64, 128), p);
        SkPictureRecorder recorder;
        auto recording = recorder.beginRecording(16, 16);
        SkPaint ink;
        ink.setColor(SK_ColorBLUE);
        recording->drawCircle(8, 8, 6, ink);
        auto picture = recorder.finishRecordingAsPicture();
        if (!picture) return 2;
        p.setShader(picture->makeShader(SkTileMode::kRepeat, SkTileMode::kRepeat, SkFilterMode::kLinear));
        if (!p.getShader()) return 3;
        c->drawRect(SkRect::MakeLTRB(64, 0, 128, 128), p);
    } else if (mode == 4) {
        // 遍历全部 SkBlendMode，同时实际执行图像滤镜 Blend 和画笔混合。
        for (unsigned i = 0; i <= static_cast<unsigned>(SkBlendMode::kLastMode); ++i) {
            c->save();
            c->translate((i % 6) * 21.f, (i / 6) * 25.f);
            c->scale(.18f, .18f);
            SkPaint layer;
            layer.setAlphaf(.85f);
            c->saveLayer(nullptr, &layer);
            p.setBlendMode(SkBlendMode::kSrcOver);
            p.setColor(0xAA3377EE);
            c->drawCircle(45, 50, 40, p);
            p.setColor(0xDDEE6633);
            p.setBlendMode(static_cast<SkBlendMode>(i));
            p.setImageFilter(SkImageFilters::Blend(static_cast<SkBlendMode>(i),
                                                  SkImageFilters::Offset(1, 1, nullptr),
                                                  SkImageFilters::Offset(3, 2, nullptr)));
            if (!p.getImageFilter()) return 3;
            c->drawRect(SkRect::MakeLTRB(35, 25, 110, 100), p);
            c->restore();
            c->restore();
        }
    } else if (mode == 5) {
        SkPathMeasure measure(path, false);
        SkPoint pos;
        SkVector tangent;
        SkPathBuilder segment;
        if (!measure.getPosTan(measure.getLength() * .5f, &pos, &tangent) ||
            !measure.getSegment(0, measure.getLength() * .7f, &segment, true)) return 3;
        p.setColorFilter(SkColorFilters::Matrix(kColorMatrix));
        if (!p.getColorFilter()) return 3;
        c->drawPath(segment.detach(), p);
        uint8_t table[256];
        for (unsigned i = 0; i < 256; ++i) table[i] = static_cast<uint8_t>(255 - i);
        p.setColorFilter(SkColorFilters::TableARGB(nullptr, table, table, table));
        if (!p.getColorFilter()) return 3;
        c->drawCircle(pos.x(), pos.y(), 10, p);
        p.setColorFilter(SkLumaColorFilter::Make());
        if (!p.getColorFilter()) return 3;
        c->drawRect(SkRect::MakeLTRB(8, 100, 120, 118), p);
    } else {
        auto filter = image_filter(mode);
        if (!filter) return 3;
        p.setImageFilter(std::move(filter));
        c->drawPath(path, p);
    }
    const SkImageInfo output = SkImageInfo::Make(width, height, kRGBA_8888_SkColorType,
                                               kUnpremul_SkAlphaType, cs);
    return surface->readPixels(output, rgba, static_cast<size_t>(width) * 4, 0, 0) ? 0 : 4;
}
