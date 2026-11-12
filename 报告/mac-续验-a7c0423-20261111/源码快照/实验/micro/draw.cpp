// 阶段 0 的一次性手写场景，不是 SVG 编译器或运行时。
// 按 Mac 固定 Chrome 的24份真实指令对齐调用/画笔/分层；内部参数依据见 sources.json。
// 源码对齐不代替本次重新编译、24帧像素比较和可失效的校准凭据。
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
SkPaint layerPaint(){SkPaint p;p.setColor(SK_ColorBLACK);return p;}
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
 // 保留 oplog 的起点、方向、Conic 顺序及权重，不依赖 addRRect 默认起点。
 const float w=.70710676908493f;SkPathBuilder b;
 b.moveTo(153.25f,20.5f).lineTo(217.25f,20.5f).conicTo(235.25f,20.5f,235.25f,32.5f,w)
  .lineTo(235.25f,73.5f).conicTo(235.25f,85.5f,217.25f,85.5f,w)
  .lineTo(153.25f,85.5f).conicTo(135.25f,85.5f,135.25f,73.5f,w)
  .lineTo(135.25f,32.5f).conicTo(135.25f,20.5f,153.25f,20.5f,w).close();c.drawPath(b.detach(),paint(teal));
 c.drawOval(SkRect::MakeLTRB(23,112.75,102,191.75),paint(purple));
 c.drawOval(SkRect::MakeLTRB(132.25,121.75,234.75,185.25),paint(yellow));
 const auto line=polygon({{22.25f,221.5f},{232.75f,207.25f}},false);
 // SVG <line> 的默认黑 Fill 虽零面积，仍照真实记录先重放，再描边。
 c.drawPath(line,paint(SK_ColorBLACK));auto p=paint(blue);p.setStrokeWidth(5.5);p.setStyle(SkPaint::kStroke_Style);c.drawPath(line,p);}
void scene3(SkCanvas& c,float scale){c.save();c.scale(scale,scale);auto p=paint(blue);p.setStyle(SkPaint::kStroke_Style);p.setStrokeWidth(10);
 const SkPaint::Cap caps[]={SkPaint::kButt_Cap,SkPaint::kRound_Cap,SkPaint::kSquare_Cap};
 const SkPaint::Join joins[]={SkPaint::kMiter_Join,SkPaint::kRound_Join,SkPaint::kBevel_Join};
 for(int i=0;i<3;i++){p.setStrokeCap(caps[i]);float x=20+83*i;c.drawPath(polygon({{x,25},{x+50,25}},false),p);}
 p.setStrokeCap(SkPaint::kButt_Cap);p.setStrokeMiter(4);
 for(int i=0;i<3;i++){p.setStrokeJoin(joins[i]);float x=20+83*i;c.drawPath(polygon({{x,102},{x+25,57},{x+50,102}},false),p);}
 p.setStrokeJoin(SkPaint::kMiter_Join);p.setStrokeMiter(1);c.drawPath(polygon({{25,160},{45,116},{55,160}},false),p);
 p.setStrokeMiter(4);const SkScalar dash[]={13,7,3,7};p.setPathEffect(SkDashPathEffect::Make(dash,9));c.drawPath(polygon({{90,140},{235,140}},false),p);c.restore();
 // oplog 先恢复根倍率，再 concat(2*scale)、concat(1/(2*scale))，用设备坐标路径和宽5。
 c.save();c.scale(2*scale,2*scale);c.save();c.scale(1/(2*scale),1/(2*scale));
 p.setPathEffect(nullptr);p.setColor(red);p.setStrokeWidth(5);c.drawPath(polygon({{30*scale,220*scale},{220*scale,220*scale}},false),p);c.restore();c.restore();}
// 固定 Blink 的 SVG 渐变是非预乘插值，传统颜色使用 sRGB（见 sources.json）。
SkGradient::Interpolation svgInterpolation(){SkGradient::Interpolation i;i.fInPremul=SkGradient::Interpolation::InPremul::kNo;i.fColorSpace=SkGradient::Interpolation::ColorSpace::kSRGB;return i;}
void scene4(SkCanvas& c){const SkColor4f colors[]={SkColor4f::FromColor(0xffed354f),{1,224.f/255,74.f/255,.3f},{49.f/255,185.f/255,152.f/255,.75f},SkColor4f::FromColor(0xff394cc2)};
 const float stops[]={0,.35,.7,1};const SkPoint points[]={{75,0},{180,0}};
 const SkTileMode modes[]={SkTileMode::kClamp,SkTileMode::kRepeat,SkTileMode::kMirror};SkMatrix matrix;matrix.setRotate(12,128,128);
 for(int i=0;i<3;i++){SkGradient grad(SkGradient::Colors(colors,stops,modes[i]),svgInterpolation());auto p=paint(SK_ColorBLACK);p.setDither(true);p.setShader(SkShaders::LinearGradient(points,grad,&matrix));c.drawRect(SkRect::MakeXYWH(10,12+84*i,236,64),p);}}
void scene5(SkCanvas& c){const SkColor4f colors[]={SkColor4f::FromColor(0xfffff8d8),SkColor4f::FromColor(0xffea8251),SkColor4f::FromColor(0xff493779)};const float stops[]={0,.45,1};SkGradient grad(SkGradient::Colors(colors,stops,SkTileMode::kClamp),svgInterpolation());auto p=paint(SK_ColorBLACK);p.setDither(true);p.setShader(SkShaders::TwoPointConicalGradient({87,93},0,{128,128},106,grad));c.drawCircle(128,128,112,p);}
void scene6(SkCanvas& c){rect(c,12,12,232,232,0xfff1d8ab);auto layer=layerPaint();layer.setAlphaf(.45);const auto bounds=SkRect::MakeLTRB(35,42,225,221);c.saveLayer(&bounds,&layer);rect(c,35,42,135,130,red);c.drawCircle(155,151,70,paint(blue));c.drawPath(polygon({{60,205},{129,70},{210,205}}),paint(teal));c.restore();}
void scene7(SkCanvas& c){const SkRect crops[]={SkRect::MakeXYWH(0,0,128,120),SkRect::MakeXYWH(128,0,128,120),SkRect::MakeXYWH(24,145,82,80),SkRect::MakeXYWH(130,128,112,100)};const float sigmas[]={.8,3,12};
 const SkRect bounds[]={SkRect::MakeLTRB(27,27,97,97),SkRect::MakeLTRB(150,21,232,103),SkRect::MakeLTRB(24,145,106,225),SkRect::MakeLTRB(149,148,239,226)};
 // Chrome 由滤镜自己的 crop 裁输出，没有额外的硬 clipRect；硬裁剪在1.5倍会吞掉半像素边。
 for(int i=0;i<4;i++){auto layer=layerPaint();
 if(i<3)layer.setImageFilter(SkImageFilters::Blur(sigmas[i],sigmas[i],nullptr,crops[i]));
 else layer.setImageFilter(SkImageFilters::DropShadow(8,6,3,3,SkColor4f{34.f/255,34.f/255,68.f/255,.65f},SkColorSpace::MakeSRGB(),nullptr,crops[i]));
 c.saveLayer(&bounds[i],&layer);if(i==0)rect(c,30,30,64,64,red);if(i==1)c.drawCircle(191,62,32,paint(teal));if(i==2)rect(c,25,145,80,80,purple);if(i==3)rect(c,150,151,72,60,yellow);c.restore();}}
void scene8(SkCanvas& c){c.save();c.clipRect(SkRect::MakeLTRB(15,20,117,110),SkClipOp::kIntersect,true);c.clipPath(polygon({{15,20},{117,30},{99,110},{30,95}}),true);rect(c,5,5,120,115,red);c.drawCircle(74,75,46,paint(teal));c.restore();
 const auto maskBounds=SkRect::MakeLTRB(132,12,244,116);
 c.saveLayer(&maskBounds,nullptr);c.save();c.clipRect(maskBounds,SkClipOp::kIntersect,true);rect(c,132,12,112,104,purple);c.restore();
 auto mask=layerPaint();mask.setBlendMode(SkBlendMode::kDstIn);c.saveLayer(&maskBounds,&mask);
 c.save();c.clipRect(maskBounds,SkClipOp::kIntersect,true);c.save();c.clipRect(maskBounds,SkClipOp::kIntersect,false);
 // SVGMaskPainter 的 MakeLuma 在独立内层应用；DstIn 只放在外层恢复画笔。
 auto luma=layerPaint();luma.setColorFilter(SkLumaColorFilter::Make());c.saveLayer(nullptr,&luma);
 c.concat(SkMatrix::I());rect(c,132,12,112,104,SK_ColorWHITE);c.drawCircle(188,64,38,paint(0xff80c040));
 c.restore();c.restore();c.restore();c.restore();c.restore();
 for(int i=0;i<2;i++){
  const auto isolated=SkRect::MakeLTRB(10+124*i,138,126+124*i,242),blendBounds=SkRect::MakeLTRB(40+124*i,149,126+124*i,235);
  c.saveLayer(&isolated,nullptr);rect(c,10+124*i,138,112,104,yellow);
  auto blend=layerPaint();blend.setBlendMode(i?SkBlendMode::kScreen:SkBlendMode::kMultiply);c.saveLayer(&blendBounds,&blend);
  c.drawCircle(83+124*i,192,43,paint(blue));c.restore();c.restore();}}
int main(int argc,char**argv){if(argc!=4){std::cerr<<"用法：micro 场景号 倍率 输出.rgba\n";return 2;}int scene=std::atoi(argv[1]);float scale=std::atof(argv[2]);if(scene<1||scene>8||!(scale==1||scale==1.5||scale==2))return 2;int size=int(256*scale);
 // 绘制表面使用 RGBA、预乘、sRGB；导出 PNG 前才转成非预乘 RGBA。
 SkBitmap bitmap;if(!bitmap.tryAllocPixels(SkImageInfo::Make(size,size,kRGBA_8888_SkColorType,kPremul_SkAlphaType,SkColorSpace::MakeSRGB())))return 3;bitmap.eraseColor(SK_ColorTRANSPARENT);SkCanvas canvas(bitmap);canvas.save();canvas.clipRect(SkRect::MakeWH(size,size),SkClipOp::kIntersect,true);if(scene!=3)canvas.scale(scale,scale);
 switch(scene){case 1:scene1(canvas);break;case 2:scene2(canvas);break;case 3:scene3(canvas,scale);break;case 4:scene4(canvas);break;case 5:scene5(canvas);break;case 6:scene6(canvas);break;case 7:scene7(canvas);break;case 8:scene8(canvas);break;}canvas.restore();
 std::vector<unsigned char> rgba(size*size*4);if(!bitmap.readPixels(SkImageInfo::Make(size,size,kRGBA_8888_SkColorType,kUnpremul_SkAlphaType,SkColorSpace::MakeSRGB()),rgba.data(),size*4,0,0))return 4;std::ofstream file(argv[3],std::ios::binary);file.write(reinterpret_cast<const char*>(rgba.data()),rgba.size());return file?0:5;}
