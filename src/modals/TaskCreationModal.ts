import { App, Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskModal } from "./TaskModal";
import { TaskInfo, TaskCreationData } from "../types";
import { getCurrentTimestamp } from "../utils/dateUtils";
import { calculateDefaultDate, sanitizeTags } from "../utils/helpers";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";


export interface TaskCreationOptions {
	prePopulatedValues?: Partial<TaskInfo>;
	onTaskCreated?: (task: TaskInfo) => void;
	onClosed?: (saved: boolean) => void;
}

export class TaskCreationModal extends TaskModal {
	private options: TaskCreationOptions;
	private nlInput!: HTMLTextAreaElement;
	private saved = false;

	constructor(app: App, plugin: TaskNotesPlugin, options: TaskCreationOptions = {}) {
		super(app, plugin);
		this.options = options;
	}

	getModalTitle(): string {
		return this.t("modals.taskCreation.title");
	}

	protected isCreationMode(): boolean {
		return true;
	}

	protected createModalContent(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Create main container
		const container = contentEl.createDiv("minimalist-modal-container");

		// Always use the plain text task field. The first line is the title;
		// following lines are saved as the note body.
		this.createPlainTextInput(container);

		// Create save/cancel buttons
		this.createActionButtons(container);
	}

	private createPlainTextInput(container: HTMLElement): void {
		const nlContainer = container.createDiv("nl-input-container");

		// Create minimalist input field
		this.nlInput = nlContainer.createEl("textarea", {
			cls: "nl-input",
			attr: {
				placeholder: "",
				rows: "3",
			},
		});

		this.nlInput.value = [this.title, this.details].filter((value, index) => index === 0 || value).join("\n");

		// Event listeners
		this.nlInput.addEventListener("input", () => {
			this.syncPlainTextInput();
		});

		// Save the plain text title and details from the same text area.
		this.nlInput.addEventListener("keydown", (e) => {
			if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.ctrlKey || e.metaKey) {
				this.nlInput.setRangeText("\n", this.nlInput.selectionStart, this.nlInput.selectionEnd, "end");
				this.nlInput.dispatchEvent(new Event("input", { bubbles: true }));
			} else if (!e.repeat) {
				this.contentEl.querySelector<HTMLButtonElement>(".save-button")?.click();
			}
		});
		// Focus the input
		setTimeout(() => {
			this.nlInput.focus();
		}, 100);
	}

	private syncPlainTextInput(): void {
		if (!this.nlInput) return;
		const lines = this.nlInput.value.replace(/\r\n/g, "\n").split("\n");
		this.title = (lines.shift() || "").trim();
		this.details = lines.join("\n").trimEnd();
	}

	async initializeFormData(): Promise<void> {
		// Initialize with default values from settings
		this.priority = this.plugin.settings.defaultTaskPriority;
		this.status = this.plugin.settings.defaultTaskStatus;

		// Apply task creation defaults
		const defaults = this.plugin.settings.taskCreationDefaults;

		// Apply default due date
		this.dueDate = calculateDefaultDate(defaults.defaultDueDate);

		// Apply default scheduled date based on user settings
		this.scheduledDate = calculateDefaultDate(defaults.defaultScheduledDate);

		// Apply default contexts, tags, and projects
		this.contexts = defaults.defaultContexts || "";
		this.tags = defaults.defaultTags || "";

		this.projects = defaults.defaultProjects || "";

		// Apply default time estimate
		if (defaults.defaultTimeEstimate && defaults.defaultTimeEstimate > 0) {
			this.timeEstimate = defaults.defaultTimeEstimate;
		}

		// Apply default reminders
		if (defaults.defaultReminders && defaults.defaultReminders.length > 0) {
			// Import the conversion function
			const { convertDefaultRemindersToReminders } = await import("../utils/settingsUtils");
			this.reminders = convertDefaultRemindersToReminders(defaults.defaultReminders);
		}

		// Apply pre-populated values if provided (overrides defaults)
		if (this.options.prePopulatedValues) {
			this.applyPrePopulatedValues(this.options.prePopulatedValues);
		}

		this.details = this.normalizeDetails(this.details);
		this.originalDetails = this.details;
	}

	private applyPrePopulatedValues(values: Partial<TaskInfo>): void {
		if (values.title !== undefined) this.title = values.title;
		if (values.due !== undefined) this.dueDate = values.due;
		if (values.scheduled !== undefined) this.scheduledDate = values.scheduled;
		if (values.priority !== undefined) this.priority = values.priority;
		if (values.status !== undefined) this.status = values.status;
		if (values.contexts !== undefined) {
			this.contexts = values.contexts.join(", ");
		}
		if (values.details !== undefined) this.details = values.details;
		if (values.reminders !== undefined) this.reminders = [...values.reminders];
		if (values.projects !== undefined) this.projects = values.projects.join(", ");
		if (values.tags !== undefined) {
			this.tags = sanitizeTags(
				values.tags.filter((tag) => tag !== this.plugin.settings.taskTag).join(", ")
			);
		}
		if (values.timeEstimate !== undefined) this.timeEstimate = values.timeEstimate;
		if (values.recurrence !== undefined && typeof values.recurrence === "string") {
			this.recurrenceRule = values.recurrence;
		}
	}

	async handleSave(): Promise<void> {
		this.syncPlainTextInput();

		if (!this.validateForm()) {
			new Notice(this.t("modals.taskCreation.notices.titleRequired"));
			return;
		}

		try {
			const taskData = this.buildTaskData();
			const result = await this.plugin.taskService.createTask(taskData);
			const createdTask = result.taskInfo;
			this.saved = true;

			// Check if filename was changed due to length constraints
			const expectedFilename = result.taskInfo.title.replace(/[<>:"/\\|?*]/g, "").trim();
			const actualFilename = result.file.basename;

			if (actualFilename.startsWith("task-") && actualFilename !== expectedFilename) {
				new Notice(
					this.t("modals.taskCreation.notices.successShortened", {
						title: createdTask.title,
					})
				);
			} else {
				new Notice(
					this.t("modals.taskCreation.notices.success", { title: createdTask.title })
				);
			}

			if (this.options.onTaskCreated) {
				this.options.onTaskCreated(createdTask);
			}

			this.close();
		} catch (error) {
			console.error("Failed to create task:", error);
			const message = error instanceof Error && error.message ? error.message : String(error);
			new Notice(this.t("modals.taskCreation.notices.failure", { message }));
		}
	}

	onClose(): void {
		this.contentEl.empty();
		this.options.onClosed?.(this.saved);
	}

	private buildTaskData(): Partial<TaskInfo> {
		const now = getCurrentTimestamp();

		// Parse contexts, projects, and tags
		const contextList = this.contexts
			.split(",")
			.map((c) => c.trim())
			.filter((c) => c.length > 0);

		const projectList = splitListPreservingLinksAndQuotes(this.projects);
		const tagList = sanitizeTags(this.tags)
			.split(",")
			.map((t) => t.trim())
			.filter((t) => t.length > 0);

		// Add the task tag if it's not already present
		if (this.plugin.settings.taskTag && !tagList.includes(this.plugin.settings.taskTag)) {
			tagList.push(this.plugin.settings.taskTag);
		}

		const taskData: TaskCreationData = {
			title: this.title.trim(),
			due: this.dueDate || undefined,
			scheduled: this.scheduledDate || undefined,
			priority: this.priority,
			status: this.status,
			contexts: contextList.length > 0 ? contextList : undefined,
			projects: projectList.length > 0 ? projectList : undefined,
			tags: tagList.length > 0 ? tagList : undefined,
			timeEstimate: this.timeEstimate > 0 ? this.timeEstimate : undefined,
			recurrence: this.recurrenceRule || undefined,
			reminders: this.reminders.length > 0 ? this.reminders : undefined,
			creationContext: "manual-creation", // Mark as manual creation for folder logic
			dateCreated: now,
			dateModified: now,
		};

		// Add details if provided
		const normalizedDetails = this.normalizeDetails(this.details).trimEnd();
		if (normalizedDetails.length > 0) {
			taskData.details = normalizedDetails;
		}

		return taskData;
	}

}
