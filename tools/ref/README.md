# 参照帧及验收驱动

## 命令

- 全清单：`node tools/ref/batch.mjs --manifest 素材/清单.json --out out/linux --concurrency 2`
- 重出：加 `--no-cache`。限定素材：可重复给 `--id 现有游戏/mon_chest`。
- GPU参照：加 `--gpu`，输出应使用独立目录。启动后必须实测确认GPU光栅开启，否则运行失败。
- 可重复性：`node tools/ref/audit.mjs repeat --out out/linux/repeat`。完整模式加 `--全部`。
- Chrome自身差：`node tools/ref/audit.mjs noise --out out/linux/noise`。
- Linux对Mac测量：`node tools/ref/audit.mjs cross --linux out/linux/ref --mac out/mac/ref --out 报告/mac/跨平台差`。两个输入都是ref目录；不设画质及格线，缺配对/尺寸不符/计算失败才使测量未完成。输出 `结果.json` 和自包含 `index.html`。
- 覆盖检查：`node tools/ref/audit.mjs coverage --out out/linux`。
- 单张微场景：`node tools/ref/cli.mjs 场景.svg --out out/linux/scene.png --scale 1.5 --oplog`。

所有失败均在报告体现，命令返回非零；没有图片、缺少缓存文件、浏览器启动失败均不能算通过。

## 清单接口

顶层数组，或 `{ "素材": [...] }`。条目包含 `id`、`文件`、`动作`、`染色`。文件相对仓库根目录解析；公开集使用 `cache:tests/resvg/<提交>/...`，由共享路径工具解析到当前平台缓存，清单不固定Linux绝对路径。id禁止绝对路径和向上跳转。动作包含 `名字`、`种类`、非循环动作的正数 `毫秒`，可选 `触发`、`smil`、`周期毫秒`。

兼容旧stay待判定条目：`种类:null, 分类状态:"待验证"`。工具在Chrome进场结束时检查实际仍生效的无限循环，报告中记录解析后的种类。不会默认判成停住，不自动修改输入清单。

时刻：无限周期最长8秒；循环12+3随机，单次最多24个常规样本+结束前0.5ms+3随机；静态素材只0ms。大图2倍只首中末。试验图、char_golem、mon_chest的非待机动作另出 `动作@switch1234`；常规动作在全局1000ms触发。每动作新加载页面，旧循环不重置。

## 产物和缓存

参照、活图、值表、指令分别在输出根的 `ref/`、`live/`、`values/`、`oplog/`。默认out/linux或out/mac。冻结SVG在ref内保留；1倍为 `<时刻>.svg`，其他倍数另存，避免覆盖显示尺寸。

每帧JSON包含素材、动作、本地/全局时间、倍率、源指纹、工具版本、字体指纹、文字区域、完整实际启动参数和光栅信息。文字区域是截图像素坐标。原始PNG不重编码。

缓存key包含源、动作、染色、时间表、平台/架构、Chrome光栅状态、规范化启动参数、字体、代码指纹和根参照版本配置指纹。随机用户目录只在key中规范化，实际参数完整保存在帧元数据、批报告和reference进程文件中。所有文件SHA256均匹配且冻结复核通过才命中。覆盖检查使用当前动作规范、源、字体、平台、参照配置和代码重算同一缓存key；旧报告中的时刻不直接作期望，而是用已记录Chrome周期/尺寸证据重新计算当前帧计划和值表范围。同名动作的触发器或时长变化也会明确失败。

`报告/参照.json`包含所有帧的值复核及活图相似度。逐轨复核使用冻结副本中保留的原节点编号，不受删除动画节点影响。数值容差0.001，矩阵另保留4位；实际写回矩阵使用完整精度。活图与冻结图要求全图SSIM≥0.95。

重复性强制禁用缓存，两遍分别新建并关闭Chrome；逐字节比较冻结PNG。自身差报告没有画质及格线，记录CPU对GPU、活图对冻结图的四项指标、最差与中位数。`结果.json` 额外提供 `帧` map，键是相对ref根目录的PNG路径（不带ref/前缀），值按全图/非文字/文字保存实测指标，可直接传给对照工具 `--GPU基准`。对照工具仍按原有严格GPU规则判断，测量工具不会放宽该规则。

## 实际验证边界

本Linux环境标准Chrome因 `socket() failed: Operation not permitted` 无法启动。因此全部Chrome相关路径仍待真实验证，不能称为参照验收通过。

以下是已运行的离线测试，不代替浏览器验收：

- `node tools/ref/check.mjs`：时刻规则与脚本语法。
- `node tools/ref/check-timeline.mjs`：DOM替身测试循环续播、1234ms触发、结束后回跳、取消后不复活。
- `node tools/ref/check-batch.mjs`：模拟会话测试缓存、损坏重出、覆盖、两遍新会话、GPU编排及失败传播。模拟产物只在临时目录，结束后删除。

尚需实际验证的风险：不同SMIL属性animVal覆盖、CSS与animateMotion同时作用时的矩阵写回、滤镜和文字的冻结等价性、Chromium具体LayerTree事件时序。未覆盖的animVal直接报错，不静默取baseVal或原值。若轨道验证失败，完整错误保留，不能入通过缓存。

所有0毫秒1倍帧必须有非空指令记录。染色素材分别保存 `oplog/<id>@E3263A.json`、`oplog/<id>@3FE3F0.json`，动作报告记录 `首帧指令` 位置；不会用一套颜色的指令代替另一套。
