# DaySprig

简体中文 | [English](README.en.md)

DaySprig 是一款适用于 Obsidian 的独立桌面任务日历插件，提供专注的日历、任务笔记、提醒、每日清单和最近文件功能。它不需要 TaskNotes。

维护者：[Felix-Ashford](https://github.com/Felix-Ashford)。[报告问题](https://github.com/Felix-Ashford/DaySprig/issues)。

DaySprig 是由独立维护者维护的衍生项目，并非官方 TaskNotes 发布版本。项目基础来自 TaskNotes 3.25.4 标签，对应提交为 [741ce165c9ee95b23a613d0edcd4bc842ee45979](https://github.com/callumalpass/tasknotes/tree/741ce165c9ee95b23a613d0edcd4bc842ee45979)，作者为 Callum Alpass。大部分核心任务管理功能源自上游项目。

## 相比上游项目的变化

- 将日历交互、提醒、今日列表、每日清单和最近文件整合到同一个插件中。
- 在日历中单击任务可切换完成状态，双击可编辑，右键可循环切换重要度，按住 Shift 右键可打开原始右键菜单，按住 Ctrl/Cmd 单击可打开任务笔记。原有的列表周视图行为仍然保留。
- 执行日历命令会打开月视图；如果日历已经位于前台，则会关闭日历。
- 使用 DaySprig 品牌、daysprig 插件 ID、自定义默认快捷键和任务颜色。
- 默认将任务笔记存储在 `DaySprig/Tasks`，将归档笔记存储在 `DaySprig/Archive`。任务状态、重要度、日期、重复规则和完成记录等已有任务属性仍然支持。
- 不包含私有的深色 PDF 导出器。仅支持桌面端。

部分 TaskNotes 上游模块仍保留在代码中，但其主要命令和设置入口已从界面隐藏。番茄钟、ICS、看板、统计、Bases、时间追踪及 API/Webhook 相关实现尚未全部移除；其中某些服务或视图仍会初始化，具体后台行为取决于插件设置和已有数据。DaySprig 当前是基于上游项目精简用户界面的衍生版本，尚未完成对这些模块的彻底清理。

## 默认快捷键和颜色

| 操作 | Windows/Linux | macOS |
| --- | --- | --- |
| 打开/切换 DaySprig | Ctrl+Shift+R | Cmd+Shift+R |
| 打开/切换今日列表 | Ctrl+Shift+D | Cmd+Shift+D |
| 打开/切换最近文件 | Ctrl+Shift+Q | Cmd+Shift+Q |

Obsidian 中保存的自定义快捷键优先级更高。可以在“设置 > 快捷键”中修改或重置这些快捷键。

重要度颜色：无 #e2ffad，低 #8ed29f，普通 #ffdf9e，高 #d53030。已完成状态使用 #0497c8。这些颜色仍可在设置中修改。

## 安装与兼容性

1. 从 [DaySprig 发布页面](https://github.com/Felix-Ashford/DaySprig/releases)下载 `main.js`、`manifest.json` 和 `styles.css`。
2. 将它们复制到 vault 的 `.obsidian/plugins/daysprig` 目录中（如果使用了自定义配置目录，则复制到对应目录）。
3. 在“设置 > 社区插件”中启用 DaySprig。如有需要，请重启 Obsidian。

DaySprig 使用自己的视图标识符和数据键。应当将它设置为当前 vault 使用的任务日历。

任务仍然是普通的 Markdown 笔记，不需要进行任务转换。DaySprig 只使用自己的设置和插件数据。

0.1.0 版本用于初始测试。维护者会进行 Obsidian 手动验收测试。当前自动化测试只覆盖少量数据辅助函数，不能代表完整的界面或端到端兼容性。声明的最低 Obsidian 版本为 1.5.0；在正式发布或提交到社区之前，仍需要手动确认兼容性。

## 数据与可选集成

设置以及清单、提醒状态保存在插件的 `data.json` 中；任务保存在 vault 笔记中。API 和自动 ICS 导出默认关闭，但上游 ICS 订阅、导出及 HTTP API/Webhook 的实现仍保留，且主要设置入口已隐藏。若已有配置启用了 ICS 订阅或其他集成功能，插件仍可能执行相应的后台操作；启用远程订阅或 Webhook 时，可能会向配置的服务发送请求。请勿公开你的 `data.json`、凭据或个人 vault 内容。

## 开发与发布

使用 Node.js 22 或更高版本，并使用仓库中已提交的 `package-lock.json`：

    npm ci
    npm run build
    npm test -- --runInBand
    npm run test:build

生产构建会根据 esbuild 的实际打包输入生成第三方许可声明，并将完整的项目和依赖许可声明嵌入 `main.js`。生成的 `THIRD-PARTY-NOTICES.md` 会提交到仓库中供审查。未知许可证或缺少许可证文本都会导致构建失败。

    npm run release:package

该命令会创建 `dist/daysprig`，其中包含三个可安装文件、许可证/源码声明，以及 `ical.js` 源码归档。GitHub 标签发布会执行相同的检查并创建草稿预发布版本。请在手动验收测试完成后再发布。标签名称必须与 `manifest.json`、`package.json` 和 `versions.json` 保持一致（例如 `0.1.0`，不带 `v` 前缀）。

在运行 `npm run dev` 前，将 `OBSIDIAN_PLUGIN_PATH` 设置为测试 vault 中的 daysprig 插件目录，或使用被 Git 忽略的 `.copy-files.local` 文件配置。该脚本会拒绝目标目录名称为 tasknotes 的路径。

## 许可证与致谢

DaySprig 修改部分的版权归 Felix-Ashford 所有（2026 年）。TaskNotes 基础代码的版权归 Callum Alpass 所有（2025 年）。两者均以 [MIT 许可证](LICENSE)发布；项目来源说明见 [NOTICE.md](NOTICE.md)。

捆绑的依赖保留各自的许可证条款，详见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。其中，`ical.js` 使用 MPL-2.0，`reflect-metadata` 使用 Apache-2.0；DaySprig 的 MIT 许可证不会取代这些条款。MPL 源码可用性记录在 [THIRD-PARTY-SOURCE.md](THIRD-PARTY-SOURCE.md) 中，相应的未修改 `ical.js` 源码也包含在发布材料中。
