// import { TAbstractFile } from 'obsidian';
import { Setting } from "obsidian";
import TaskNotesPlugin from "../../main";
import {
	createSectionHeader,
	createTextSetting,
	createToggleSetting,
	createDropdownSetting,
	createHelpText,
} from "../components/settingHelpers";
import { TranslationKey } from "../../i18n";

/**
 * Renders the General tab - foundational settings for task identification and storage
 */
export function renderGeneralTab(
	container: HTMLElement,
	plugin: TaskNotesPlugin,
	save: () => void
): void {
	container.empty();

	const translate = (key: TranslationKey, params?: Record<string, string | number>) =>
		plugin.i18n.translate(key, params);

	// Tasks Storage Section
	createSectionHeader(container, translate("settings.general.taskStorage.header"));
	createHelpText(container, translate("settings.general.taskStorage.description"));

	createTextSetting(container, {
		name: translate("settings.general.taskStorage.defaultFolder.name"),
		desc: translate("settings.general.taskStorage.defaultFolder.description"),
		placeholder: "DaySprig/Tasks",
		getValue: () => plugin.settings.tasksFolder,
		setValue: async (value: string) => {
			plugin.settings.tasksFolder = value;
			save();
		},
		ariaLabel: "Default folder path for new tasks",
	});

	createToggleSetting(container, {
		name: translate("settings.general.taskStorage.moveArchived.name"),
		desc: translate("settings.general.taskStorage.moveArchived.description"),
		getValue: () => plugin.settings.moveArchivedTasks,
		setValue: async (value: boolean) => {
			plugin.settings.moveArchivedTasks = value;
			save();
			// Re-render to show/hide archive folder setting
			renderGeneralTab(container, plugin, save);
		},
	});

	if (plugin.settings.moveArchivedTasks) {
		createTextSetting(container, {
			name: translate("settings.general.taskStorage.archiveFolder.name"),
			desc: translate("settings.general.taskStorage.archiveFolder.description"),
			placeholder: "DaySprig/Archive",
			getValue: () => plugin.settings.archiveFolder,
			setValue: async (value: string) => {
				plugin.settings.archiveFolder = value;
				save();
			},
			ariaLabel: "Archive folder path",
		});
	}

	// Task Identification Section
	createSectionHeader(container, translate("settings.general.taskIdentification.header"));
	createHelpText(container, translate("settings.general.taskIdentification.description"));

	createDropdownSetting(container, {
		name: translate("settings.general.taskIdentification.identifyBy.name"),
		desc: translate("settings.general.taskIdentification.identifyBy.description"),
		options: [
			{
				value: "tag",
				label: translate("settings.general.taskIdentification.identifyBy.options.tag"),
			},
			{
				value: "property",
				label: translate("settings.general.taskIdentification.identifyBy.options.property"),
			},
		],
		getValue: () => plugin.settings.taskIdentificationMethod,
		setValue: async (value: string) => {
			plugin.settings.taskIdentificationMethod = value as "tag" | "property";
			save();
			// Re-render to show/hide conditional fields
			renderGeneralTab(container, plugin, save);
		},
		ariaLabel: "Task identification method",
	});

	if (plugin.settings.taskIdentificationMethod === "tag") {
		createTextSetting(container, {
			name: translate("settings.general.taskIdentification.taskTag.name"),
			desc: translate("settings.general.taskIdentification.taskTag.description"),
			placeholder: "task",
			getValue: () => plugin.settings.taskTag,
			setValue: async (value: string) => {
				plugin.settings.taskTag = value;
				save();
			},
			ariaLabel: "Task identification tag",
		});

		createToggleSetting(container, {
			name: translate("settings.general.taskIdentification.hideIdentifyingTags.name"),
			desc: translate("settings.general.taskIdentification.hideIdentifyingTags.description"),
			getValue: () => plugin.settings.hideIdentifyingTagsInCards,
			setValue: async (value: boolean) => {
				plugin.settings.hideIdentifyingTagsInCards = value;
				save();
			},
		});
	} else {
		createTextSetting(container, {
			name: translate("settings.general.taskIdentification.taskProperty.name"),
			desc: translate("settings.general.taskIdentification.taskProperty.description"),
			placeholder: "category",
			getValue: () => plugin.settings.taskPropertyName,
			setValue: async (value: string) => {
				plugin.settings.taskPropertyName = value;
				save();
			},
		});

		createTextSetting(container, {
			name: translate("settings.general.taskIdentification.taskPropertyValue.name"),
			desc: translate("settings.general.taskIdentification.taskPropertyValue.description"),
			placeholder: "task",
			getValue: () => plugin.settings.taskPropertyValue,
			setValue: async (value: string) => {
				plugin.settings.taskPropertyValue = value;
				save();
			},
		});
	}

	// Folder Management Section
	createSectionHeader(container, translate("settings.general.folderManagement.header"));

	createTextSetting(container, {
		name: translate("settings.general.folderManagement.excludedFolders.name"),
		desc: translate("settings.general.folderManagement.excludedFolders.description"),
		placeholder: "Templates, Archive",
		getValue: () => plugin.settings.excludedFolders,
		setValue: async (value: string) => {
			plugin.settings.excludedFolders = value;
			save();
		},
		ariaLabel: "Excluded folder paths",
	});

	// UI Language Section
	createSectionHeader(container, translate("settings.features.uiLanguage.header"));
	createHelpText(container, translate("settings.features.uiLanguage.description"));

	const uiLanguageOptions = (() => {
		const options: Array<{ value: string; label: string }> = [
			{ value: "system", label: translate("common.systemDefault") },
		];
		for (const code of plugin.i18n.getAvailableLocales()) {
			// Use native language names (endonyms) for better UX
			const label = plugin.i18n.getNativeLanguageName(code);
			options.push({ value: code, label });
		}
		return options;
	})();

	createDropdownSetting(container, {
		name: translate("settings.features.uiLanguage.dropdown.name"),
		desc: translate("settings.features.uiLanguage.dropdown.description"),
		options: uiLanguageOptions,
		getValue: () => plugin.settings.uiLanguage ?? "system",
		setValue: async (value: string) => {
			plugin.settings.uiLanguage = value;
			plugin.i18n.setLocale(value);
			save();
			renderGeneralTab(container, plugin, save);
		},
	});

	// Frontmatter Section - only show if user has markdown links enabled globally
	const useMarkdownLinks = plugin.app.vault.getConfig('useMarkdownLinks');
	if (useMarkdownLinks) {
		createSectionHeader(container, translate("settings.general.frontmatter.header"));
		createHelpText(container, translate("settings.general.frontmatter.description"));

		createToggleSetting(container, {
			name: translate("settings.general.frontmatter.useMarkdownLinks.name"),
			desc: translate("settings.general.frontmatter.useMarkdownLinks.description"),
			getValue: () => plugin.settings.useFrontmatterMarkdownLinks,
			setValue: async (value: boolean) => {
				plugin.settings.useFrontmatterMarkdownLinks = value;
				save();
			},
		});
	}

	// Calendar date click behavior
	createSectionHeader(container, translate("settings.general.dailyNotes.header"));
	createToggleSetting(container, {
		name: translate("settings.general.dailyNotes.enable.name"),
		desc: translate("settings.general.dailyNotes.enable.description"),
		getValue: () => plugin.settings.openDailyNoteOnDateClick,
		setValue: async (value: boolean) => {
			plugin.settings.openDailyNoteOnDateClick = value;
			save();
			renderGeneralTab(container, plugin, save);
		},
	});
	if (plugin.settings.openDailyNoteOnDateClick) {
		createTextSetting(container, {
			name: translate("settings.general.dailyNotes.folder.name"),
			desc: translate("settings.general.dailyNotes.folder.description"),
			placeholder: "留空表示根目录",
			getValue: () => plugin.settings.dailyNoteFolder,
			setValue: async (value: string) => {
				plugin.settings.dailyNoteFolder = value.trim().replace(/^\/+|\/+$/g, "");
				save();
			},
			ariaLabel: "Daily note folder",
		});
	}

	// Show the live bindings from Obsidian so user customizations are reflected.
	createSectionHeader(container, translate("settings.general.shortcuts.header"));
	createHelpText(container, translate("settings.general.shortcuts.description"));
	[
		["open-advanced-calendar-view", translate("settings.general.shortcuts.calendar")],
		["open-today-task-list", translate("settings.general.shortcuts.today")],
		["open-recent-files", translate("settings.general.shortcuts.recent")],
	].forEach(([commandId, label]) => {
		const hotkeys = getCommandHotkeys(plugin, commandId);
		new Setting(container).setName(label).setDesc(formatHotkeys(hotkeys));
	});

	// Release Notes Section
	createSectionHeader(container, translate("settings.general.releaseNotes.header"));
	createHelpText(container, translate("settings.general.releaseNotes.description", { version: plugin.manifest.version }));

	createToggleSetting(container, {
		name: translate("settings.general.releaseNotes.showOnUpdate.name"),
		desc: translate("settings.general.releaseNotes.showOnUpdate.description"),
		getValue: () => plugin.settings.showReleaseNotesOnUpdate ?? true,
		setValue: async (value: boolean) => {
			plugin.settings.showReleaseNotesOnUpdate = value;
			save();
		},
	});

	new Setting(container)
		.setName(translate("settings.general.releaseNotes.viewButton.name"))
		.setDesc(translate("settings.general.releaseNotes.viewButton.description"))
		.addButton((button) =>
			button
				.setButtonText(translate("settings.general.releaseNotes.viewButton.buttonText"))
				.setCta()
				.onClick(async () => {
					await plugin.activateReleaseNotesView();
				})
		);
}

function getCommandHotkeys(plugin: TaskNotesPlugin, commandId: string): Array<{ modifiers?: string[]; key?: string }> {
	const commands = (plugin.app.commands as any)?.commands as Record<string, any> | undefined;
	if (!commands) return [];
	const fullId = Object.keys(commands).find((id) =>
		id === plugin.manifest.id + ":" + commandId || id.endsWith(":" + commandId)
	);
	if (!fullId) return [];
	const manager = (plugin.app as any).hotkeyManager;
	if (manager) {
		const getCurrent = manager.getHotkeysForCommand || manager.getHotkeys;
		if (typeof getCurrent === "function") {
			const configured = getCurrent.call(manager, fullId);
			if (Array.isArray(configured)) return configured;
		}
	}
	return Array.isArray(commands[fullId]?.hotkeys) ? commands[fullId].hotkeys : [];
}

function formatHotkeys(hotkeys: Array<{ modifiers?: string[]; key?: string }>): string {
	if (hotkeys.length === 0) return "Unassigned";
	const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || "");
	return hotkeys.map((hotkey) => {
		const modifiers = (hotkey.modifiers || []).map((modifier) => {
			if (modifier === "Mod") return isMac ? "Cmd" : "Ctrl";
			if (modifier === "Alt") return isMac ? "Option" : "Alt";
			return modifier;
		});
		const key = hotkey.key ? hotkey.key.toUpperCase() : "";
		return [...modifiers, key].filter(Boolean).join("+");
	}).join(" / ");
}
