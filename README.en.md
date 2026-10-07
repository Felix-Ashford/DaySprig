[简体中文](README.md)

# DaySprig

DaySprig is a desktop task calendar for Obsidian. The default interface is Chinese, and English is available from the plugin language setting. It combines the calendar, task notes, reminders, a daily checklist, and recent files. TaskNotes is not required.

[中文说明](README.md)

## Screenshots

### Calendar and task editor

The calendar is the main DaySprig view. Tasks are placed on planned or due dates, with colors indicating importance. Double-click edits a task; clicking an empty date can create that day's note when enabled in settings.

![DaySprig calendar](docs/readme-images/calendar-en.png)

The create and edit windows use the same plain-text layout: the first line is the task title and later lines are details. Press Enter to save. After saving a new task, press Enter again on the calendar to open another task for the same day. Existing content is shown unchanged in the edit window.

![DaySprig task editor](docs/readme-images/task-editor-en.png)

### Today list, recent files, and settings

Ctrl/Cmd+Shift+D opens the Today list, grouped into overdue, scheduled today, due today, and completed tasks. Ctrl/Cmd+Shift+Q opens Recent files and Favorites, with search, ordering, rename, internal-link copy, and trash actions. Settings cover language, task and archive folders, calendar behavior, priority colors, and active shortcuts.

![DaySprig companion windows](docs/readme-images/companion-en.png)

![DaySprig settings](docs/readme-images/settings-en.png)

DaySprig also works with Obsidian themes:

![DaySprig with the Obsidian Nord theme](docs/readme-images/nord-calendar.png)

![DaySprig task editor with the Obsidian Nord theme](docs/readme-images/nord-task-editor.png)

![DaySprig companion window with the Obsidian Nord theme](docs/readme-images/nord-companion.png)

## Features

- Monthly calendar for planned dates, due dates, recurring tasks, and importance.
- Task actions: left-click toggles completion, double-click edits, right-click cycles importance, Shift-right-click deletes immediately, and Ctrl/Cmd-click opens the note in a new tab.
- Task creation: clicking an empty date creates a note when enabled; the create window supports a title, details, and importance.
- Continuous creation: after Enter saves a new task, pressing Enter again opens another task for the same day.
- Task editing: Enter saves the edit window and cannot accidentally open a new create window; content is edited as ordinary text.
- Reminders for high-importance or overdue tasks, with postpone, complete, and floating-card actions.
- Today list and Recent files/Favorites support live language refresh when the locale changes.
- Localized interface: 中文, English, Français, Deutsch, Español, 日本語, and Русский.
- Configurable storage: task notes default to DaySprig/Tasks and archived notes to DaySprig/Archive.

ICS subscriptions and export, HTTP API/Webhooks, Pomodoro, standalone statistics, Kanban, the standalone Agenda view, Bases integration, and time tracking are not exposed by this focused version.

## Default shortcuts

| Action | Windows/Linux | macOS |
| --- | --- | --- |
| Open/toggle DaySprig | Ctrl+Shift+R | Cmd+Shift+R |
| Open/close Today list | Ctrl+Shift+D | Cmd+Shift+D |
| Open/close recent files | Ctrl+Shift+Q | Cmd+Shift+Q |

Change these in Obsidian under Settings → Hotkeys. The settings page keeps only shortcuts used by the current version.

## Installation

1. Download main.js, manifest.json, and styles.css from a [DaySprig release](https://github.com/Felix-Ashford/DaySprig/releases).
2. Copy them into .obsidian/plugins/daysprig in your vault.
3. Enable DaySprig under Obsidian Settings → Community plugins.
4. Confirm the task folder, archive folder, language, and calendar behavior in DaySprig settings.

Tasks remain ordinary Markdown notes; no conversion is required. Back up your vault and try the configuration in a test vault before changing storage folders.

## Local data

Plugin settings, reminder state, and daily checklist data are stored in the plugin's data.json. Tasks and task fields remain in vault notes. Do not publish personal vault content or data.json.

## Development and releases

Node.js 22 or later is required. Common checks are npm ci, npm run build, npm test -- --runInBand, and npm run test:build. Create a release package with npm run release:package.

Before publishing, manually test the calendar, task creation and editing, deletion, shortcuts, language switching, and file actions in Obsidian.

## License and attribution

DaySprig modifications are Copyright 2026 Felix-Ashford. The TaskNotes baseline is Copyright 2025 Callum Alpass. Both are provided under the [MIT license](LICENSE). See [NOTICE.md](NOTICE.md) for provenance and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for dependency licenses.
