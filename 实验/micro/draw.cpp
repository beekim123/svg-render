// 阶段 0 的一次性手写场景，不是 SVG 编译器或运行时。
// 几何由 SVG 语义推导，渐变/滤镜参数核对固定 Blink 源码，尚未按实际 Chrome 指令校准。
#include "include/core/SkBitmap.h"
#include "include/core/SkCanvas.h"
#include "include/core/SkColorSpace.h"
#include "include/core/SkColorFilter.h"
#include "include/core/SkRRect.h"
#include "include/core/SkPaint.h"
#include "include/core/SkPathBuilder.h"
#include "include/effects/SkDashPathEffect.h"
#include "include/effects/SkGradient.h"
#include "include/effects/SkImageFilters.h"
#include "include/effects/SkLumaColorFilter.h"
#include <fstream>
#include <iostream>
#include <vector>
#include <cstdlib>
#include <cmath>

static constexpr SkColor red=0xffe35457, teal=0xff38a8a0, purple=0xff7656c9,
 yellow=0xffe9ac35, blue=0xff3562a1;
SkPaint paint(SkColor color){SkPaint p;p.setAntiAlias(true);p.setColor(color);return p;}
SkPath polygon(std::initializer_list<SkPoint> pts, bool close=true, SkPathFillType fill=SkPathFillType::kWinding){
 SkPathBuilder b;b.setFillType(fill);bool first=true;for(auto pt:pts){if(first)b.moveTo(pt);else b.lineTo(pt);first=false;}if(close)b.close();return b.detach();
}
void rect(SkCanvas& c,float x,float y,float w,float h,SkColor color){c.drawRect(SkRect::MakeXYWH(x,y,w,h),paint(color));}
void scene1(SkCanvas& c){c.save();c.rotate(17,128,128);
 c.drawPath(polygon({{30.25,30.5},{102.75,36.25},{70.5,98.75}}),paint(red));
 c.drawPath(polygon({{135.5,28.25},{223.75,34.5},{173.25,62.75},{221.5,98.25},{135.5,96.5}}),paint(teal));
 c.drawPath(polygon({{30.5,132.25},{104.75,214.5},{29.25,184.75},{105.5,143.25},{63.5,224.25}}),paint(purple));
 c.drawPath(polygon({{144.5,132.25},{218.75,214.5},{143.25,184.75},{219.5,143.25},{177.5,224.25}},true,SkPathFillType::kEvenOdd),paint(yellow));c.restore();}
void scene2(SkCanvas& c){rect(c,15.5,20.25,95,65,red);
 // 用路径表达圆角矩形，最终仍须以本版本的指令记录为准。
 SkPathBuilder b;b.addRRect(SkRRect::MakeRectXY(SkRect::MakeXYWH(135.25,20.5,100,65),18,12));c.drawPath(b.detach(),paint(teal));
 c.drawOval(SkRect::MakeLTRB(23,112.75,102,191.75),paint(purple));
 c.drawOval(SkRect::MakeLTRB(132.25,121.75,234.75,185.25),paint(yellow));auto p=paint(blue);p.setStrokeWidth(5.5);p.setStyle(SkPaint::kStroke_Style);c.drawLine(22.25,221.5,232.75,207.25,p);}
void scene3(SkCanvas& c,float scale){auto p=paint(blue);p.setStyle(SkPaint::kStroke_Style);p.setStrokeWidth(10);
 const SkPaint::Cap caps[]={SkPaint::kButt_Cap,SkPaint::kRound_Cap,SkPaint::kSquare_Cap};
 const SkPaint::Join joins[]={SkPaint::kMiter_Join,SkPaint::kRound_Join,SkPaint::kBevel_Join};
 for(int i=0;i<3;i++){p.setStrokeCap(caps[i]);c.drawLine(20+83*i,25,70+83*i,25,p);}
 p.setStrokeCap(SkPaint::kButt_Cap);p.setStrokeMiter(4);
 for(int i=0;i<3;i++){p.setStrokeJoin(joins[i]);float x=20+83*i;c.drawPath(polygon({{x,102},{x+25,57},{x+50,102}},false),p);}
 p.setStrokeJoin(SkPaint::kMiter_Join);p.setStrokeMiter(1);c.drawPath(polygon({{25,160},{45,116},{55,160}},false),p);
 const SkScalar dash[]={13,7,3,7};p.setPathEffect(SkDashPathEffect::Make(dash,9));c.drawLine(90,140,235,140,p);
 // non-scaling-stroke 固定在最终视口的 CSS 像素，含根 viewBox 的倍率也不能放粗。
 p.setPathEffect(nullptr);p.setColor(red);p.setStrokeWidth(5/scale);c.drawLine(30,220,220,220,p);}
// 固定 Blink 的 SVG 渐变是非预乘插值，传统颜色使用 sRGB（见 sources.json）。
SkGradient::Interpolation svgInterpolation(){SkGradient::Interpolation i;i.fInPremul=SkGradient::Interpolation::InPremul::kNo;i.fColorSpace=SkGradient::Interpolation::ColorSpace::kSRGB;return i;}
void scene4(SkCanvas& c){const SkColor4f colors[]={SkColor4f::FromColor(0xffed354f),{1,224.f/255,74.f/255,.3f},{49.f/255,185.f/255,152.f/255,.75f},SkColor4f::FromColor(0xff394cc2)};
 const float stops[]={0,.35,.7,1};const SkPoint points[]={{75,0},{180,0}};
 const SkTileMode modes[]={SkTileMode::kClamp,SkTileMode::kRepeat,SkTileMode::kMirror};SkMatrix matrix;matrix.setRotate(12,128,128);
 for(int i=0;i<3;i++){SkGradient grad(SkGradient::Colors(colors,stops,modes[i]),svgInterpolation());auto p=paint(SK_ColorBLACK);p.setDither(true);p.setShader(SkShaders::LinearGradient(points,grad,&matrix));c.drawRect(SkRect::MakeXYWH(10,12+84*i,236,64),p);}}
void scene5(SkCanvas& c){const SkColor4f colors[]={SkColor4f::FromColor(0xfffff8d8),SkColor4f::FromColor(0xffea8251),SkColor4f::FromColor(0xff493779)};const float stops[]={0,.45,1};SkGradient grad(SkGradient::Colors(colors,stops,SkTileMode::kClamp),svgInterpolation());auto p=paint(SK_ColorBLACK);p.setDither(true);p.setShader(SkShaders::TwoPointConicalGradient({87,93},0,{128,128},106,grad));c.drawCircle(128,128,112,p);}
void scene6(SkCanvas& c){rect(c,12,12,232,232,0xfff1d8ab);auto layer=paint(SK_ColorBLACK);layer.setAlphaf(.45);c.saveLayer(nullptr,&layer);rect(c,35,42,135,130,red);c.drawCircle(155,151,70,paint(blue));c.drawPath(polygon({{60,205},{129,70},{210,205}}),paint(teal));c.restore();}
void scene7(SkCanvas& c){const SkRect crops[]={SkRect::MakeXYWH(0,0,128,120),SkRect::MakeXYWH(128,0,128,120),SkRect::MakeXYWH(24,145,82,80),SkRect::MakeXYWH(130,128,112,100)};const float sigmas[]={.8,3,12};
 for(int i=0;i<4;i++){c.save();c.clipRect(crops[i]);auto layer=paint(SK_ColorBLACK);
 if(i<3)layer.setImageFilter(SkImageFilters::Blur(sigmas[i],sigmas[i],nullptr,crops[i]));
 else layer.setImageFilter(SkImageFilters::DropShadow(8,6,3,3,SkColor4f{34.f/255,34.f/255,68.f/255,.65f},SkColorSpace::MakeSRGB(),nullptr,crops[i]));
 c.saveLayer(nullptr,&layer);if(i==0)rect(c,30,30,64,64,red);if(i==1)c.drawCircle(191,62,32,paint(teal));if(i==2)rect(c,25,145,80,80,purple);if(i==3)rect(c,150,151,72,60,yellow);c.restore();c.restore();}}
void scene8(SkCanvas& c){c.save();c.clipPath(polygon({{15,20},{117,30},{99,110},{30,95}}),true);rect(c,5,5,120,115,red);c.drawCircle(74,75,46,paint(teal));c.restore();
 c.saveLayer(nullptr,nullptr);rect(c,132,12,112,104,purple);auto mask=paint(SK_ColorBLACK);mask.setBlendMode(SkBlendMode::kDstIn);mask.setColorFilter(SkLumaColorFilter::Make());c.saveLayer(nullptr,&mask);rect(c,132,12,112,104,SK_ColorWHITE);c.drawCircle(188,64,38,paint(0xff80c040));c.restore();c.restore();
 for(int i=0;i<2;i++){c.saveLayer(nullptr,nullptr);rect(c,10+124*i,138,112,104,yellow);auto p=paint(blue);p.setBlendMode(i?SkBlendMode::kScreen:SkBlendMode::kMultiply);c.drawCircle(83+124*i,192,43,p);c.restore();}}
int main(int argc,char**argv){if(argc!=4){std::cerr<<"用法：micro 场景号 倍率 输出.rgba\n";return 2;}int scene=std::atoi(argv[1]);float scale=std::atof(argv[2]);if(scene<1||scene>8||!(scale==1||scale==1.5||scale==2))return 2;int size=int(256*scale);
 // 绘制表面使用 RGBA、预乘、sRGB；导出 PNG 前才转成非预乘 RGBA。
 SkBitmap bitmap;if(!bitmap.tryAllocPixels(SkImageInfo::Make(size,size,kRGBA_8888_SkColorType,kPremul_SkAlphaType,SkColorSpace::MakeSRGB())))return 3;bitmap.eraseColor(SK_ColorTRANSPARENT);SkCanvas canvas(bitmap);canvas.scale(scale,scale);
 switch(scene){case 1:scene1(canvas);break;case 2:scene2(canvas);break;case 3:scene3(canvas,scale);break;case 4:scene4(canvas);break;case 5:scene5(canvas);break;case 6:scene6(canvas);break;case 7:scene7(canvas);break;case 8:scene8(canvas);break;}
 std::vector<unsigned char> rgba(size*size*4);if(!bitmap.readPixels(SkImageInfo::Make(size,size,kRGBA_8888_SkColorType,kUnpremul_SkAlphaType,SkColorSpace::MakeSRGB()),rgba.data(),size*4,0,0))return 4;std::ofstream file(argv[3],std::ios::binary);file.write(reinterpret_cast<const char*>(rgba.data()),rgba.size());return file?0:5;}
