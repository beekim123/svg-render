# 实验 6：文字转轮廓

运行：`node 实验/text/run.mjs`。离线字形检查：`node 实验/text/self-test.mjs`。

依赖固定的 fontkit 2.0.4、仓库两份 OTF 和参照工具固定的 Chrome。入口通过 `tools/ref` 的同一字体服务、软件光栅校验和冻结截图流程运行。输出为 `out/linux/text/` 或 `out/mac/text/`，汇总为 `result.json`。失败退出 2、不及格退出 1、及格退出 0。离线自测成功不代表 Chrome 实验成功。

共 36 例：Regular/Bold × 14/24/48 像素 × 普通中文数字、字间距、tspan dx/dy、圆形 textPath、描边 paint-order、整体旋转 15 度。每例都交 1 倍和 2 倍图、原始截图元数据、轮廓 SVG、差异图及指标。比较范围取原始文字的屏幕包围盒，按整像素向外取整。指标调用共用的深浅底 SSIM 实现，判定只使用实验 6 的两项线，不能把对照工具的其他通用质量线误当实验 6 验收线。

字符接口从未替换的原始 text 读取；tspan 的位移与 textPath 的位置、转角已在接口结果里，不再应用第二遍。text 自身 transform 只复制到替换组一次。轮廓的 Y 轴反转，描边宽度和虚线距离除以字体缩放率。由 Chrome 对每个字形组求实际曲线包围盒，避免旋转未旋转矩形产生虚假的边界。空格保留定位信息，但没有墨迹，包围盒差写 null，不当成缺字或错误。

**位置差怎么量（2026-11-11 Claude 改）**：`getExtentOfChar` 给的是字身框，不是墨迹框。所以位置差 = 我们自己按字体度量算出的字身框，和 `getExtentOfChar` 四条边的最大差（本地 SVG 坐标，含空格）。字身框 = 从字的起点（`getStartPositionOfChar`）开始，宽是步进宽（fontkit 的 advanceWidth）加字间距，高是从上伸到下伸（hhea 的 ascent / descent），再按字的转角（`getRotationOfChar`）旋转后取外接矩形。

- Chrome 把上伸、下伸**在设备像素里取整**（例：1 倍 24px 时上伸 27.84 → 28；2 倍 48px 时按 96 设备像素算 111.36 → 111，折回是 55.5），判定用取整后的值（`最大字符位置差`）；按字体原值算的另报一个数（`字身框差_按字体原值`），只看不判。屏幕缩放系数照 Blink 的算法取 sqrt((a²+b²+c²+d²)/2)。
- Chrome 的字的起点按 1/64 像素量化，在 0.1 像素线以内。
- 原来的做法是拿墨迹框去比字身框，两个口径不同，差值随字号线性变大（14px 约 5.7、48px 约 20.3）。这个数仍报为 `墨迹框差_只看不判`。

**2026-11-11 起参照页本身就关了字形平滑**（`tools/ref/index.mjs` 的页面样式，用户定），正式结果已经是关平滑的。下面这个开关是当时做诊断用的：`node 实验/text/run.mjs --smoothing antialiased` 会给 SVG 根加 `-webkit-font-smoothing:antialiased`，输出到 `out/<平台>/text-antialiased/`，用来看 Mac 上文字比轮廓粗是不是 CoreText 平滑造成的。不是正式结果。

本实验仅涵盖指定的中文、ASCII 数字和空格。不把逐字 cmap 查找宣称为完整文字整形实现；如换成连字、组合字符、代理对或折叠空白导致 DOM 字符索引不对应，直接报错，不猜测字符映射。
