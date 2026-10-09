# DaySprig

DaySprig 是一款面向 Obsidian 的桌面任务日历插件，它把日历、任务笔记、提醒、每日清单和最近文件集中在一个轻量工作流中。

[English](README.en.md)


## 插件界面速览
DaySprig 推荐搭配主题 “[Obsidian Nord](https://github.com/insanum/obsidian_nord)” 获得更佳的外观效果：



<p align="center">
  <img
    src="docs/readme-images/nord-calendar.png"
    alt="DaySprig 搭配 Obsidian Nord 外观"
    width="48%"
  >
  <img
    src="docs/readme-images/nord-task-editor.png"
    alt="DaySprig Nord 外观下的任务编辑"
    width="48%"
  >
    <img
    src="docs/readme-images/nord-companion.png"
    alt="DaySprig Nord 外观下的伴生窗口"
    width="48%"
  >
    <img
    src="docs/readme-images/tmp9587.png"
    alt="alt text"
    width="48%"
  >
</p>



## 插件核心功能

### 日历与任务编辑

日历是 DaySprig 的主界面。默认通过快捷键“ctrl+shift+R”打开/关闭。

左键单击任务：切换任务完成状态

右键单击任务：切换任务重要度

shift+右键任务：删除

左键双击任务：编辑任务

![DaySprig 中文日历界面](docs/readme-images/settings-zh.png)

![alt text](docs/readme-images/tmp19A1.png)

左键单击在该日创建任务：

![alt text](docs/readme-images/tmp1894.png)


### 今日任务清单

Ctrl+Shift+D 打开今日任务清单，支持添加每日任务。

按每日任务、过期任务、今日计划分组显示。

![DaySprig 中文伴生窗口](docs/readme-images/companion-zh.png)


### 最近打开文件与常用文件

Ctrl+Shift+Q 打开最近文件和常用文件界面。


![DaySprig 中文任务编辑界面](docs/readme-images/task-editor-zh.png)


### 过期任务提醒
未完成任务过期自动提醒。

![DaySprig 设置界面](docs/readme-images/calendar-zh.png)



## 默认快捷键

| 操作 | Windows/Linux | macOS |
| --- | --- | --- |
| 打开/切换 DaySprig | Ctrl+Shift+R | Cmd+Shift+R |
| 打开/关闭今日任务清单 | Ctrl+Shift+D | Cmd+Shift+D |
| 打开/关闭最近文件 | Ctrl+Shift+Q | Cmd+Shift+Q |

快捷键可以在 Obsidian 的“设置 → 快捷键”中修改。



## 安装

1. 从 [DaySprig Releases](https://github.com/Felix-Ashford/DaySprig/releases) 下载安装包 `daysprig-版本号.zip`（例如 `daysprig-0.1.0.zip`）。请选择 Release 附件中的安装包；GitHub 自动提供的 “Source code (zip)” 是源码包。
2. 解压后会得到 `daysprig` 文件夹，将整个文件夹复制到 vault 的 `.obsidian/plugins/` 目录（使用自定义配置目录时，请放入对应的 `plugins/` 目录）。最终应能找到 `.obsidian/plugins/daysprig/manifest.json`、`main.js` 和 `styles.css`；避免多嵌套一层 `daysprig` 文件夹。
3. 重新加载或重启 Obsidian，然后在“设置 → 社区插件”中启用 DaySprig。
4. 在 DaySprig 设置中确认任务目录、归档目录、语言和日历行为。

手动更新时，用新版安装包中的文件覆盖已有插件文件，保留原目录中的 `data.json`，以保留个人设置和清单数据。

上架 Obsidian 社区插件市场后，还可以在“设置 → 社区插件 → 浏览”中搜索 DaySprig 并直接安装。目前此方式仍待完成上架审核。


## 本地数据

插件设置、提醒状态和每日清单保存在插件自己的 data.json 中；任务和时间字段保存在 vault 笔记内。不要将个人 vault 内容或 data.json 上传到公开仓库。

## 开发与发布

需要 Node.js 22 或更高版本。常用检查命令：npm ci、npm run build、npm test -- --runInBand、npm run test:build。发布打包使用 npm run release:package。


## 许可证与致谢

Daysprig 基于obsidiam插件 [TaskNotes](https://github.com/callumalpass/tasknotes) 制作。

DaySprig 的修改部分版权归 Felix-Ashford 所有，TaskNotes 基线版权归 Callum Alpass 所有；项目采用 [MIT License](LICENSE)。来源说明见 [NOTICE.md](NOTICE.md)，依赖许可见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
