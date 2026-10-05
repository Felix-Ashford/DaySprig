import { App, Modal, setIcon } from "obsidian";
import TaskNotesPlugin from "../main";
import { Reminder } from "../types";
import { splitFrontmatterAndBody } from "../utils/helpers";

export abstract class TaskModal extends Modal {
	plugin: TaskNotesPlugin;
	protected title = "";
	protected details = "";
	protected originalDetails = "";
	protected dueDate = "";
	protected scheduledDate = "";
	protected priority = "normal";
	protected status = "open";
	protected contexts = "";
	protected projects = "";
	protected tags = "";
	protected timeEstimate = 0;
	protected recurrenceRule = "";
	protected reminders: Reminder[] = [];
	protected titleInput?: HTMLInputElement;
	protected isExpanded = false;

	constructor(app: App, plugin: TaskNotesPlugin) {
		super(app);
		this.plugin = plugin;
	}

	protected t(key: string, params?: Record<string, string | number>): string {
		return this.plugin.i18n.translate(key, params);
	}

	protected getCurrentTaskPath(): string | undefined { return undefined; }
	protected isEditMode(): boolean { return false; }
	protected isCreationMode(): boolean { return false; }
	abstract initializeFormData(): Promise<void>;
	abstract handleSave(): Promise<void>;
	abstract getModalTitle(): string;
	protected abstract createModalContent(): void;

	onOpen(): void {
		this.containerEl.addClass("tasknotes-plugin", "minimalist-task-modal");
		this.titleEl.setText(this.getModalTitle());
		const icon = this.titleEl.createSpan("modal-header-icon");
		setIcon(icon, "daysprig-simple");
		this.titleEl.insertBefore(icon, this.titleEl.firstChild);
		void this.initializeFormData().then(() => {
			this.createModalContent();
			this.focusTitleInput();
		});
	}

	protected extractDetailsFromContent(content: string): string {
		return this.normalizeDetails(splitFrontmatterAndBody(content).body);
	}

	protected normalizeDetails(value: string): string {
		return value.replace(/\r\n/g, "\n");
	}

	protected validateForm(): boolean { return this.title.trim().length > 0; }

	protected focusTitleInput(): void {
		setTimeout(() => this.titleInput?.focus(), 100);
	}

	protected createActionButtons(container: HTMLElement): void {
		const buttons = container.createDiv("button-container");
		const save = buttons.createEl("button", {
			cls: "save-button", text: this.t("modals.task.buttons.save"),
		});
		save.addEventListener("click", async () => {
			save.disabled = true;
			try {
				await this.handleSave();
			} finally {
				save.disabled = false;
			}
		});
		const cancel = buttons.createEl("button", {
			cls: "cancel-button", text: this.t("common.cancel"),
		});
		cancel.addEventListener("click", () => this.close());
	}
}
