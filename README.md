# <a id="chinese-version"></a>DaySprig

中文 | [English](#english-version)

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

当前实现仍保留完整的 TaskNotes 核心功能，包括可选的时间追踪、番茄钟、ICS、API、看板、统计和 Bases 功能。它不是一个精简重写版本。

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

设置以及清单、提醒状态保存在插件的 `data.json` 中；任务保存在 vault 笔记中。DaySprig 保留可选的上游 ICS 订阅、导出和 HTTP API/Webhook 功能。API 和自动导出默认关闭。启用外部订阅或 Webhook 后，插件可能会向配置的服务发送请求。请勿公开你的 `data.json`、凭据或个人 vault 内容。

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

---

<a id="english-version"></a>

## English Version

[中文](#chinese-version)

# DaySprig


DaySprig is a standalone desktop task calendar for Obsidian. It provides a focused calendar, task notes, reminders, a daily checklist, and recent files. TaskNotes is not required.

Maintainer: [Felix-Ashford](https://github.com/Felix-Ashford). [Report issues](https://github.com/Felix-Ashford/DaySprig/issues).

DaySprig is an independently maintained derivative, not an official TaskNotes release. The baseline is TaskNotes tag 3.25.4, commit [741ce165c9ee95b23a613d0edcd4bc842ee45979](https://github.com/callumalpass/tasknotes/tree/741ce165c9ee95b23a613d0edcd4bc842ee45979), by Callum Alpass. Most core task-management features originate upstream.

## Changes from upstream

- Includes calendar interaction, reminders, a Today list, a daily checklist, and recent files in one plugin.
- Calendar task clicks toggle completion; double-click edits; right-click cycles priority; Shift-right-click opens the original context menu; Ctrl/Cmd-click opens the task note. The original list-week behavior is retained.
- Invoking the calendar command opens the month view or closes the foreground calendar.
- Uses DaySprig branding, the daysprig plugin ID, customized default shortcuts and task colors.
- Stores task notes under \`DaySprig/Tasks\` and archived notes under \`DaySprig/Archive\` by default. Existing task properties such as status, priority, dates, recurrence, and completion records remain supported.
- Excludes the private dark PDF exporter. Desktop only.

The current implementation retains the full TaskNotes core, including optional time tracking, Pomodoro, ICS, API, Kanban, statistics, and Bases functionality. It is not a stripped-down reimplementation.

## Default shortcuts and colors

| Action | Windows/Linux | macOS |
| --- | --- | --- |
| Open/toggle DaySprig | Ctrl+Shift+R | Cmd+Shift+R |
| Open/toggle Today list | Ctrl+Shift+D | Cmd+Shift+D |
| Open/toggle recent files | Ctrl+Shift+Q | Cmd+Shift+Q |

Obsidian's saved custom hotkeys take precedence. Change or reset them in Settings > Hotkeys.

Priority colors: none #e2ffad, low #8ed29f, normal #ffdf9e, high #d53030. The completed status uses #0497c8. Colors remain editable in settings.

## Installation and compatibility

1. Download main.js, manifest.json and styles.css from a [DaySprig release](https://github.com/Felix-Ashford/DaySprig/releases).
2. Copy them into your vault's .obsidian/plugins/daysprig directory (or the equivalent directory under your custom configuration folder).
3. Enable DaySprig in Settings > Community plugins. Restart Obsidian if necessary.

DaySprig uses its own view identifiers and data keys. It should be enabled as the task calendar for the vault.

Tasks remain ordinary Markdown notes; no task conversion is required. DaySprig uses only its own settings and plugin data.

Version 0.1.0 is intended for initial testing. Manual Obsidian acceptance testing is performed by the maintainer. Automated tests currently cover a small set of data helpers; they do not establish visual or end-to-end parity. The declared minimum Obsidian version (1.5.0) still requires manual compatibility confirmation before a stable release or community submission.

## Data and optional integrations

Settings and checklist/reminder state are stored locally in the plugin's data.json; tasks are stored in vault notes. DaySprig retains optional upstream ICS subscriptions, exports, and an HTTP API/webhooks. The API and automatic export are disabled by default. Enabling external subscriptions or webhooks can send requests to the configured services. Do not publish your data.json, credentials, or personal vault content.

## Development and releases

Use Node.js 22 or later and the committed package-lock.json:

    npm ci
    npm run build
    npm test -- --runInBand
    npm run test:build

Production builds derive third-party notices from esbuild's actual bundle inputs and embed the full project and dependency notices in main.js. The generated THIRD-PARTY-NOTICES.md is committed for review. Unknown licenses or missing license texts fail the build.

    npm run release:package

This creates dist/daysprig with the three installable files plus license/source notices, and an ical.js source archive under dist. GitHub tag releases run the same checks and create a draft prerelease. Publish only after manual acceptance testing. Tag names must match manifest.json, package.json and versions.json (for example 0.1.0, without a v prefix).

Set OBSIDIAN_PLUGIN_PATH or the ignored .copy-files.local file to a test vault's daysprig plugin directory before using npm run dev. The script rejects destinations named tasknotes.

## License and attribution

DaySprig modifications are Copyright 2026 Felix-Ashford. The TaskNotes baseline is Copyright 2025 Callum Alpass. Both are provided under the [MIT license](LICENSE); see [NOTICE.md](NOTICE.md) for provenance.

Bundled dependencies retain their own terms in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). In particular, ical.js is MPL-2.0 and reflect-metadata is Apache-2.0; the DaySprig MIT license does not replace those terms. MPL source availability is documented in [THIRD-PARTY-SOURCE.md](THIRD-PARTY-SOURCE.md), and the corresponding unmodified ical.js source is included with release materials.
