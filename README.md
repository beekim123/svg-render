# svg-render

让游戏直接画 SVG，画得和 Chrome 一样；画面很丰富、一屏很多 SVG 也流畅。先做 Godot（mac 桌面），以后做 Cocos 3.8.x（H5）。用 C++ 写。

## 现在做到哪

**阶段 0：参照和对照**，还没开工。这个阶段不写渲染器，只做三件事：

1. 用固定版本的 Chrome 出参照帧，做比图的工具；
2. 扫清楚所有素材用到了哪些 SVG 特性；
3. 做几个实验，证明"用 Skia 照着 Chrome 的指令画"走得通。

## 要读的

设计文档不在这个仓库里，在本机的设计目录，只读：

| 文件 | 是什么 |
|---|---|
| `/Users/key_/Desktop/CURRGO/game/design/SVG渲染/设计/阶段0-给GPT的需求.md` | **阶段 0 的需求，照它做** |
| `/Users/key_/Desktop/CURRGO/game/design/SVG渲染/设计/设计.md` | 整体设计：为什么这么做 |
| `/Users/key_/Desktop/CURRGO/game/design/SVG渲染/设计/阶段计划.md` | 7 个阶段，每个阶段的验收 |
| `/Users/key_/Desktop/CURRGO/game/design/SVG渲染/设计/试验/` | 设计时做的小试验，思路可以参考 |

## 目录

照阶段 0 需求第 2 节的目录建。`out/` 是生成物，不进版本管理。下载的 Chrome、Skia 源码、测试集放在 `~/Library/Caches/svg-render/`，也不进仓库。

## 分工

- 设计：Fable 5.2。每个阶段的需求都由它写，放在上面的设计目录里。
- 编码：GPT。
- 测试图：argon。
