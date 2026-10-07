[简体中文](README.md)

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
