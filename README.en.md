[简体中文](README.md)

# DaySprig

DaySprig is a standalone desktop task calendar for Obsidian. It provides a focused calendar, task notes, reminders, a daily checklist, and recent files. TaskNotes is not required.

Maintainer: [Felix-Ashford](https://github.com/Felix-Ashford). [Report issues](https://github.com/Felix-Ashford/DaySprig/issues).

DaySprig is an independently maintained derivative, not an official TaskNotes release. The baseline is TaskNotes tag 3.25.4, commit [741ce165c9ee95b23a613d0edcd4bc842ee45979](https://github.com/callumalpass/tasknotes/tree/741ce165c9ee95b23a613d0edcd4bc842ee45979), by Callum Alpass. Most core task-management features originate upstream.

## Changes from upstream

- Includes calendar interaction, reminders, a Today list, a daily checklist, and recent files in one plugin.
- Calendar task clicks toggle completion; double-click edits; right-click cycles priority; Shift-right-click deletes the task immediately without confirmation; Ctrl/Cmd-click opens the task note. The original list-week behavior is retained.
- Invoking the calendar command opens the month view or closes the foreground calendar.
- Uses DaySprig branding, the daysprig plugin ID, customized default shortcuts and task colors.
- Stores task notes under \`DaySprig/Tasks\` and archived notes under \`DaySprig/Archive\` by default. Existing task properties such as status, priority, dates, recurrence, and completion records remain supported.
- Excludes the private dark PDF exporter. Desktop only.

DaySprig retains the calendar, task notes, reminders, recurring tasks, daily checklist, and recent files. ICS calendar subscriptions and export, HTTP API/webhooks, Pomodoro, standalone statistics, Kanban, the standalone Agenda view, and Bases integration have been removed from the code, service initialization, settings, and dependencies. Task time tracking is retained: starting and stopping a timer records the time spent on a task and its total tracked duration. This is separate from the removed Pomodoro timer.

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

## Local data

Settings and checklist/reminder state are stored locally in the plugin's data.json; tasks and time entries are stored in vault notes. Removed ICS, API, and webhook settings are no longer read or executed. Do not publish your data.json or personal vault content.

## Development and releases

Use Node.js 22 or later and the committed package-lock.json:

    npm ci
    npm run build
    npm test -- --runInBand
    npm run test:build

Production builds derive third-party notices from esbuild's actual bundle inputs and embed the full project and dependency notices in main.js. The generated THIRD-PARTY-NOTICES.md is committed for review. Unknown licenses or missing license texts fail the build.

    npm run release:package

This creates dist/daysprig with the three installable files and license notices. GitHub tag releases run the same checks and create a draft prerelease. Publish only after manual acceptance testing. Tag names must match manifest.json, package.json and versions.json (for example 0.1.0, without a v prefix).

Set OBSIDIAN_PLUGIN_PATH or the ignored .copy-files.local file to a test vault's daysprig plugin directory before using npm run dev. The script rejects destinations named tasknotes.

## License and attribution

DaySprig modifications are Copyright 2026 Felix-Ashford. The TaskNotes baseline is Copyright 2025 Callum Alpass. Both are provided under the [MIT license](LICENSE); see [NOTICE.md](NOTICE.md) for provenance.

Bundled dependencies retain their own terms in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
