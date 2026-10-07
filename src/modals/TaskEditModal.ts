/* eslint-disable no-console */
import { App, Notice, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskModal } from "./TaskModal";
import { TaskInfo } from "../types";
import {
	getCurrentTimestamp,
} from "../utils/dateUtils";
import { extractTaskInfo } from "../utils/helpers";

export interface TaskEditOptions {
	task: TaskInfo;
	onTaskUpdated?: (task: TaskInfo) => void;
}

export class TaskEditModal extends TaskModal {
	private task: TaskInfo;
	private options: TaskEditOptions;
	private saveSucceeded = false;

	constructor(app: App, plugin: TaskNotesPlugin, options: TaskEditOptions) {
		super(app, plugin);
		this.task = options.task;
		this.options = options;
	}

	protected getCurrentTaskPath(): string | undefined {
		return this.task.path;
	}

	getModalTitle(): string {
		return this.t("modals.taskEdit.title");
	}

	protected isEditMode(): boolean {
		return true;
	}

	async initializeFormData(): Promise<void> {
		this.title = this.task.title;
		this.priority = this.task.priority || this.plugin.settings.defaultTaskPriority;
		this.details = this.normalizeDetails(this.task.details || this.details);
		this.originalDetails = this.details;
	}

	async onOpen(): Promise<void> {
		await this.refreshTaskData();
		super.onOpen();
	}

	private async refreshTaskData(): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(this.task.path);
			if (!file || !(file instanceof TFile)) {
				console.warn("Could not find file for task:", this.task.path);
				return;
			}

			const content = await this.app.vault.read(file);
			this.details = this.extractDetailsFromContent(content);
			this.originalDetails = this.details;

			const cachedTaskInfo = await this.plugin.cacheManager.getTaskInfo(this.task.path);

			if (cachedTaskInfo) {
				cachedTaskInfo.details = this.details;
				this.task = cachedTaskInfo;
				this.options.task = cachedTaskInfo;
			} else {
				const freshTaskInfo = extractTaskInfo(
					this.app,
					content,
					this.task.path,
					file,
					this.plugin.fieldMapper,
					this.plugin.settings.storeTitleInFilename
				);

				if (freshTaskInfo) {
					freshTaskInfo.details = this.details;
					this.task = freshTaskInfo;
					this.options.task = freshTaskInfo;
				}
			}
		} catch (error) {
			console.warn("Could not refresh task data:", error);
		}
	}

	protected createModalContent(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Create main container
		const container = contentEl.createDiv("minimalist-modal-container");

		const textInput = container.createEl("textarea", {
			cls: "nl-input",
			attr: { rows: "3", placeholder: "" },
		});
		textInput.value = [this.title, this.details].filter((value, index) => index === 0 || value).join("\n");
		textInput.addEventListener("input", () => {
			const lines = textInput.value.replace(/\r\n/g, "\n").split("\n");
			this.title = (lines.shift() || "").trim();
			this.details = lines.join("\n").trimEnd();
		});
		textInput.addEventListener("keydown", (e) => {
			if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.ctrlKey || e.metaKey) {
				textInput.setRangeText("\n", textInput.selectionStart, textInput.selectionEnd, "end");
				textInput.dispatchEvent(new Event("input", { bubbles: true }));
			} else if (!e.repeat) {
				this.contentEl.querySelector<HTMLButtonElement>(".save-button")?.click();
			}
		});
		this.titleInput = textInput as unknown as HTMLInputElement;
		setTimeout(() => textInput.focus(), 100);

		// Create save/cancel buttons
		this.createActionButtons(container);
	}

	async handleSave(): Promise<void> {
		this.saveSucceeded = false;
		if (!this.validateForm()) {
			new Notice(this.t("modals.taskEdit.notices.titleRequired"));
			return;
		}

		try {
			const changes = this.getChanges();
			const hasTaskChanges = Object.keys(changes).length > 0;

			if (!hasTaskChanges) {
				new Notice(this.t("modals.taskEdit.notices.noChanges"));
				this.saveSucceeded = true;
				return;
			}

			const updatedTask = await this.plugin.taskService.updateTask(this.task, changes);
			this.task = updatedTask;
			this.details = this.normalizeDetails(this.details);
			this.originalDetails = this.details;

			if (this.options.onTaskUpdated) {
				this.options.onTaskUpdated(updatedTask);
			}

			new Notice(this.t("modals.taskEdit.notices.updateSuccess", { title: updatedTask.title }));
			this.saveSucceeded = true;
		} catch (error) {
			console.error("Failed to update task:", error);
			const message = error instanceof Error && error.message ? error.message : String(error);
			new Notice(this.t("modals.taskEdit.notices.updateFailure", { message }));
			return;
		}
	}

	private getChanges(): Partial<TaskInfo> {
		const changes: Partial<TaskInfo> = {};

		// Check for changes and only include modified fields
		if (this.title.trim() !== this.task.title) {
			changes.title = this.title.trim();
		}

		const normalizedDetails = this.normalizeDetails(this.details);
		const normalizedOriginal = this.normalizeDetails(this.originalDetails);
		if (normalizedDetails !== normalizedOriginal) {
			changes.details = normalizedDetails;
		}
		if (this.priority !== (this.task.priority || this.plugin.settings.defaultTaskPriority)) {
			changes.priority = this.priority;
		}

		// Always update modified timestamp if there are changes
		if (Object.keys(changes).length > 0) {
			changes.dateModified = getCurrentTimestamp();
		}

		return changes;
	}

	private async openTaskNote(): Promise<void> {
		try {
			// Get the file from the task path
			const file = this.app.vault.getAbstractFileByPath(this.task.path);

			if (!file) {
				new Notice(this.t("modals.taskEdit.notices.fileMissing", { path: this.task.path }));
				return;
			}

			// Open the file in a new leaf
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.openFile(file as TFile);

			// Close the modal
			this.close();
		} catch (error) {
			console.error("Failed to open task note:", error);
			new Notice(this.t("modals.taskEdit.notices.openNoteFailure"));
		}
	}

	private async archiveTask(): Promise<void> {
		try {
			const updatedTask = await this.plugin.taskService.toggleArchive(this.task);

			// Update the task reference
			this.task = updatedTask;

			// Notify parent component if callback exists
			if (this.options.onTaskUpdated) {
				this.options.onTaskUpdated(updatedTask);
			}

			// Show success message
			const actionKey = updatedTask.archived
				? "modals.taskEdit.archiveAction.archived"
				: "modals.taskEdit.archiveAction.unarchived";
			const actionText = this.t(actionKey);
			new Notice(this.t("modals.taskEdit.notices.archiveSuccess", { action: actionText }));

			// Close the modal
			this.close();
		} catch (error) {
			console.error("Failed to archive task:", error);
			new Notice(this.t("modals.taskEdit.notices.archiveFailure"));
		}
	}

	protected createActionButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv("button-container");

		// Add "Open note" button
		const openNoteButton = buttonContainer.createEl("button", {
			cls: "open-note-button",
			text: this.t("modals.task.buttons.openNote"),
		});

		openNoteButton.addEventListener("click", async () => {
			await this.openTaskNote();
		});

		// Add "Archive" button
		const archiveButton = buttonContainer.createEl("button", {
			cls: "archive-button",
			text: this.task.archived
				? this.t("modals.taskEdit.buttons.unarchive")
				: this.t("modals.taskEdit.buttons.archive"),
		});

		archiveButton.addEventListener("click", async () => {
			await this.archiveTask();
		});

		// Spacer to push Save/Cancel to the right
		buttonContainer.createDiv("button-spacer");

		// Save button
		const saveButton = buttonContainer.createEl("button", {
			cls: "save-button",
			text: this.t("modals.task.buttons.save"),
		});

		saveButton.addEventListener("click", async () => {
			saveButton.disabled = true;
			try {
				await this.handleSave();
				if (this.saveSucceeded) this.close();
			} finally {
				saveButton.disabled = false;
			}
		});

		// Cancel button
		const cancelButton = buttonContainer.createEl("button", {
			cls: "cancel-button",
			text: this.t("common.cancel"),
		});

		cancelButton.addEventListener("click", () => {
			this.close();
		});
	}

	// Start expanded for edit modal - override parent property
	protected isExpanded = true;
}
