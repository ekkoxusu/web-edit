<div align="center">

<img src="icons/icon128.png" width="96" alt="Web Edit" />

# Web Edit · 网页改完，直接存回去

**像改 PPT 一样改网页 —— 拖一拖、缩一缩、双击改个字，`Ctrl+S` 直接写回原 HTML 文件。**

[Chrome MV3](https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white)
[零依赖](https://img.shields.io/badge/dependencies-0-green)
[零构建](https://img.shields.io/badge/build%20steps-0-green)
[源码 ~1300 行](https://img.shields.io/badge/源码-≈1.3k%20行-blue)
[MIT License](https://img.shields.io/badge/License-MIT-yellow)

[为什么需要](#为什么需要-web-edit) · [功能一览](#功能一览) · [安装](#安装30-秒) · [快速上手](#快速上手) · [保存机制](#保存直接写回原文件) · [实现说明](#实现说明) · [FAQ](#faq)

</div>

---

## 为什么需要 Web Edit？

「这个标题往左挪一点，字号大一号，背景太扎眼了换个颜色。」

听起来是三秒钟的事，动手却是：

- 打开 DevTools → 在 Elements 面板里一层层找节点 → 眯着眼睛改 `margin-left: 20px` → 改完发现没存，刷新全没了 😇
- 装了 VisBug 这类可视化工具，拖拽是爽了 → 但改动只活在内存里，**导出不了、也存不回文件** 😇

Web Edit 把这两步合成了一步：

> **页面上直接拖拽编辑，按 `Ctrl+S`，修改原样写回 HTML 源文件。**

| | Chrome DevTools | VisBug 等可视化工具 | **Web Edit** |
| --- | :---: | :---: | :---: |
| 可视化拖拽 / 缩放 | ✗ 手改数值 | ✓ | ✓ |
| 双击改文字 | ✗ | ✓ | ✓ |
| 常用样式一键改 | 得先会 CSS | ✓ | ✓ |
| 撤销 / 重做 | ✓ | ✗ | ✓ 50 步 |
| **写回原 HTML 文件** | ✗ | ✗ | ✓ |
| 依赖 / 构建 | — | — | **0 依赖 · 0 构建** |

一句话定位：**给静态 HTML 文件用的「所见即所存」编辑器**。改着陆页、改原型、改课程作业、让设计稿快速落地——不用开编辑器找节点，页面上指哪改哪。

## 功能一览

- 🖱️ **可视化编辑** — 单击选中，拖拽移动，8 向手柄缩放（角手柄 + `Shift` 等比），方向键微调（`Shift` ×10）
- ✍️ **双击改字** — 直接在页面里编辑文字内容
- 🎨 **样式面板** — 文字颜色、字号、字重、对齐、背景、边距、圆角，点一下就生效
- 💾 **直接写回源文件** — File System Access API 覆盖原文件；首次授权后静默保存，环境不支持时自动降级为下载
- ↩️ **撤销 / 重做** — `Ctrl+Z` / `Ctrl+Shift+Z`，最多 50 步
- 📋 **复制 / 删除 / 选父级** — 选中后工具栏一键操作，`Delete` 删除
- 🧅 **样式隔离** — 全部 UI 跑在 Shadow DOM 里，和页面样式互不干扰，导出时自动摘除，零污染
- ⌨️ **一键开关** — 工具栏图标或 `Alt+Shift+E`

## 安装（30 秒）

1. 下载本仓库（`Code → Download ZIP` 解压，或 `git clone`）
2. 打开 `chrome://extensions`，右上角开启**「开发者模式」**
3. 点击**「加载已解压的扩展程序」**，选择项目目录
4. 想编辑**本地 HTML 文件**？扩展详情页 → 开启**「允许访问文件网址」**

> 推荐 Chromium 内核浏览器（Chrome / Edge / Brave）。保存写回依赖 File System Access API，Firefox / Safari 不支持，会走下载降级。

## 快速上手

打开任意页面（本地先跑 `open testpage/index.html` 试试），按 `Alt+Shift+E` 进入编辑模式：

| 操作 | 方式 |
| --- | --- |
| 开 / 关编辑模式 | 工具栏图标，或 `Alt+Shift+E` |
| 选中元素 | 单击 |
| 移动元素 | 按住拖拽；或选中后方向键微调（`Shift` ×10） |
| 缩放元素 | 拖动 8 向手柄（角手柄 + `Shift` 等比） |
| 编辑文字 | 双击元素 |
| 样式面板 | 选中后点工具栏 🎨 |
| 复制 / 删除 / 选父级 | 选中后点工具栏按钮；`Delete` 删除 |
| 撤销 / 重做 | `Ctrl+Z` / `Ctrl+Shift+Z`（最多 50 步） |
| 保存写回 | `Ctrl+S` 或顶栏「保存」；「另存」可换目标文件 |
| 逐级退出 | `Esc`（编辑文字 → 取消选中 → 退出编辑模式） |

首次保存会弹出系统对话框，**选中原 HTML 文件**即完成授权，之后每次 `Ctrl+S` 都是静默覆盖保存 ✌️

## 保存：直接写回原文件

- 优先走 **File System Access API**：首次弹出系统对话框选定原文件，句柄会话内缓存，之后写回不再打扰
- 文件被移动 / 删除导致句柄失效时，自动引导重新选择
- 环境不支持 FSA（非安全上下文等）时，**自动降级为浏览器下载**，永远给你留一份结果
- 导出前自动收尾：退出文字编辑、摘除扩展 UI、清掉 `<html>` 上的临时样式——**存下来的就是你在页面上看到的样子**

## 实现说明

整个项目没有一行需要编译：**原生 JS + Manifest V3，零依赖、零构建，克隆即用**。

- 所有修改写入内联样式 / DOM（`style.translate`、`style.width` 等），序列化即所见
- 编辑器 UI 全部隔离在 Shadow DOM 中，与页面样式互不污染；保存时自动摘除
- 撤销 / 重做基于 `outerHTML` 快照双栈整体恢复——静态页面下最简单可靠；代价是页面自身 JS 的事件绑定会丢失（见 FAQ）
- 代码约 1300 行，按职责拆成 7 个内容脚本（命名空间 `WE`，按序加载），一个下午能读完

```
manifest.json            扩展配置（MV3）
background/              快捷键转发 service worker（8 行）
popup/                   工具栏弹窗
content/                 注入页面的编辑器（命名空间 WE，7 个脚本按序加载）
  ns.js                  命名空间与事件总线
  history.js             撤销 / 重做（快照双栈）
  ui.js                  选中框、手柄、工具栏、Shadow DOM 宿主
  style-panel.js         样式面板
  interactions.js        拖拽 / 缩放 / 文字编辑等全部交互
  saver.js               序列化与 FSA 写回 / 下载降级
  main.js                入口与消息路由
testpage/index.html      本地测试页
tools/gen_icons.py       图标生成脚本（纯标准库，输出到 stdout）
```

## FAQ

**支持哪些浏览器？**
编辑功能在 Chromium 内核（Chrome / Edge / Brave）可用；写回文件依赖 File System Access API，Firefox / Safari 不支持，会自动降级为下载。

**会把我的页面改坏吗？**
所有修改先落在 DOM / 内联样式上，不满意 `Ctrl+Z` 退回；只有按保存才会写入文件。建议配合 git 等版本管理食用 🍚

**能编辑 React / Vue 这类动态页面吗？**
本项目的核心场景是**静态 HTML 文件**（着陆页、原型、模板）。动态页面上可以临时改样式做演示，但整体快照式撤销会丢失页面脚本的事件绑定，且改动能被框架重新渲染覆盖。

**iframe 里的内容能编辑吗？**
暂不支持。

**图标怎么重新生成？**
`python3 tools/gen_icons.py > icons/icon128.png`（纯标准库，无第三方依赖）。

## License

[MIT](LICENSE) © xusu
