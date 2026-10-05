# DaySprig 开源发布说明

项目地址：https://github.com/Felix-Ashford/DaySprig
维护者与修改部分版权署名：Felix-Ashford。

## 来源与许可证

DaySprig 基于 TaskNotes 3.25.4，具体提交为
741ce165c9ee95b23a613d0edcd4bc842ee45979。
主要任务管理与日历功能来自 Callum Alpass 的上游实现。
DaySprig 是独立的 Obsidian 任务日历插件，提供日历、提醒、每日清单和最近文件功能，
并调整名称、快捷键与配色。它不是 TaskNotes 官方版本。

MIT 允许复制、修改、发布和商用，但必须保留版权与许可全文。
LICENSE 保留 Copyright 2025 Callum Alpass，增加
Copyright 2026 Felix-Ashford。不要把整个项目称为从零原创。

依赖并非全部是 MIT。THIRD-PARTY-NOTICES.md 从实际构建内容生成，
包括完整的 MIT、BSD、ISC、Apache-2.0、MPL-2.0 等许可文本和声明。
其中 ical.js 对应源码由发布流程自动打包，随发行材料提供。
声明也嵌入 main.js，用户只复制安装文件仍能保留版权信息。

## 可复现构建

使用 Node.js 22 或更高版本。在只有 Git 提交文件的干净目录运行：

    npm ci
    npm run build
    npm test -- --runInBand
    npm run test:build
    npm run release:package

src/releaseNotes.ts 是需要提交的源文件。
包版本、manifest.json、versions.json 和发布标签必须一致。
使用不带 v 的标签，例如 0.1.0。

## 发布材料

上传 main.js、manifest.json、styles.css、LICENSE、NOTICE.md、
THIRD-PARTY-NOTICES.md、THIRD-PARTY-SOURCE.md，以及自动生成的
ical.js 对应源码压缩包。GitHub Actions 会建立草稿预发布版本；
维护者在 Obsidian 验收后决定是否公开该版本。

只上传 daysprig 仓库目录，不上传其父目录。
不提交 data.json、个人任务、密钥、node_modules、私有 PDF 插件或本地测试目录。
无需 npm 发布、额外著作权登记或申请 TaskNotes 原作者的 MIT 许可审批。

## 手工验收与社区申请

自动检查证明构建与部分辅助逻辑正确，不证明实际界面和功能完全一致。
实际 Obsidian 验收由维护者完成，首版建议保留预发布标记。
声明的最低 Obsidian 版本 1.5.0 尚需实测，再用于稳定版和社区申请。

DaySprig 使用自己的视图 ID 和数据键，只读取自己的设置和插件数据。
所有数据仍在本地笔记和插件配置内；可选 ICS、API、webhooks 行为见 README。
GitHub 仓库目前为私有，公开仓库和发布操作需要维护者单独进行。
