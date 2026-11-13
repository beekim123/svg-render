#define main scene_draw_cli_main
#include "../../tools/scene/draw.cpp"
#undef main
#include "include/core/SkImage.h"
#include <godot_cpp/classes/engine.hpp>
#include <godot_cpp/classes/image.hpp>
#include <godot_cpp/classes/json.hpp>
#include <godot_cpp/classes/ref_counted.hpp>
#include <godot_cpp/core/class_db.hpp>
#include <godot_cpp/godot.hpp>
#include <chrono>
#include <array>
#include <memory>
#include <limits>
#include <unordered_map>

namespace {
using Clock = std::chrono::steady_clock;
using GDictionary = godot::Dictionary;
using GArray = godot::Array;

using Affine = std::array<double, 6>;
const Affine IDENTITY = {1, 0, 0, 1, 0, 0};

Affine concatenate(const Affine& a, const Affine& b) {
    return {a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
        a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]};
}

SkMatrix skiaMatrix(const Affine& a) {
    return SkMatrix::MakeAll(a[0], a[2], a[4], a[1], a[3], a[5], 0, 0, 1);
}

struct Raster {
    SkBitmap bitmap;
    int left = 0;
    int top = 0;
};

struct Layer;
struct Part {
    const Value* draw = nullptr;
    std::unique_ptr<Layer> layer;
    Raster cache;
};

struct Layer {
    int id;
    const Value* definition;
    Affine reference;
    Affine delta = IDENTITY;
    float opacity;
    bool clipped;
    Raster cache;
    std::vector<Part> parts;
};

Affine poseMatrix(const GArray& a) {
    return {double(a[0]), double(a[1]), double(a[2]), double(a[3]), double(a[4]), double(a[5])};
}

std::unique_ptr<Layer> readLayer(const Value& value, const GDictionary& precise) {
    auto layer = std::make_unique<Layer>();
    layer->id = number(value["node"]);
    layer->definition = &value;
    layer->reference = poseMatrix(precise["reference"]);
    layer->opacity = number(value["opacity"], 1);
    layer->clipped = !value["clips"].is<skjson::NullValue>() && value["clips"].as<Array>().size() > 0;
    const GArray children = precise["children"];
    int index = 0;
    for (const auto& child : value["children"].as<Array>()) {
        Part part;
        if (child["draw"].is<skjson::NullValue>()) {
            part.layer = readLayer(child, children[index]);
        } else {
            part.draw = &child["draw"];
        }
        layer->parts.push_back(std::move(part));
        index++;
    }
    return layer;
}

void updateLayer(Layer& layer, const GDictionary& poses, const GDictionary& opacity,
                 const Affine& parent = IDENTITY) {
    const auto key = godot::String::num_int64(layer.id);
    const godot::Variant pose = poses.get(layer.id, poses.get(key, godot::Variant()));
    layer.delta = concatenate(parent, pose.get_type() == godot::Variant::NIL ? IDENTITY : poseMatrix(pose));
    layer.opacity = double(opacity.get(layer.id, opacity.get(key, number((*layer.definition)["opacity"], 1))));
    for (auto& part : layer.parts) {
        if (part.layer) updateLayer(*part.layer, poses, opacity, layer.delta);
    }
}

SkMatrix effective(const Layer& layer, bool rest) {
    return skiaMatrix(rest ? layer.reference : concatenate(layer.delta, layer.reference));
}

bool collapsed(const Layer& layer) {
    const auto m = concatenate(layer.delta, layer.reference);
    const double magnitude = std::max({std::abs(m[0]), std::abs(m[1]), std::abs(m[2]), std::abs(m[3])});
    // D·R 在零缩放时有双精度抵消残差，不能把消失的组画成细线。
    return std::abs(m[0] * m[3] - m[1] * m[2]) <= 16 * std::numeric_limits<double>::epsilon() * magnitude * magnitude;
}

SkRect nodesBounds(const Value& nodes) {
    SkRect bounds = SkRect::MakeEmpty();
    for (const auto& node : nodes.as<Array>()) {
        if (text(node["type"]) == "group") {
            bounds.join(nodesBounds(node["children"]));
        } else {
            const auto& b = node["bounds"].as<Array>();
            SkRect rect = SkRect::MakeXYWH(number(b[0]), number(b[1]), number(b[2]), number(b[3]));
            matrix(node["matrix"]).mapRect(&rect);
            bounds.join(rect);
        }
    }
    return bounds;
}

SkRect layerBounds(const Layer& layer, bool rest) {
    SkRect bounds = SkRect::MakeEmpty();
    for (const auto& part : layer.parts) {
        if (part.layer) {
            bounds.join(layerBounds(*part.layer, rest));
        } else {
            auto rect = nodesBounds(*part.draw);
            effective(layer, rest).mapRect(&rect);
            bounds.join(rect);
        }
    }
    return bounds;
}

SkBitmap allocate(int width, int height) {
    SkBitmap bitmap;
    if (!bitmap.tryAllocPixels(SkImageInfo::Make(std::max(1, width), std::max(1, height),
            kN32_SkColorType, kPremul_SkAlphaType, SkColorSpace::MakeSRGB()))) {
        throw std::runtime_error("无法分配运行时画布：" + std::to_string(width) + "x" + std::to_string(height));
    }
    bitmap.eraseColor(SK_ColorTRANSPARENT);
    return bitmap;
}

void exactLayer(SkCanvas& canvas, const Layer& layer, const SkMatrix& device, bool rest, bool root = false) {
    if (!rest && collapsed(layer)) return;
    const int saved = canvas.save();
    canvas.setMatrix(SkMatrix::Concat(device, effective(layer, rest)));
    clips(canvas, (*layer.definition)["clips"]);
    const float opacity = rest ? number((*layer.definition)["opacity"], 1) : layer.opacity;
    if (!root && opacity != 1) {
        SkPaint alpha;
        alpha.setAlphaf(opacity);
        canvas.saveLayer(nullptr, &alpha);
    }
    for (const auto& part : layer.parts) {
        if (part.layer) {
            exactLayer(canvas, *part.layer, device, rest);
        } else {
            drawNodes(canvas, *part.draw);
        }
    }
    canvas.restoreToCount(saved);
}

Raster rasterize(const Layer& layer, const Value* draw, float scale, float phaseX, float phaseY, bool rest) {
    auto bounds = draw ? nodesBounds(*draw) : layerBounds(layer, rest);
    if (draw) effective(layer, rest).mapRect(&bounds);
    bounds = SkRect::MakeLTRB(bounds.left() * scale + phaseX, bounds.top() * scale + phaseY,
                              bounds.right() * scale + phaseX, bounds.bottom() * scale + phaseY);
    Raster result;
    result.left = std::floor(bounds.left()) - 1;
    result.top = std::floor(bounds.top()) - 1;
    result.bitmap = allocate(std::ceil(bounds.right()) + 1 - result.left, std::ceil(bounds.bottom()) + 1 - result.top);
    SkCanvas canvas(result.bitmap);
    const auto device = SkMatrix::MakeAll(scale, 0, phaseX - result.left, 0, scale, phaseY - result.top, 0, 0, 1);
    if (draw) {
        canvas.setMatrix(SkMatrix::Concat(device, effective(layer, rest)));
        drawNodes(canvas, *draw);
    } else {
        exactLayer(canvas, layer, device, rest, true);
    }
    result.bitmap.setImmutable();
    return result;
}

void cacheLayer(Layer& layer, float scale) {
    if (layer.clipped) {
        layer.cache = rasterize(layer, nullptr, scale, 0, 0, true);
        return;
    }
    for (auto& part : layer.parts) {
        if (part.layer) cacheLayer(*part.layer, scale);
        else part.cache = rasterize(layer, part.draw, scale, 0, 0, true);
    }
}

bool sameMatrix(const Affine& a, const Affine& b) {
    for (int i = 0; i < 6; i++) if (std::abs(a[i] - b[i]) > 0.000000001) return false;
    return true;
}

bool restChildren(const Layer& layer, const Affine& delta) {
    for (const auto& part : layer.parts) {
        if (!part.layer) continue;
        if (!sameMatrix(part.layer->delta, delta) ||
            part.layer->opacity != number((*part.layer->definition)["opacity"], 1) ||
            !restChildren(*part.layer, delta)) return false;
    }
    return true;
}

uint64_t budgetFrame = uint64_t(-1);
double budgetMilliseconds = 0;

struct RenderState {
    float scale;
    float phaseX;
    float phaseY;
    bool quality;
    double milliseconds = 0;
    int fallbacks = 0;
    int redraws = 0;
    GArray timings;
};

void compositeUnit(SkCanvas& canvas, const Layer& layer, const Value* draw, const Raster& cache, RenderState& state) {
    auto delta = skiaMatrix(layer.delta);
    delta[SkMatrix::kMTransX] = delta.getTranslateX() * state.scale + state.phaseX;
    delta[SkMatrix::kMTransY] = delta.getTranslateY() * state.scale + state.phaseY;
    const float x = std::round(delta.getTranslateX());
    const float y = std::round(delta.getTranslateY());
    const bool integer = std::abs(delta.getScaleX() - 1) < 0.0000001f &&
        std::abs(delta.getScaleY() - 1) < 0.0000001f && std::abs(delta.getSkewX()) < 0.0000001f &&
        std::abs(delta.getSkewY()) < 0.0000001f && std::abs(delta.getTranslateX() - x) < 0.001f &&
        std::abs(delta.getTranslateY() - y) < 0.001f && (draw || restChildren(layer, layer.delta));
    if (integer) {
        canvas.drawImage(cache.bitmap.asImage(), cache.left + x, cache.top + y);
        return;
    }
    if (!state.quality && budgetMilliseconds >= 8) {
        state.fallbacks++;
        const int saved = canvas.save();
        canvas.concat(delta);
        canvas.drawImage(cache.bitmap.asImage(), cache.left, cache.top, SkSamplingOptions(SkFilterMode::kLinear));
        canvas.restoreToCount(saved);
        return;
    }
    const auto start = Clock::now();
    const auto image = rasterize(layer, draw, state.scale, state.phaseX, state.phaseY, false);
    const double milliseconds = std::chrono::duration<double, std::milli>(Clock::now() - start).count();
    state.milliseconds += milliseconds;
    budgetMilliseconds += milliseconds;
    state.redraws++;
    bool recorded = false;
    for (int i = 0; i < state.timings.size(); i++) {
        GDictionary timing = state.timings[i];
        if (int(timing["node"]) == layer.id) {
            timing["ms"] = double(timing["ms"]) + milliseconds;
            recorded = true;
            break;
        }
    }
    if (!recorded) {
        GDictionary timing;
        timing["node"] = layer.id;
        timing["ms"] = milliseconds;
        state.timings.append(timing);
    }
    canvas.drawImage(image.bitmap.asImage(), image.left, image.top);
}

void compositeLayer(SkCanvas& canvas, const Layer& layer, RenderState& state) {
    if (layer.opacity == 0 || collapsed(layer)) return;
    const int saved = canvas.save();
    if (layer.opacity != 1) {
        SkPaint alpha;
        alpha.setAlphaf(layer.opacity);
        canvas.saveLayer(nullptr, &alpha);
    }
    if (layer.clipped) {
        compositeUnit(canvas, layer, nullptr, layer.cache, state);
    } else {
        for (const auto& part : layer.parts) {
            if (part.layer) compositeLayer(canvas, *part.layer, state);
            else compositeUnit(canvas, layer, part.draw, part.cache, state);
        }
    }
    canvas.restoreToCount(saved);
}
}

class SkiaLayerRenderer : public godot::RefCounted {
    GDCLASS(SkiaLayerRenderer, godot::RefCounted)
    std::unique_ptr<skjson::DOM> document;
    std::unique_ptr<Layer> root;
    float width = 0;
    float height = 0;
    double cachedScale = 0;

protected:
    static void _bind_methods() {
        godot::ClassDB::bind_method(godot::D_METHOD("load_scene", "filename"), &SkiaLayerRenderer::load_scene);
        godot::ClassDB::bind_method(godot::D_METHOD("render", "poses", "opacities", "output_scale", "placement", "quality"), &SkiaLayerRenderer::render);
    }

public:
    void load_scene(const godot::String& filename) {
        std::ifstream input(filename.utf8().get_data(), std::ios::binary);
        if (!input) {
            ERR_PRINT(godot::String("无法读取运行时场景：") + filename);
            return;
        }
        const std::string json{std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
        document = std::make_unique<skjson::DOM>(json.data(), json.size());
        const auto& scene = document->root();
        width = number(scene["width"]);
        height = number(scene["height"]);
        const GDictionary precise = godot::JSON::parse_string(godot::String::utf8(json.data(), json.size()));
        root = readLayer(scene["root"], precise["root"]);
        cachedScale = 0;
    }

    GDictionary render(const GDictionary& poses, const GDictionary& opacities, double outputScale,
                        const godot::Transform2D& placement, bool quality) {
        GDictionary result;
        ERR_FAIL_COND_V_MSG(!root, result, "运行时场景未载入");
        ERR_FAIL_COND_V_MSG(outputScale <= 0 || outputScale > 2, result, godot::String("无效输出倍率：") + godot::String::num_real(outputScale));
        try {
            const uint64_t frame = godot::Engine::get_singleton()->get_process_frames();
            if (frame != budgetFrame) {
                budgetFrame = frame;
                budgetMilliseconds = 0;
            }
            updateLayer(*root, poses, opacities);
            if (cachedScale != outputScale) {
                cacheLayer(*root, outputScale);
                cachedScale = outputScale;
            }
            const auto origin = placement.get_origin();
            const float phaseX = origin.x - std::floor(origin.x);
            const float phaseY = origin.y - std::floor(origin.y);
            auto bitmap = allocate(std::ceil(width * outputScale + phaseX), std::ceil(height * outputScale + phaseY));
            SkCanvas canvas(bitmap);
            RenderState state{float(outputScale), phaseX, phaseY, quality};
            compositeLayer(canvas, *root, state);
            godot::PackedByteArray pixels;
            pixels.resize(bitmap.width() * bitmap.height() * 4);
            if (!bitmap.readPixels(SkImageInfo::Make(bitmap.width(), bitmap.height(), kRGBA_8888_SkColorType,
                    kUnpremul_SkAlphaType, SkColorSpace::MakeSRGB()), pixels.ptrw(), bitmap.width() * 4, 0, 0)) {
                throw std::runtime_error("无法读取运行时像素");
            }
            result["image"] = godot::Image::create_from_data(bitmap.width(), bitmap.height(), false, godot::Image::FORMAT_RGBA8, pixels);
            result["offset"] = godot::Vector2(-phaseX / outputScale, -phaseY / outputScale);
            result["redraw_ms"] = state.milliseconds;
            result["fallbacks"] = state.fallbacks;
            result["redraws"] = state.redraws;
            result["layers"] = state.timings;
        } catch (const std::exception& error) {
            ERR_PRINT(godot::String(error.what()));
        }
        return result;
    }
};

void initialize_svg_skia(godot::ModuleInitializationLevel level) {
    if (level == godot::MODULE_INITIALIZATION_LEVEL_SCENE) godot::ClassDB::register_class<SkiaLayerRenderer>();
}

void uninitialize_svg_skia(godot::ModuleInitializationLevel) {}

extern "C" GDExtensionBool GDE_EXPORT svg_skia_init(GDExtensionInterfaceGetProcAddress address,
        GDExtensionClassLibraryPtr library, GDExtensionInitialization* initialization) {
    godot::GDExtensionBinding::InitObject init(address, library, initialization);
    init.register_initializer(initialize_svg_skia);
    init.register_terminator(uninitialize_svg_skia);
    init.set_minimum_library_initialization_level(godot::MODULE_INITIALIZATION_LEVEL_SCENE);
    return init.init();
}
