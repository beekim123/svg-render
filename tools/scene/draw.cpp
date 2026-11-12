#include "include/core/SkBitmap.h"
#include "include/core/SkCanvas.h"
#include "include/core/SkColorSpace.h"
#include "include/core/SkPaint.h"
#include "include/core/SkPath.h"
#include "include/core/SkPicture.h"
#include "include/core/SkPictureRecorder.h"
#include "include/core/SkShader.h"
#include "include/effects/SkDashPathEffect.h"
#include "include/effects/SkGradient.h"
#include "include/pathops/SkPathOps.h"
#include "include/utils/SkParsePath.h"
#include "modules/jsonreader/SkJSONReader.h"
#include <zlib.h>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <string>
#include <vector>

using Value = skjson::Value;
using Array = skjson::ArrayValue;

float number(const Value& value) {
    return *value.as<skjson::NumberValue>();
}

float number(const Value& value, float fallback) {
    return value.is<skjson::NullValue>() ? fallback : number(value);
}

std::string text(const Value& value) {
    return std::string(value.as<skjson::StringValue>().str());
}

SkMatrix matrix(const Value& value) {
    if (value.is<skjson::NullValue>()) {
        return SkMatrix::I();
    }
    const auto& m = value.as<Array>();
    return SkMatrix::MakeAll(number(m[0]), number(m[2]), number(m[4]),
                             number(m[1]), number(m[3]), number(m[5]),
                             0, 0, 1);
}

SkColor4f color(const Value& value) {
    const auto& c = value.as<Array>();
    return {number(c[0]), number(c[1]), number(c[2]), number(c[3])};
}

SkPath path(const Value& node) {
    const auto data = text(node["path"]);
    auto result = SkParsePath::FromSVGString(data.c_str());
    if (!result) {
        throw std::runtime_error("无法解析路径：" + data);
    }
    result->setFillType(!node["fillRule"].is<skjson::NullValue>() && text(node["fillRule"]) == "evenodd"
                            ? SkPathFillType::kEvenOdd : SkPathFillType::kWinding);
    return *result;
}

void clips(SkCanvas& canvas, const Value& value) {
    if (value.is<skjson::NullValue>()) {
        return;
    }
    for (const auto& clip : value.as<Array>()) {
        SkPath combined;
        bool first = true;
        for (const auto& item : clip["paths"].as<Array>()) {
            auto transformed = path(item).makeTransform(matrix(item["matrix"]));
            if (first) {
                combined = transformed;
                first = false;
            } else {
                auto united = Op(combined, transformed, kUnion_SkPathOp);
                if (!united) {
                    throw std::runtime_error("裁剪路径合并失败");
                }
                combined = *united;
            }
        }
        canvas.clipPath(combined, SkClipOp::kIntersect, true);
    }
}

SkTileMode spread(const Value& value) {
    if (value.is<skjson::NullValue>() || text(value) == "pad") {
        return SkTileMode::kClamp;
    }
    return text(value) == "repeat" ? SkTileMode::kRepeat : SkTileMode::kMirror;
}

void drawNodes(SkCanvas& canvas, const Value& nodes);

SkPaint paint(const Value& value, const SkMatrix& inverse) {
    SkPaint result;
    result.setAntiAlias(true);
    const auto type = text(value["type"]);
    const float opacity = number(value["opacity"], 1);
    if (type == "color") {
        auto rgba = color(value["color"]);
        rgba.fA *= opacity;
        result.setColor4f(rgba, nullptr);
        return result;
    }
    result.setColor4f({0, 0, 0, opacity}, nullptr);
    const auto local = SkMatrix::Concat(inverse, matrix(value["matrix"]));
    if (type == "pattern") {
        const auto& tile = value["tile"].as<Array>();
        const auto bounds = SkRect::MakeXYWH(number(tile[0]), number(tile[1]),
                                            number(tile[2]), number(tile[3]));
        SkPictureRecorder recorder;
        auto* tileCanvas = recorder.beginRecording(bounds);
        tileCanvas->clipRect(bounds, SkClipOp::kIntersect, true);
        drawNodes(*tileCanvas, value["nodes"]);
        auto picture = recorder.finishRecordingAsPicture();
        result.setShader(picture->makeShader(SkTileMode::kRepeat, SkTileMode::kRepeat,
                                              SkFilterMode::kLinear, &local, &bounds));
        return result;
    }
    std::vector<SkColor4f> colors;
    std::vector<float> positions;
    for (const auto& stop : value["stops"].as<Array>()) {
        colors.push_back(color(stop["color"]));
        positions.push_back(number(stop["offset"]));
    }
    SkGradient::Interpolation interpolation;
    interpolation.fInPremul = SkGradient::Interpolation::InPremul::kNo;
    interpolation.fColorSpace = SkGradient::Interpolation::ColorSpace::kSRGB;
    SkGradient gradient(SkGradient::Colors(colors, positions, spread(value["spread"])), interpolation);
    const auto& points = value["points"].as<Array>();
    result.setDither(true);
    if (type == "linear") {
        const SkPoint endpoints[] = {{number(points[0]), number(points[1])},
                                     {number(points[2]), number(points[3])}};
        result.setShader(SkShaders::LinearGradient(endpoints, gradient, &local));
    } else if (type == "radial") {
        result.setShader(SkShaders::TwoPointConicalGradient(
            {number(points[0]), number(points[1])}, number(points[2]),
            {number(points[3]), number(points[4])}, number(points[5]), gradient, &local));
    } else {
        throw std::runtime_error("不支持的绘制类型：" + type);
    }
    return result;
}

void drawNode(SkCanvas& canvas, const Value& node) {
    const float opacity = number(node["opacity"], 1);
    if (opacity == 0) {
        return;
    }
    const int saved = canvas.save();
    clips(canvas, node["clips"]);
    if (opacity < 1) {
        SkPaint layer;
        layer.setAlphaf(opacity);
        canvas.saveLayer(nullptr, &layer);
    }
    const auto type = text(node["type"]);
    if (type == "group") {
        drawNodes(canvas, node["children"]);
    } else if (type == "path") {
        const auto transform = matrix(node["matrix"]);
        SkMatrix inverse;
        if (transform.invert(&inverse)) {
            canvas.concat(transform);
            const auto shape = path(node);
            if (!node["fill"].is<skjson::NullValue>()) {
                canvas.drawPath(shape, paint(node["fill"], inverse));
            }
            if (!node["stroke"].is<skjson::NullValue>()) {
                auto stroke = paint(node["stroke"], inverse);
                stroke.setStyle(SkPaint::kStroke_Style);
                stroke.setStrokeWidth(number(node["strokeWidth"]));
                stroke.setStrokeMiter(number(node["strokeMiter"], 4));
                const auto cap = text(node["strokeCap"]);
                stroke.setStrokeCap(cap == "round" ? SkPaint::kRound_Cap
                                    : cap == "square" ? SkPaint::kSquare_Cap : SkPaint::kButt_Cap);
                const auto join = text(node["strokeJoin"]);
                stroke.setStrokeJoin(join == "round" ? SkPaint::kRound_Join
                                     : join == "bevel" ? SkPaint::kBevel_Join : SkPaint::kMiter_Join);
                std::vector<float> intervals;
                if (!node["strokeDasharray"].is<skjson::NullValue>()) {
                    for (const auto& interval : node["strokeDasharray"].as<Array>()) {
                        intervals.push_back(number(interval));
                    }
                }
                if (!intervals.empty()) {
                    if (intervals.size() % 2) {
                        const auto repeated = intervals;
                        intervals.insert(intervals.end(), repeated.begin(), repeated.end());
                    }
                    stroke.setPathEffect(SkDashPathEffect::Make(intervals, number(node["strokeDashoffset"], 0)));
                }
                canvas.drawPath(shape, stroke);
            }
        }
    } else {
        throw std::runtime_error("不支持的节点：" + type);
    }
    canvas.restoreToCount(saved);
}

void drawNodes(SkCanvas& canvas, const Value& nodes) {
    for (const auto& node : nodes.as<Array>()) {
        drawNode(canvas, node);
    }
}

void writeU32(std::ostream& stream, uint32_t value) {
    const unsigned char bytes[] = {static_cast<unsigned char>(value >> 24),
                                   static_cast<unsigned char>(value >> 16),
                                   static_cast<unsigned char>(value >> 8),
                                   static_cast<unsigned char>(value)};
    stream.write(reinterpret_cast<const char*>(bytes), 4);
}

void writeChunk(std::ostream& stream, const char* type, const std::vector<unsigned char>& bytes) {
    writeU32(stream, bytes.size());
    stream.write(type, 4);
    stream.write(reinterpret_cast<const char*>(bytes.data()), bytes.size());
    uLong crc = crc32(0, reinterpret_cast<const Bytef*>(type), 4);
    if (!bytes.empty()) {
        crc = crc32(crc, bytes.data(), bytes.size());
    }
    writeU32(stream, crc);
}

void writePng(const char* filename, const std::vector<unsigned char>& rgba, int width, int height) {
    const size_t stride = width * 4;
    std::vector<unsigned char> rows((stride + 1) * height);
    for (int y = 0; y < height; y++) {
        std::copy_n(rgba.data() + stride * y, stride, rows.data() + (stride + 1) * y + 1);
    }
    uLongf length = compressBound(rows.size());
    std::vector<unsigned char> compressed(length);
    const int status = compress2(compressed.data(), &length, rows.data(), rows.size(), Z_DEFAULT_COMPRESSION);
    if (status != Z_OK) {
        throw std::runtime_error("PNG 压缩失败：" + std::to_string(status));
    }
    compressed.resize(length);
    std::ofstream output(filename, std::ios::binary);
    output.write("\x89PNG\r\n\x1a\n", 8);
    const std::vector<unsigned char> header = {
        static_cast<unsigned char>(width >> 24), static_cast<unsigned char>(width >> 16),
        static_cast<unsigned char>(width >> 8), static_cast<unsigned char>(width),
        static_cast<unsigned char>(height >> 24), static_cast<unsigned char>(height >> 16),
        static_cast<unsigned char>(height >> 8), static_cast<unsigned char>(height), 8, 6, 0, 0, 0};
    writeChunk(output, "IHDR", header);
    writeChunk(output, "sRGB", {0});
    writeChunk(output, "IDAT", compressed);
    writeChunk(output, "IEND", {});
    if (!output) {
        throw std::runtime_error(std::string("无法写出 PNG：") + filename);
    }
}

int main(int argc, char** argv) {
    if (argc != 4) {
        std::cerr << "用法：scene-draw 场景.json 倍率 输出.png\n";
        return 2;
    }
    try {
        std::ifstream input(argv[1], std::ios::binary);
        if (!input) {
            throw std::runtime_error(std::string("无法读取场景：") + argv[1]);
        }
        const std::string json{std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
        skjson::DOM document(json.data(), json.size());
        const auto& scene = document.root();
        const float scale = std::stof(argv[2]);
        const int width = std::ceil(number(scene["width"]) * scale);
        const int height = std::ceil(number(scene["height"]) * scale);
        if (!(scale > 0) || width <= 0 || height <= 0) {
            throw std::runtime_error("无效的输出大小：" + std::to_string(width) + "×" + std::to_string(height));
        }
        SkBitmap bitmap;
        if (!bitmap.tryAllocPixels(SkImageInfo::Make(width, height, kN32_SkColorType,
                                                    kPremul_SkAlphaType, SkColorSpace::MakeSRGB()))) {
            throw std::runtime_error("无法分配画布：" + std::to_string(width) + "×" + std::to_string(height));
        }
        bitmap.eraseColor(SK_ColorTRANSPARENT);
        SkCanvas canvas(bitmap);
        canvas.scale(scale, scale);
        drawNodes(canvas, scene["nodes"]);
        std::vector<unsigned char> rgba(width * height * 4);
        if (!bitmap.readPixels(SkImageInfo::Make(width, height, kRGBA_8888_SkColorType,
                                                kUnpremul_SkAlphaType, SkColorSpace::MakeSRGB()),
                               rgba.data(), width * 4, 0, 0)) {
            throw std::runtime_error("无法读取画布像素");
        }
        writePng(argv[3], rgba, width, height);
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
