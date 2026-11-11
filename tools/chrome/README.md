# Chrome 与参照工具

固定 Chrome for Testing 157.0.8103.50，只接入完整 Chrome，不接受 headless-shell。下载由上层安装流程负责，本模块不自行下载。

设置 `SVG_RENDER_CACHE` 指向缓存根目录，或 `SVG_RENDER_CHROME` 指向固定版本可执行文件。默认缓存路径遵守阶段 0 需求。工具启动时严格验证浏览器版本与软件光栅；不自动添加 `--no-sandbox`。

`openChrome({mode:'cpu'})` 返回 `newPage()`、`send()`、`evaluate()`、`setHtml()`、`shot()`、`viewport()`、`on()`、`close()`，以及 `gpuInfo` 和实际完整 `flags`。`close()` 只关闭本工具创建的进程和临时目录。

`tools/ref/index.mjs` 提供：

- `captureStatic({svg,scale,output,oplog})`：单图截图，写 PNG、同名 JSON、冻结 SVG；可选写指令 JSON。
- `createReferenceSession(options)`：复用 Chrome 与字体服务；`render({svg,scale,time,action,triggerTime,color,id,oplog})` 返回冻结图、活图、冻结文本、值、元数据。
- `sampleValues({svg,action,duration,id,...})`：每 20 毫秒一行，返回轨道表。
- `prepare(...)` 后可通过 `browser.evaluate('__ref.period()')` 读取当前无限动画的最长周期。
- `commandLog(page)`：只对有效内容层抓取并释放快照。空记录报错。

文字元数据统一为 `倍率`、`文字区域: [{x,y,width,height}]`，坐标是截图像素。

示例：`node tools/ref/cli.mjs 实验/场景.svg --out out/linux/scene.png --scale 1.5 --oplog`。

## 当前验证边界

Linux 执行环境中，标准参数启动 Chrome 因 `process_singleton_posix.cc: socket() failed: Operation not permitted` 崩溃。环境级执行许可后仍失败。没有修改 Chrome 安全设置、没有生成假截图。`node tools/ref/check.mjs` 仅验证时刻算法及页面脚本语法。

清单批处理、缓存、冻结逐轨复核、重复性与GPU自身差驱动现已接入，详见 `tools/ref/README.md`。上述浏览器相关功能尚未真实验过；离线模拟测试不代替验收。SMIL未覆盖的animVal类型直接报错。
