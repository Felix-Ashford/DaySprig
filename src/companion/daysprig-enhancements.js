/*
 * DaySprig
 * 伴生插件：不修改 TaskNotes 本体文件。两部分功能：
 *
 * 一、高级日历交互改造：
 *   - 左键任务        切换完成/未完成（循环任务按所点击的日期实例切换）
 *   - 右键任务        优先级循环：低→中→高→低；无/未知优先级第一次右键变"低"
 *                     Shift+右键 = TaskNotes 原右键菜单
 *   - 双击任务        打开任务编辑弹窗（原左键功能）
 *   - Ctrl/Cmd+左键   新标签页打开任务笔记（保留原行为）
 *   - 呼出命令        强制切回月视图（dayGridMonth）；再次呼出 = 关闭面板（toggle）
 *   - 左键空白日期     新建任务（TaskNotes 原生行为，未改动）
 *   - 一次性迁移       修复 customPriorities 中 value 为空的损坏条目 → 无/低/中/高 四档
 *
 * 二、任务提醒（统一模型：激活 = (高优先级 || 过期) && 未完成）：
 *   - 变为"高"优先级自动开启当日提醒（提醒日 = 计划日期优先，无则截止日）
 *   - 过期任务（未完成、非循环、scheduled/due 早于今天）自动纳入提醒
 *   - 提醒日当天弹窗（错过则下次打开补弹）；弹窗可"彻底关闭"或"普通关闭转浮窗"
 *   - 过期任务的弹窗和浮窗额外带处理按钮：明天 / 推迟N天（自定义输入）/ 标记为已完成
 *   - 浮窗：可拖动小卡片常驻界面，位置记忆、重启恢复；× = 彻底关闭；轻点 = 打开编辑弹窗
 *   - 脱离激活态（完成 / 降级 / 日期改走）自动撤销提醒并关闭浮窗；黑名单随之清空，
 *     之后再次变高或再次过期会重新提醒（"彻底关闭"= 本次激活周期内不再提醒）
 *   - 启动时扫描存量任务静默纳入；每分钟周期扫描
 *   - 今日任务清单（Ctrl+Shift+T，可改绑）：过期/今日计划/今日截止/今日完成四分区，
 *     每行带推迟/完成按钮；再次按下快捷键关闭清单
 *   - 每日任务独立栏（置顶）：独立清单、每天展示、当日完成即隐藏、永久删除、
 *     全部完成一键打卡；与 TaskNotes 任务库完全隔离
 *   - 最近文件列表（Ctrl+Shift+Q）：双栏——左栏最近（左键打开/Ctrl+左键新标签/
 *     右键菜单：重命名自动更新链接、复制双向链接、回收站删除、添加到常用），
 *     右栏常用文件（搜索添加、拖动排序、取消常用）
 *
 * TaskNotes 更新后无需重装本插件；禁用/卸载本插件即恢复原有行为。
 */

const { Component, Notice, Modal, Menu, TFile, Setting, setIcon } = require("obsidian");

// Keep the DaySprig view id stable so existing workspace layouts reopen unchanged.
const CAL_VIEW_TYPE = "daysprig-advanced-calendar-view";
const MONTH_VIEW = "dayGridMonth";
const DOUBLE_CLICK_MS = 250;
// 会展示任务信息的 FullCalendar 事件类型；ics/timeblock 等非任务事件走原逻辑
const TASK_EVENT_TYPES = new Set(["scheduled", "due", "recurring", "timeEntry"]);
const HIGH = "high";
const DAY_CHECK_MS = 60_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

module.exports = class DaySprigEnhancements extends Component {
	constructor(host) {
		super();
		this.host = host;
		this.app = host.app;
		this.tn = host;
		this._dataWrite = Promise.resolve();
	}

	addCommand(command) { return this.host.addCommand(command); }
	registerEvent(eventRef) { return super.registerEvent(eventRef); }
	registerInterval(interval) { return super.registerInterval(interval); }
	async loadData() {
		const data = (await this.host.loadData()) || {};
		return data.__daysprigEnhancements || {};
	}
	async saveData(value) {
		this._dataWrite = this._dataWrite.then(async () => {
			const data = (await this.host.loadData()) || {};
			data.__daysprigEnhancements = value || {};
			await this.host.saveData(data);
		});
		return this._dataWrite;
	}

	async start() {
		/** event.id -> { timer }，用于区分单击与双击 */
		this._pendingClicks = new Map();
		this._saved = {
			protos: new Map(), // proto -> { methods: Map<方法名, 原函数> }；TaskNotes 重载会产生新原型，需支持多代
			factoryStack: [], // { original, wrapped } 栈：LIFO 还原
			pluginMethods: [],
		};
		this._warned = false;
		this._todayModal = null; // 当前打开的今日清单弹窗（用于 toggle）
		this._recentModal = null; // 当前打开的最近文件列表弹窗（用于 toggle）
		this._activeReminderModal = null; // 当前打开的提醒弹窗（卸载时兜底关闭）

		const start = () => {
			try {
				this.setup();
			} catch (e) {
				console.error("[TN Calendar Tweaks] setup failed:", e);
				new Notice("DaySprig 初始化失败，详见开发者控制台");
			}
		};

		// 等工作区就绪：此时 TaskNotes 与已打开的日历面板都已存在。
		// 注意：Obsidian 的 Workspace 没有 layout 属性和 once 方法，必须用官方 onLayoutReady
		//（布局已加载时立即回调，否则排队到 layout-ready）
		this.app.workspace.onLayoutReady(start);

		// 今日任务清单（Ctrl+Shift+T，可在设置→快捷键中修改）
		this.addCommand({
			id: "open-today-task-list",
			name: "打开今日任务清单",
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "D" }],
			callback: () => {
				if (!this.tn) {
					new Notice("DaySprig 尚未初始化");
					return;
				}
				if (!this._daily || !this._rs) {
					// 初始化是异步的：状态未就绪时清单会渲染不出每日任务栏
					new Notice("DaySprig 正在初始化，请稍候再试");
					return;
				}
				// toggle：已打开则关闭
				if (this._todayModal) {
					this._todayModal.close();
					return;
				}
				this._todayModal = new TodayListModal(this.app, this);
				this._todayModal.open();
			},
		});

		// 最近文件列表（Ctrl+Shift+Q，可在设置→快捷键中修改）
		this.addCommand({
			id: "open-recent-files",
			name: "打开最近文件列表",
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "q" }],
			callback: () => {
				// toggle：已打开则关闭
				if (this._recentModal) {
					this._recentModal.close();
					return;
				}
				this._recentModal = new RecentFilesModal(this.app, this);
				this._recentModal.open();
			},
		});
	}

	onunload() {
		try {
			this._recentModal?.close();
		} catch (e) {
			/* ignore */
		}
		try {
			this._todayModal?.close();
		} catch (e) {
			/* ignore */
		}
		try {
			this._activeReminderModal?.close();
		} catch (e) {
			/* ignore */
		}
		if (this._popupQueue) this._popupQueue.length = 0;
		this._popupBusy = true; // 阻止卸载后的队列推进
		for (const { timer } of (this._pendingClicks || new Map()).values()) clearTimeout(timer);
		this._pendingClicks?.clear();

		const s = this._saved || {};
		// 还原原型补丁：支持多代原型（TaskNotes 重载后会产生新原型）
		if (s.protos) {
			for (const [proto, rec] of s.protos) {
				for (const [name, fn] of rec.methods) proto[name] = fn;
				delete proto.__tnTweaksPatched;
			}
			s.protos.clear();
		}
		// 工厂栈：沿包装顺序逐层还原（栈顶与当前注册表不符即停，防误还原）
		const reg = this.app.viewRegistry;
		if (reg?.viewByType) {
			while (s.factoryStack?.length) {
				const top = s.factoryStack[s.factoryStack.length - 1];
				if (reg.viewByType[CAL_VIEW_TYPE] !== top.wrapped) break;
				reg.viewByType[CAL_VIEW_TYPE] = top.original;
				s.factoryStack.pop();
			}
		}
		for (const { obj, name, fn } of s.pluginMethods) obj[name] = fn;
		
		// 清除重建标记：重新启用本插件后日历需重建（改绑新闭包）
		try {
			for (const leaf of this.app.workspace.getLeavesOfType(CAL_VIEW_TYPE)) {
				delete leaf.view?.__tnReinitProto;
			}
		} catch (e) {
			/* 工作区可能已不可用 */
		}
		this.teardownReminders();
		// 已被重新初始化的日历实例会保留新行为，直到重开面板；重启 Obsidian 可完全还原
	}


	setup() {
		const tn = this.host;
		if (!tn || !tn.settings) {
			new Notice("DaySprig 尚未初始化，DaySprig 未生效");
			// TaskNotes 可能稍后才被启用：借 layout-change 重试直到成功（防叠增）
			if (!this._retryRegistered) {
				this._retryRegistered = true;
				this.registerEvent(
					this.app.workspace.on("layout-change", () => {
						const tnNow = this.host;
						if (tnNow && tnNow.settings && !this.tn) this.setup();
					})
				);
			}
			return;
		}
		this.tn = tn;
		console.debug("[TN Calendar Tweaks] hooked TaskNotes", tn.manifest?.version || "");

		this.migratePriorities(tn);
		this.patchViewFactory();
		this.patchPluginMethods(tn);
		this.patchExistingViews();
		// 异步失败不外逃（start 的同步 try/catch 够不到 Promise rejection）
		this.setupReminders(tn).catch((e) => {
			console.error("[TN Calendar Tweaks] reminder setup failed:", e);
			new Notice("DaySprig：提醒系统初始化失败，详见开发者控制台");
		});

		// 兜底：每次布局变化都做自愈检查（新视图出现、TaskNotes 重载、工厂被重新注册）
		this.registerEvent(this.app.workspace.on("layout-change", () => this.ensurePrototypePatched()));
		// PDF export is intentionally kept in the private companion plugin.
	}

	/* ---------- 优先级配置一次性迁移（带守卫） ---------- */

	migratePriorities(tn) {
		const priorities = tn.settings?.customPriorities;
		if (!Array.isArray(priorities)) return;
		// 仅当存在 value 为空的损坏条目时才触发；**原位修复**——用户的有效自定义档位一律保留
		const broken = priorities.find((p) => !p || typeof p.value !== "string" || p.value === "");
		if (!broken) return;

		const keep = priorities.filter((p) => p && typeof p.value === "string" && p.value);
		const has = (v) => keep.some((p) => p.value === v);
		const add = [];
		if (!has("none")) add.push({ id: "none", value: "none", label: "无", color: "#e2ffad", weight: 0 });
		if (!has("low")) add.push({ id: "low", value: "low", label: "低", color: "#4caf50", weight: 1 });
		if (!has("normal")) add.push({ id: "normal", value: "normal", label: "中", color: "#ffaa00", weight: 2 });
		if (!has("high")) add.push({ id: "high", value: "high", label: "高", color: broken?.color || "#990000", weight: 3 });
		tn.settings.customPriorities = [...keep, ...add];
		// saveSettings 会同步更新 TaskNotes 的 priorityManager，无需直接改 data.json
		Promise.resolve(tn.saveSettings())
			.then(() => new Notice("TaskNotes 优先级损坏条目已修复（原有自定义档位已保留）"))
			.catch((e) => console.error("[TN Calendar Tweaks] priority migration failed:", e));
	}

	/* ---------- 日历交互钩挂 ---------- */

	patchViewFactory() {
		const reg = this.app.viewRegistry;
		const original = reg?.viewByType?.[CAL_VIEW_TYPE];
		if (typeof original !== "function") return;
		if (this._saved.factoryStack.some((f) => f.wrapped === original || f.original === original)) return;
		const wrapped = this.wrapFactory(original);
		try {
			reg.viewByType[CAL_VIEW_TYPE] = wrapped;
			this._saved.factoryStack.push({ original, wrapped });
		} catch (e) {
			console.error("[TN Calendar Tweaks] factory wrap failed, will fall back to layout-change:", e);
		}
	}

	wrapFactory(original) {
		const tweaks = this;
		return function (leaf) {
			const view = original.apply(this, arguments);
			try {
				// 在视图 onOpen/FullCalendar 初始化绑定处理器之前挂好原型，避免竞态
				tweaks.patchViewPrototype(Object.getPrototypeOf(view));
			} catch (e) {
				console.error("[TN Calendar Tweaks] patchViewPrototype failed:", e);
			}
			return view;
		};
	}

	// TaskNotes 重载（禁用→重启用/更新）会用裸工厂重新占据注册表：检测并重新包装
	rewrapFactoryIfNeeded() {
		const reg = this.app.viewRegistry;
		const cur = reg?.viewByType?.[CAL_VIEW_TYPE];
		if (typeof cur !== "function") return;
		if (this._saved.factoryStack.some((f) => f.wrapped === cur || f.original === cur)) return;
		const wrapped = this.wrapFactory(cur);
		try {
			reg.viewByType[CAL_VIEW_TYPE] = wrapped;
			this._saved.factoryStack.push({ original: cur, wrapped });
			console.debug("[TN Calendar Tweaks] re-wrapped view factory after TaskNotes reload");
		} catch (e) {
			console.error("[TN Calendar Tweaks] re-wrap factory failed:", e);
		}
	}

	ensurePrototypePatched() {
		// TaskNotes 重载自愈：重绑到新实例（task-updated 等 emitter 订阅随旧实例一起失效）
		const tnNow = this.host;
		if (tnNow && tnNow.settings && tnNow !== this.tn) this.rebindTaskNotes(tnNow);
		this.rewrapFactoryIfNeeded();
		this.patchExistingViews();
	}

	rebindTaskNotes(tnNow) {
		try {
			if (this._taskUpdatedRef && this.tn?.emitter?.offref) this.tn.emitter.offref(this._taskUpdatedRef);
		} catch (e) {
			/* 旧实例可能已卸载，无害 */
		}
		this.tn = tnNow;
		this._taskUpdatedRef = tnNow.emitter.on("task-updated", (payload) => {
			try {
				this.onTaskUpdatedForReminder(payload);
			} catch (e) {
				console.error("[TN Calendar Tweaks] task-updated handler failed:", e);
			}
		});
		console.debug("[TN Calendar Tweaks] re-bound to reloaded TaskNotes", tnNow.manifest?.version || "");
		// 重载实例的 activateAdvancedCalendarView 是未包装原版：重新包装（toggle/强制月视图）
		this.patchPluginMethods(tnNow);
	}

	patchExistingViews() {
		const leaves = this.app.workspace.getLeavesOfType(CAL_VIEW_TYPE);
		let patched = false;
		for (const leaf of leaves) {
			const view = leaf.view;
			if (!view) continue;
			if (this.patchViewPrototype(Object.getPrototypeOf(view))) patched = true;
		}
		// 只要本轮有原型刚被打补丁，所有已打开的日历都要重建（旧绑定是旧闭包，且多叶共享同一原型）
		if (patched) {
			for (const leaf of leaves) {
				if (leaf.view?.calendar) this.reinitExistingCalendar(leaf.view);
			}
		}
	}

	async reinitExistingCalendar(view) {
		if (!view || !view.calendar) return;
		const proto = Object.getPrototypeOf(view);
		if (view.__tnReinitProto === proto) return; // 这一代原型已重建过
		view.__tnReinitProto = proto;
		try {
			view.calendar.destroy();
			view.calendar = null;
			await view.initializeCalendar();
		} catch (e) {
			console.error("[TN Calendar Tweaks] re-init failed:", e);
			new Notice("请关闭并重新打开 DaySprig 面板以生效");
		}
	}

	patchViewPrototype(proto) {
		if (!proto || proto.__tnTweaksPatched) return false;

		const origClick = proto.handleEventClick;
		const origCtxMenu = proto.showTaskContextMenuForEvent;
		if (typeof origClick !== "function" || typeof origCtxMenu !== "function") {
			if (!this._warned) {
				this._warned = true;
				new Notice("DaySprig：未找到预期的日历方法，TaskNotes 版本可能不兼容");
			}
			return false;
		}

		const tweaks = this;
		proto.handleEventClick = function (info) {
			const props = info?.event?.extendedProps;
			const task = props?.taskInfo;
			// listWeek 视图下 TaskNotes 原生就不响应任务点击，保持一致
			if (!task || !TASK_EVENT_TYPES.has(props.eventType) || this.calendar?.view?.type === "listWeek") {
				return origClick.apply(this, arguments);
			}
			const js = info.jsEvent;
			if (!js || js.button !== 0) return origClick.apply(this, arguments);
			if (js.ctrlKey || js.metaKey) {
				// 保留原行为：新标签页打开任务笔记
				const app = this.plugin.app;
				if (app.vault.getAbstractFileByPath(task.path)) app.workspace.openLinkText(task.path, "", true);
				return;
			}
			return handleTaskClick(tweaks, this, task, props, info.event);
		};

		proto.showTaskContextMenuForEvent = function (jsEvent, task) {
			if (jsEvent?.shiftKey && task) {
				const file = this.plugin?.app?.vault?.getAbstractFileByPath?.(task.path);
				if (!file) return;
				void (async () => {
					try {
						await this.plugin.app.vault.trash(file, true);
						this.plugin.notifyDataChanged?.(undefined, true, true);
						this.calendar?.getEvents?.()
							.filter((event) => event.extendedProps?.taskInfo?.path === task.path)
							.forEach((event) => event.remove());
						await this.calendar?.refetchEvents?.();
					} catch (error) {
						console.error("Failed to delete task note:", error);
						new Notice("删除任务失败");
					}
				})();
				return;
			}
			if (!task) return origCtxMenu.apply(this, arguments);
			return cyclePriority(tweaks, task);
		};

		if (!this._saved.protos) this._saved.protos = new Map();
		this._saved.protos.set(proto, {
			methods: new Map([
				["handleEventClick", origClick],
				["showTaskContextMenuForEvent", origCtxMenu],
			]),
		});
		Object.defineProperty(proto, "__tnTweaksPatched", { value: true, enumerable: false, configurable: true });
		return true;
	}

	patchPluginMethods(tn) {
		const orig = tn.activateAdvancedCalendarView;
		if (typeof orig !== "function") return;
		tn.activateAdvancedCalendarView = async function () {
			// toggle：高级日历已处于前景时，再次呼出 = 关闭面板
			try {
				const workspace = this.app.workspace;
				const leaves = (workspace.getLeavesOfType?.(CAL_VIEW_TYPE) || []).filter(
					(l) => l && l.view && typeof l.view.getViewType === "function" && l.view.getViewType() === CAL_VIEW_TYPE
				);
				const recent = typeof workspace.getMostRecentLeaf === "function" ? workspace.getMostRecentLeaf() : null;
				const active = leaves.find((l) => l === recent || l === workspace.activeLeaf);
				if (active) {
					if (typeof workspace.detachLeavesOfType === "function") await workspace.detachLeavesOfType(CAL_VIEW_TYPE);
					else active.detach?.();
					return active;
				}
			} catch (e) {
				console.error("[TN Calendar Tweaks] calendar toggle check failed:", e);
			}
			const leaf = await orig.apply(this, arguments);
			try {
				const cal = leaf?.view?.calendar;
				if (cal && cal.view?.type && cal.view.type !== MONTH_VIEW) cal.changeView(MONTH_VIEW);
			} catch (e) {
				console.error("[TN Calendar Tweaks] force month view failed:", e);
			}
			return leaf;
		};
		this._saved.pluginMethods.push({ obj: tn, name: "activateAdvancedCalendarView", fn: orig });
	}

	/* ---------- 任务提醒（统一激活模型） ---------- */

	async setupReminders(tn) {
		// 状态：{ reminders: { path: { lastPopupDate, float:{x,y}|null } }, dismissedForever: [path] }
		// dismissedForever = "本次激活周期内不再提醒"，脱离激活态时自动清空
		const data = (await this.loadData()) || {};
		this._rs = sanitizeReminderState(data.reminderState);
		this._daily = sanitizeDailyState(data.dailyTasks);
		this._favorites = normalizeFavorites(data.favoriteFiles); // 常用文件：有序路径数组
		this._stateReady = true; // 四项状态就绪，persistState 允许落盘
		if (pruneCompletions(this._daily, todayStr(), 60)) this.persistState();
		this._floats = new Map(); // path -> HTMLElement
		this._popupQueue = [];
		this._popupBusy = false;

		// 全局监听任务变更（emitter 即 cacheManager，继承 Obsidian Events）
		this._taskUpdatedRef = tn.emitter.on("task-updated", (payload) => {
			try {
				this.onTaskUpdatedForReminder(payload);
			} catch (e) {
				console.error("[TN Calendar Tweaks] task-updated handler failed:", e);
			}
		});

		// 提醒状态以文件路径为键：任务改名时迁移状态条目（否则黑名单失效、当天重复弹窗）
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				try {
					if (file.children) this.migrateFolderRename(oldPath, file.path);
					else this.migrateReminderPath(oldPath, file.path);
				} catch (e) {
					console.error("[TN Calendar Tweaks] rename migration failed:", e);
				}
			})
		);

		// 存量任务静默纳入（高优先级或过期，已完成除外）
		try {
			const tasks = await tn.cacheManager.getAllTasks();
			for (const t of tasks || []) {
				if (!t?.path || this._rs.dismissedForever.includes(t.path)) continue;
				if (isArmableTask(tn, t)) this.armReminder(t.path);
			}
		} catch (e) {
			console.warn("[TN Calendar Tweaks] stock scan failed:", e);
		}

		injectFloatStyle();

		// 先注册周期扫描：即使首轮扫描失败也保有自愈能力
		this.registerInterval(
			window.setInterval(() => {
				this.scanAndPop().catch((e) => console.error("[TN Calendar Tweaks] periodic scan failed:", e));
			}, DAY_CHECK_MS)
		);

		// 周期扫描：跨天到点弹窗、发现新建/外部修改的激活任务（文件路径的变更不经过 task-updated 事件）
		try {
			await this.scanAndPop();
		} catch (e) {
			console.error("[TN Calendar Tweaks] initial scan failed:", e);
		}
	}

	// 任务文件改名（含本插件重命名功能触发）→ 迁移提醒状态、黑名单与常用文件
	migrateReminderPath(oldPath, newPath) {
		if (!this._rs || !oldPath || !newPath || oldPath === newPath) return;
		let changed = false;
		if (this._rs.reminders[oldPath]) {
			this._rs.reminders[newPath] = this._rs.reminders[oldPath];
			delete this._rs.reminders[oldPath];
			changed = true;
		}
		const idx = this._rs.dismissedForever.indexOf(oldPath);
		if (idx >= 0) {
			this._rs.dismissedForever[idx] = newPath;
			changed = true;
		}
		if (Array.isArray(this._favorites)) {
			const fIdx = this._favorites.indexOf(oldPath);
			if (fIdx >= 0) {
				this._favorites[fIdx] = newPath;
				changed = true;
			}
		}
		if (changed) this.persistState();
	}

	// 文件夹改名：其下所有路径做前缀迁移（Obsidian 只派发文件夹自身事件）
	migrateFolderRename(oldPath, newPath) {
		if (!this._rs || !oldPath || !newPath) return;
		const remap = (p) => (p === oldPath || p.startsWith(oldPath + "/") ? newPath + p.slice(oldPath.length) : p);
		let changed = false;
		for (const key of Object.keys(this._rs.reminders)) {
			const np = remap(key);
			if (np !== key) {
				this._rs.reminders[np] = this._rs.reminders[key];
				delete this._rs.reminders[key];
				changed = true;
			}
		}
		this._rs.dismissedForever = this._rs.dismissedForever.map((p) => {
			const np = remap(p);
			if (np !== p) changed = true;
			return np;
		});
		if (Array.isArray(this._favorites)) {
			this._favorites = this._favorites.map((p) => {
				const np = remap(p);
				if (np !== p) changed = true;
				return np;
			});
		}
		if (changed) this.persistState();
	}

	teardownReminders() {
		try {
			if (this._taskUpdatedRef && this.tn?.emitter?.offref) this.tn.emitter.offref(this._taskUpdatedRef);
		} catch (e) {
			/* ignore */
		}
		for (const el of (this._floats || new Map()).values()) el.remove();
		this._floats?.clear();
		const style = typeof document !== "undefined" ? document.getElementById("daysprig-enhancements-style") : null;
		if (style) style.remove();
	}

	onTaskUpdatedForReminder({ originalTask, updatedTask } = {}) {
		if (!updatedTask?.path) return;
		const tn = this.tn;
		const path = updatedTask.path;
		const wasDone = tn.statusManager.isCompletedStatus(originalTask?.status);
		const nowDone = tn.statusManager.isCompletedStatus(updatedTask.status);
		const highBefore = originalTask?.priority === HIGH;
		const highNow = updatedTask.priority === HIGH;
		const overBefore = isOverdueTask(tn, originalTask);
		const overNow = isOverdueTask(tn, updatedTask);
		const activeBefore = (highBefore || overBefore) && !wasDone;
		const activeNow = (highNow || overNow) && !nowDone;

		if (activeNow && !activeBefore) {
			// 准入统一走 isArmableTask：无日期的高优任务（无论变高还是重开完成态）都不纳入
			if (!isArmableTask(tn, updatedTask)) {
				if (highNow && !highBefore) new Notice(`『${updatedTask.title}』无计划/截止日期，未开启当日提醒`);
				return;
			}
			const becameHigh = highNow && !highBefore;
			this.armReminder(path);
			if (becameHigh && overNow) new Notice(`已开启提醒：『${updatedTask.title}』（高优先级且已过期）`);
			else if (becameHigh) new Notice(`已开启当日提醒：『${updatedTask.title}』`);
			else new Notice(`发现过期任务：『${updatedTask.title}』`);
			this.maybeQueuePopup(path);
		} else if (!activeNow && activeBefore) {
			// 脱离激活态（完成 / 降级 / 日期改走）：撤销并清黑名单
			this.disarmReminder(path);
		} else if (activeNow && activeBefore) {
			// 保持激活但内容可能变化（如过期出现/消失）→ 重建浮窗内容，位置保留
			// 补充纳入：任务此前因无日期未纳入、后来补上了日期。
			// 注意不能走 armReminder（它会清黑名单）——黑名单是"本周期内用户已彻底关闭"，
			// 要等任务脱离激活态后由扫描清除
			if (
				!this._rs.reminders[path] &&
				!this._rs.dismissedForever.includes(path) &&
				isArmableTask(tn, updatedTask)
			) {
				this._rs.reminders[path] = { lastPopupDate: null, float: null };
				this.persistState();
			}
			this.refreshFloat(path, updatedTask);
		}
	}

	armReminder(path) {
		this._rs.dismissedForever = this._rs.dismissedForever.filter((p) => p !== path);
		if (!this._rs.reminders[path]) this._rs.reminders[path] = { lastPopupDate: null, float: null };
		this.persistState();
	}

	disarmReminder(path) {
		if (!this._rs.reminders[path] && !this._rs.dismissedForever.includes(path)) return;
		delete this._rs.reminders[path];
		this._rs.dismissedForever = this._rs.dismissedForever.filter((p) => p !== path);
		this.closeFloatDom(path);
		this.persistState();
	}

	dismissForever(path) {
		delete this._rs.reminders[path];
		if (!this._rs.dismissedForever.includes(path)) this._rs.dismissedForever.push(path);
		this.closeFloatDom(path);
		this.persistState();
	}

	// 统一落盘：提醒状态与每日任务清单必须一起写入，
	// 否则任何一边的保存都会用部分数据覆盖掉另一边
	async persistState() {
		if (!this._stateReady) return; // 初始化未完成：拒绝用不完整状态覆盖 data.json
		try {
			await this.saveData({
				reminderState: this._rs,
				dailyTasks: this._daily,
				favoriteFiles: this._favorites,
			});
		} catch (e) {
			console.error("[TN Calendar Tweaks] save state failed:", e);
		}
	}

	// 扫描：发现未纳入的激活任务、清理失效条目、恢复浮窗、到期弹窗
	async scanAndPop() {
		const tn = this.tn;
		const today = todayStr();
		const snapshot = JSON.stringify(this._rs);
		// 黑名单条目：任务已不存在或脱离激活态 → 移出黑名单（下轮激活可重新提醒）
		for (const path of [...this._rs.dismissedForever]) {
			const task = await this.getTaskStrict(path);
			if (task === undefined) continue; // 暂不可知：本轮跳过
			if (!task || !isArmableTask(tn, task)) {
				this._rs.dismissedForever = this._rs.dismissedForever.filter((p) => p !== path);
			}
		}
		// 发现：新建或外部修改的激活任务（不经过 task-updated 事件）静默纳入
		try {
			const tasks = await tn.cacheManager.getAllTasks();
			for (const t of tasks || []) {
				if (!t?.path || this._rs.dismissedForever.includes(t.path) || this._rs.reminders[t.path]) continue;
				if (isArmableTask(tn, t)) this.armReminder(t.path);
			}
		} catch (e) {
			console.warn("[TN Calendar Tweaks] discovery scan failed:", e);
		}
		for (const path of Object.keys(this._rs.reminders)) {
			const entry = this._rs.reminders[path];
			const task = await this.getTaskStrict(path);
			if (task === undefined) continue; // 暂不可知：本轮跳过
			// 任务删除/完成/既不高优也不过期 → 解除
			if (!task || !isArmableTask(tn, task)) {
				this.disarmReminder(path);
				continue;
			}
			if (entry.float) {
				this.refreshFloat(path, task); // 重建以刷新标题/按钮，位置保留
				continue; // 浮窗常驻期间不再弹窗
			}
			const overdue = isOverdueTask(tn, task);
			const day = reminderDayOf(task);
			const shouldPop = overdue || (task.priority === HIGH && day && day <= today);
			if (shouldPop && entry.lastPopupDate !== today) this.queuePopup(path, task, day, today);
		}
		// 仅在状态有变化时落盘，避免每分钟无谓写入
		if (JSON.stringify(this._rs) !== snapshot) await this.persistState();
		this.drainPopupQueue();
	}

	async safeGetTask(path) {
		try {
			return await this.tn.cacheManager.getTaskInfo(path);
		} catch (e) {
			return null;
		}
	}

	// 取任务：null = 确定不存在；undefined = 暂不可知（异常，跳过本轮以免误解除）
	async getTaskStrict(path) {
		try {
			return (await this.tn.cacheManager.getTaskInfo(path)) || null;
		} catch (e) {
			return undefined;
		}
	}

	maybeQueuePopup(path) {
		const entry = this._rs.reminders[path];
		if (!entry) return;
		this.safeGetTask(path)
			.then((task) => {
				if (!task) return;
				const today = todayStr();
				const overdue = isOverdueTask(this.tn, task);
				const day = reminderDayOf(task);
				const shouldPop = overdue || (task.priority === HIGH && day && day <= today);
				if (shouldPop && entry.lastPopupDate !== today) {
					this.queuePopup(path, task, day, today);
					this.persistState(); // lastPopupDate 落盘，避免重启后当天重弹
					this.drainPopupQueue();
				}
			})
			.catch(() => {});
	}

	queuePopup(path, task, day, today) {
		if (this._popupQueue.some((q) => q.path === path)) return;
		const entry = this._rs.reminders[path];
		if (!entry) return; // 扫描间隙中条目已被解除
		this._popupQueue.push({ path, task, day, today });
		entry.lastPopupDate = today; // 当天只弹一次
	}

	drainPopupQueue() {
		if (this._popupBusy || !this._popupQueue.length) return;
		this._popupBusy = true;
		const { path } = this._popupQueue.shift();
		const showNext = () => {
			this._popupBusy = false;
			this._activeReminderModal = null;
			this.drainPopupQueue();
		};
		if (typeof document === "undefined") return showNext(); // 无 DOM 环境（测试）跳过
		const tweaks = this;
		// 出队复核：任务可能在排队期间被完成/降级/日期改走/删除——
		// 陈旧快照既误导又可能覆盖用户数据；失效时顺手解除提醒条目
		this.getTaskStrict(path)
			.then((task) => {
				if (task === undefined) return showNext(); // 暂不可知：本轮跳过
				const today = todayStr();
				if (!task || !this._rs.reminders[path] || !isArmableTask(this.tn, task)) {
					this.disarmReminder(path);
					return showNext();
				}
				const overdue = isOverdueTask(this.tn, task);
				// 弹窗展示日：过期任务取第一个过期日期（due-only 任务不会显示"提醒日 null"）
				const day = overdue ? overdueDayOf(task) || reminderDayOf(task) : reminderDayOf(task);
				// 与入队条件一致：仍激活但未到期的（如高优+未来日期）不出弹窗
				const shouldPop = overdue || (task.priority === HIGH && day && day <= today);
				if (!shouldPop) return showNext();
				const actions = {
					forever: () => this.dismissForever(path),
					toFloat: () => {
						const entry = this._rs.reminders[path];
						if (!entry) return; // showNext 统一由弹窗 onClosed 触发，避免双推进
						if (!entry.float) entry.float = defaultFloatPos(this._floats.size);
						this.ensureFloatDom(path, task);
						this.persistState();
					},
					tomorrow: () => postponeTask(tweaks, task, 1),
					customDays: (n) => postponeTask(tweaks, task, n),
					complete: () => completeByButton(tweaks, task),
				};
				const modal = new ReminderModal(this.app, task, day, !!day && day < today, overdue, actions, showNext);
				this._activeReminderModal = modal;
				modal.open();
			})
			.catch((e) => {
				console.error("[TN Calendar Tweaks] show popup failed:", e);
				showNext();
			});
	}

	ensureFloatDom(path, task) {
		if (typeof document === "undefined") return;
		if (this._floats.has(path)) return;
		const entry = this._rs.reminders[path];
		if (!entry?.float) return;
		const el = buildFloatEl(this, path, task, entry);
		this._floats.set(path, el);
		document.body.appendChild(el);
	}

	refreshFloat(path, task) {
		// 重建以刷新内容（标题/过期按钮等），位置由 entry.float 保留
		this.closeFloatDom(path);
		this.ensureFloatDom(path, task);
	}

	closeFloatDom(path) {
		const el = this._floats.get(path);
		if (el) {
			el.remove();
			this._floats.delete(path);
		}
	}

	saveFloatPos(path, el) {
		const entry = this._rs.reminders[path];
		if (!entry) return;
		const w = el.offsetWidth || 240;
		const h = el.offsetHeight || 60;
		const x = Math.min(Math.max(8, el.offsetLeft), Math.max(8, window.innerWidth - w - 8));
		const y = Math.min(Math.max(8, el.offsetTop), Math.max(8, window.innerHeight - h - 8));
		el.style.left = `${x}px`;
		el.style.top = `${y}px`;
		entry.float = { x, y };
		this.persistState();
	}

};

/* ---------- 日历交互逻辑 ---------- */

function handleTaskClick(tweaks, view, task, props, fcEvent) {
	// 键加 leaf 维度：多个日历面板中同一任务的 event.id 相同，避免互相误判双击
	const key = `${view.leaf?.id || "noleaf"}|${fcEvent?.id || task.path}`;
	const pending = tweaks._pendingClicks.get(key);
	if (pending) {
		// 250ms 内第二次点击 → 双击 → 打开编辑弹窗
		clearTimeout(pending.timer);
		tweaks._pendingClicks.delete(key);
		Promise.resolve(view.plugin.openTaskEditModal(task)).catch((e) => {
			console.error("[TN Calendar Tweaks] open edit modal failed:", e);
			new Notice("打开任务编辑弹窗失败");
		});
		return;
	}
	const timer = setTimeout(() => {
		tweaks._pendingClicks.delete(key);
		toggleComplete(tweaks, task, props, fcEvent);
	}, DOUBLE_CLICK_MS);
	tweaks._pendingClicks.set(key, { timer });
}

async function toggleComplete(tweaks, task, props, fcEvent) {
	const tn = tweaks.tn;
	try {
		if (task.recurrence) {
			let date = props.instanceDate;
			if (!(date instanceof Date)) {
				date = typeof date === "string" && date ? new Date(date) : fcEvent?.start ?? new Date();
			}
			await tn.toggleRecurringTaskComplete(task, date);
		} else {
			const done = tn.statusManager.isCompletedStatus(task.status);
			let target;
			if (done) target = tn.settings.defaultTaskStatus || "open";
			else target = tn.statusManager.getCompletedStatuses()[0] || null;
			if (!target) {
				// 用户把完成态全部删光时避免向 frontmatter 写入未定义的状态值
				new Notice("未配置完成状态，无法标记完成");
				return;
			}
			// 走 updateTaskProperty 以复用其状态提示通知与 completedDate 维护
			await tn.updateTaskProperty(task, "status", target);
		}
	} catch (e) {
		console.error("[TN Calendar Tweaks] toggle complete failed:", e);
		new Notice("切换任务完成状态失败");
	}
}

function buildCycleList(tn) {
	// 循环列表运行时从配置取：跳过"无"与空值条目，按 weight 升序（低→中→高…）
	const list = (tn.settings?.customPriorities || []).filter(
		(p) => p && typeof p.value === "string" && p.value && p.value !== "none"
	);
	return list.sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0));
}

async function cyclePriority(tweaks, task) {
	const tn = tweaks.tn;
	try {
		let current = task;
		try {
			// 取缓存中的最新值：快速连点时事件快照里的 priority 可能还是上一拍
			const fresh = await tn.cacheManager.getTaskInfo(task.path);
			if (fresh) current = fresh;
		} catch (e) {
			/* 取不到就用快照继续 */
		}
		const list = buildCycleList(tn);
		if (!list.length) return;
		const idx = list.findIndex((p) => p.value === current.priority);
		const next = idx === -1 ? list[0] : list[(idx + 1) % list.length];
		await tn.updateTaskProperty(current, "priority", next.value, { silent: true });
		const label = tn.priorityManager.getPriorityConfig(next.value)?.label || next.label || next.value;
		new Notice(`优先级：${label}`);
	} catch (e) {
		console.error("[TN Calendar Tweaks] cycle priority failed:", e);
		new Notice("切换优先级失败");
	}
}

/* ---------- 提醒：纯工具 ---------- */

function pad2(n) {
	return String(n).padStart(2, "0");
}

function fmtDate(d) {
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayStr() {
	return fmtDate(new Date());
}

function addDaysStr(days) {
	const d = new Date();
	d.setDate(d.getDate() + days); // 用日历字段加天数，跨夏令时/跨月不会漂移（毫秒加法在 DST 会多跳一天）
	return fmtDate(d);
}

// TaskService stores recurring completion dates as UTC-anchored calendar days.
// Pass an explicit UTC anchor so local time zones cannot shift the saved day.
function todayAsUTCAnchor() {
	const now = new Date();
	return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

// 提醒日 = 计划日期优先，无则截止日期；取 yyyy-MM-dd 部分
function reminderDayOf(task) {
	const raw = task?.scheduled || task?.due || "";
	const day = typeof raw === "string" ? raw.slice(0, 10) : "";
	return DAY_RE.test(day) ? day : null;
}

// 激活 = (高优先级 || 过期) && 未完成；过期另要求非循环任务
function isOverdueTask(tn, task) {
	if (!task || task.recurrence || task.archived) return false;
	if (tn.statusManager.isCompletedStatus(task.status)) return false;
	const today = todayStr();
	for (const f of ["due", "scheduled"]) {
		const day = typeof task[f] === "string" ? task[f].slice(0, 10) : "";
		if (DAY_RE.test(day) && day < today) return true;
	}
	return false;
}

function isActiveTask(tn, task) {
	if (!task || task.archived) return false;
	if (tn.statusManager.isCompletedStatus(task.status)) return false;
	return task.priority === HIGH || isOverdueTask(tn, task);
}

// 可纳入提醒 = 高优(有提醒日) 或 过期；与解除条件对称（无日期的高优任务不可纳入）
function isArmableTask(tn, task) {
	if (!task || task.archived) return false;
	if (tn.statusManager.isCompletedStatus(task.status)) return false;
	return (task.priority === HIGH && !!reminderDayOf(task)) || isOverdueTask(tn, task);
}

// 过期展示日：第一个已过期的日期字段（due 优先）——用于弹窗文案
function overdueDayOf(task) {
	const today = todayStr();
	for (const f of ["due", "scheduled"]) {
		const d = dayOf(task?.[f]);
		if (d && d < today) return d;
	}
	return null;
}

function dayOf(raw) {
	const day = typeof raw === "string" ? raw.slice(0, 10) : "";
	return DAY_RE.test(day) ? day : null;
}

// 今日任务清单分组：过期未完成 / 计划于今日 / 今日截止（计划优先，不重复）/ 今日已完成
function filterTodayTasks(tn, tasks, today) {
	const groups = { overdue: [], todaySched: [], todayDue: [], completedToday: [] };
	for (const t of tasks || []) {
		if (!t?.path) continue;
		const done = tn.statusManager.isCompletedStatus(t.status);
		const sched = dayOf(t.scheduled);
		const due = dayOf(t.due);
		if (done) {
			if (dayOf(t.completedDate) === today) groups.completedToday.push(t);
			continue;
		}
		if (t.recurrence) {
			// 循环任务：今日有实例 → 今日计划；实例已完成 → 计入今日已完成（旧日期不当作过期）
			if (sched === today || (!sched && due === today)) {
				const instDone = Array.isArray(t.complete_instances) && t.complete_instances.includes(today);
				(instDone ? groups.completedToday : groups.todaySched).push(t);
			}
			continue;
		}
		if ((sched && sched < today) || (due && due < today)) groups.overdue.push(t);
		else if (sched === today) groups.todaySched.push(t);
		else if (due === today) groups.todayDue.push(t);
	}
	// 组内排序：优先级 weight 降序（高在前），其次按计划/截止时间
	const weight = (t) => tn.priorityManager?.getPriorityConfig?.(t.priority)?.weight ?? -1;
	const byPri = (a, b) => weight(b) - weight(a) || String(a.scheduled || a.due || "").localeCompare(String(b.scheduled || b.due || ""));
	groups.overdue.sort(byPri);
	groups.todaySched.sort(byPri);
	groups.todayDue.sort(byPri);
	return groups;
}

/* ---------- 每日任务：独立清单纯函数（与 TaskNotes 任务库完全隔离） ---------- */

function newDailyId() {
	return `dt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 提醒状态防御式清洗：data.json 可能被手工改坏（合法 JSON + 非法结构）
function sanitizeReminderState(raw) {
	const state = { reminders: {}, dismissedForever: [] };
	if (raw && typeof raw === "object" && !Array.isArray(raw)) {
		if (raw.reminders && typeof raw.reminders === "object" && !Array.isArray(raw.reminders)) {
			for (const [path, entry] of Object.entries(raw.reminders)) {
				if (typeof path !== "string" || !path) continue;
				const e = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
				state.reminders[path] = {
					lastPopupDate: typeof e.lastPopupDate === "string" && DAY_RE.test(e.lastPopupDate) ? e.lastPopupDate : null,
					float:
						e.float && Number.isFinite(e.float.x) && Number.isFinite(e.float.y)
							? { x: e.float.x, y: e.float.y }
							: null,
				};
			}
		}
		if (Array.isArray(raw.dismissedForever)) {
			state.dismissedForever = raw.dismissedForever.filter((p) => typeof p === "string" && p);
		}
	}
	return state;
}

function sanitizeDailyState(raw) {
	const state = { items: [], completions: {}, ...(raw && typeof raw === "object" ? raw : {}) };
	state.items = Array.isArray(state.items)
		? state.items.filter((it) => it && typeof it.id === "string" && typeof it.title === "string" && it.title.trim())
		: [];
	const clean = {};
	if (state.completions && typeof state.completions === "object") {
		for (const [day, ids] of Object.entries(state.completions)) {
			if (DAY_RE.test(day) && Array.isArray(ids)) clean[day] = ids.filter((id) => typeof id === "string");
		}
	}
	state.completions = clean;
	return state;
}

// 清理 keepDays 天前的完成记录；返回是否有变更
function pruneCompletions(state, today, keepDays = 60) {
	const cutoff = fmtDate(new Date(Date.now() - keepDays * 864e5));
	let changed = false;
	for (const day of Object.keys(state.completions)) {
		if (day < cutoff) {
			delete state.completions[day];
			changed = true;
		}
	}
	return changed;
}

// 新建；标题空白则返回 null
function addDailyItem(state, title, today) {
	const t = typeof title === "string" ? title.trim() : "";
	if (!t) return null;
	const item = { id: newDailyId(), title: t, createdAt: today };
	state.items.push(item);
	return item;
}

// 标记今日已完成；返回是否有变更（当日不展示，次日自动恢复）
function completeDailyToday(state, id, today) {
	if (!state.items.some((it) => it.id === id)) return false;
	const done = state.completions[today] || (state.completions[today] = []);
	if (done.includes(id)) return false;
	done.push(id);
	return true;
}

function completeAllDaily(state, today) {
	const done = state.completions[today] || (state.completions[today] = []);
	let changed = false;
	for (const it of state.items) {
		if (!done.includes(it.id)) {
			done.push(it.id);
			changed = true;
		}
	}
	return changed;
}

// 永久删除：移除条目并清除所有日期里的完成记录
function deleteDailyItem(state, id) {
	const before = state.items.length;
	state.items = state.items.filter((it) => it.id !== id);
	if (state.items.length === before) return false;
	for (const day of Object.keys(state.completions)) {
		state.completions[day] = state.completions[day].filter((x) => x !== id);
	}
	return true;
}

/* ---------- 最近文件：纯工具 ---------- */

const RECENT_LIMIT = 30;

// 过滤已删除文件、去重、限量，保持最近优先顺序
function sanitizeRecentPaths(paths, existsFn, limit = RECENT_LIMIT) {
	const seen = new Set();
	const out = [];
	for (const p of paths || []) {
		if (typeof p !== "string" || !p || seen.has(p)) continue;
		if (!existsFn(p)) continue;
		seen.add(p);
		out.push(p);
		if (out.length >= limit) break;
	}
	return out;
}

// 双向链接名：md 用无扩展名的文件名；其他文件用带扩展名的文件名
function recentLinkName(file) {
	if (!file) return "";
	return /\.(md|canvas)$/i.test(file.name || "") ? file.basename : file.name || "";
}

// 重命名目标计算；返回 { ok, target } 或 { ok:false, reason }
function buildRenameTarget(file, input) {
	const name = typeof input === "string" ? input.trim() : "";
	if (!name) return { ok: false, reason: "名称不能为空" };
	if (name.includes("/") || name.includes("\\")) return { ok: false, reason: "名称不能包含路径分隔符" };
	let finalName = name;
	const origName = file.name || "";
	if (/\.md$/i.test(origName) && !/\.md$/i.test(finalName)) finalName += ".md";
	else if (!/\.[^./\\]+$/.test(finalName)) {
		// 非md：输入未带扩展名时保留原扩展名，避免改出无类型文件
		const m = /\.([^./\\]+)$/.exec(origName);
		if (m) finalName += `.${m[1]}`;
	}
	const parent = file.parent && file.parent.path && file.parent.path !== "/" ? `${file.parent.path}/` : "";
	return { ok: true, target: parent + finalName };
}

// 常用文件数组清洗：过滤非字符串、去重、保序
function normalizeFavorites(arr) {
	if (!Array.isArray(arr)) return [];
	const seen = new Set();
	const out = [];
	for (const p of arr) {
		if (typeof p !== "string" || !p || seen.has(p)) continue;
		seen.add(p);
		out.push(p);
	}
	return out;
}

// 子序列模糊匹配：query 的每个字符按顺序出现在 target 中即命中（大小写不敏感）。
// 返回按（起始位置, 匹配跨度）排序的结果，供搜索建议使用
function matchFiles(files, query, exclude, limit = 8) {
	const q = (query || "").trim().toLowerCase();
	if (!q) return [];
	const pool = [];
	for (const f of files || []) {
		if (!f || typeof f.name !== "string") continue;
		if (exclude && exclude.has(f.path)) continue;
		const target = f.name.toLowerCase();
		// 子序列匹配
		let ti = 0;
		let start = -1;
		let end = -1;
		let ok = true;
		for (let qi = 0; qi < q.length; qi++) {
			const found = target.indexOf(q[qi], ti);
			if (found === -1) {
				ok = false;
				break;
			}
			if (qi === 0) start = found;
			end = found;
			ti = found + 1;
		}
		if (ok) pool.push({ file: f, start, span: end - start });
	}
	pool.sort((a, b) => a.start - b.start || a.span - b.span || String(a.file.path).localeCompare(String(b.file.path)));
	return pool.slice(0, limit).map((x) => x.file);
}

function defaultFloatPos(n) {
	const W = window.innerWidth || 1280;
	const H = window.innerHeight || 800;
	return {
		x: Math.max(8, W - 280),
		y: Math.min(Math.max(8, 80 + n * 84), Math.max(8, H - 90)),
	};
}

// 把浮窗位置钳制在当前视口内（保存的坐标可能来自更大的窗口/另一台显示器）
function clampFloatPos(p) {
	const W = window.innerWidth || 1280;
	const H = window.innerHeight || 800;
	return {
		x: Math.min(Math.max(8, Number(p?.x) || 8), Math.max(8, W - 248)),
		y: Math.min(Math.max(8, Number(p?.y) || 8), Math.max(8, H - 90)),
	};
}

/* ---------- 提醒：按钮动作 ---------- */

// 推迟：scheduled/due 哪个过期改哪个，都过期都改；保留原时刻部分。
// includeToday=true（今日清单场景）时，等于今天的日期字段也可推迟。
// 返回是否成功（供弹窗按钮失败回滚）。
async function postponeTask(tweaks, task, days, includeToday) {
	const tn = tweaks.tn;
	try {
		const target = addDaysStr(days);
		const today = todayStr();
		let changed = 0;
		for (const field of ["scheduled", "due"]) {
			const val = task[field];
			if (typeof val !== "string" || !val) continue;
			const day = val.slice(0, 10);
			if (!DAY_RE.test(day)) continue;
			const before = day < today;
			const isToday = day === today;
			if (!before && !(includeToday && isToday)) continue; // 只推迟已过期（或今日）的日期字段
			// 时刻部分：标准 T 分隔或手写空格分隔都保留
			const tm = /T(.+)$/.exec(val) || /\s(.+)$/.exec(val);
			const timePart = tm ? `T${tm[1]}` : "";
			await tn.updateTaskProperty(task, field, target + timePart, { silent: true });
			changed++;
		}
		if (changed)
			new Notice(
				`已推迟到${days === 1 ? "明天" : days === 7 ? "一周后" : `${days} 天后`}：『${task.title}』`
			);
		return changed > 0;
	} catch (e) {
		console.error("[TN Calendar Tweaks] postpone failed:", e);
		new Notice("推迟任务失败");
		return false;
	}
}

// "标记为已完成"：普通任务置为完成态；循环任务完成今日实例。返回是否成功。
async function completeByButton(tweaks, task) {
	const tn = tweaks.tn;
	try {
		if (task.recurrence) {
			await tn.toggleRecurringTaskComplete(task, todayAsUTCAnchor());
			new Notice(`已完成今日实例：『${task.title}』`);
			return true;
		}
		const target = tn.statusManager.getCompletedStatuses()[0] || null;
		if (!target) {
			new Notice("未配置完成状态，无法标记完成");
			return false;
		}
		await tn.updateTaskProperty(task, "status", target, { silent: true });
		new Notice(`已完成：『${task.title}』`);
		return true;
	} catch (e) {
		console.error("[TN Calendar Tweaks] complete failed:", e);
		new Notice("标记完成失败");
		return false;
	}
}

/* ---------- 提醒：弹窗与浮窗 DOM ---------- */

// 就地将容器替换为"自定义天数"输入框（Enter 确认 / Esc 或 ✕ 取消）
// owner：所属弹窗。官方 keymap 在 window 捕获阶段监听 Escape，输入框内的 stopPropagation
// 拦不住——必须借助弹窗的 onEscapeKey 转发取消，否则 Esc 会把整个弹窗关掉（真实踩坑）
function mountDaysInput(container, onOk, onCancel, owner) {
	while (container.firstChild) container.removeChild(container.firstChild);
	const cleanupFlags = () => {
		if (owner) {
			owner._daysInputActive = false;
			owner._daysInputCancel = null;
		}
	};
	const wrap = document.createElement("div");
	wrap.className = "tnct-days-input";
	const input = document.createElement("input");
	input.type = "number";
	input.min = "1";
	input.max = "365";
	input.placeholder = "天数";
	const ok = document.createElement("button");
	ok.textContent = "✓";
	ok.title = "确定";
	const cancel = document.createElement("button");
	cancel.textContent = "✕";
	cancel.title = "取消";
	const submit = () => {
		const n = Math.floor(Number(input.value));
		if (n >= 1 && n <= 365) {
			cleanupFlags();
			onOk(n);
		} else {
			new Notice("请输入 1-365 的整数天数");
		}
	};
	const doCancel = () => {
		cleanupFlags();
		onCancel();
	};
	ok.addEventListener("click", submit);
	cancel.addEventListener("click", doCancel);
	input.addEventListener("keydown", (ev) => {
		if (ev.key === "Enter") {
			ev.preventDefault();
			submit();
		} else if (ev.key === "Escape") {
			ev.preventDefault();
			ev.stopPropagation();
			doCancel();
		}
	});
	// 聚焦的 number 输入框会被滚轮改值——拦下，防止滚动页面时误改天数
	input.addEventListener("wheel", (ev) => ev.preventDefault(), { passive: false });
	wrap.append(input, ok, cancel);
	container.appendChild(wrap);
	if (owner) {
		owner._daysInputActive = true;
		owner._daysInputCancel = doCancel;
	}
	try {
		input.focus();
		input.select();
	} catch (e) {
		/* focus 不可用时忽略 */
	}
	return wrap;
}

function injectFloatStyle() {
	if (typeof document === "undefined" || document.getElementById("daysprig-enhancements-style")) return;
	const style = document.createElement("style");
	style.id = "daysprig-enhancements-style";
	style.textContent = `
.tnct-float{position:fixed;z-index:var(--layer-modal);width:240px;background:var(--background-primary);
	border:1px solid var(--background-modifier-border);border-left:4px solid #990000;border-radius:8px;
	box-shadow:0 4px 14px rgba(0,0,0,.25);padding:8px 10px;cursor:grab;user-select:none;
	font-size:var(--font-ui-smaller)}
.tnct-float:active{cursor:grabbing}
.tnct-float-row{display:flex;align-items:center;gap:6px}
.tnct-float-dot{width:8px;height:8px;border-radius:50%;background:#990000;flex:none}
.tnct-float-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.tnct-float-close{cursor:pointer;color:var(--text-muted);padding:0 2px;font-size:1em;line-height:1}
.tnct-float-close:hover{color:var(--text-error)}
.tnct-float-actions{display:flex;gap:4px;margin-top:6px}
.tnct-float-actions button{flex:1;font-size:var(--font-ui-smaller);padding:2px 4px;cursor:pointer}
.tnct-modal-date{color:var(--text-muted);margin:4px 0 2px}
.tnct-modal-overdue{color:var(--text-error);font-weight:600}
.tnct-today{min-width:min(440px,90vw);max-width:580px;max-height:70vh;overflow-y:auto}
.tnct-daily{margin-bottom:2px}
.tnct-daily-count{font-size:var(--font-ui-smaller);color:var(--text-muted);font-weight:400}
.tnct-daily-all{float:right;font-size:var(--font-ui-smaller);padding:1px 8px;cursor:pointer}
.tnct-daily-inputrow{display:flex;gap:6px;margin:6px 0 2px}
.tnct-daily-inputrow input{flex:1;padding:3px 8px;font-size:var(--font-ui-smaller)}
.tnct-daily-inputrow button{font-size:var(--font-ui-smaller);padding:2px 10px;cursor:pointer}
.tnct-daily-empty{font-size:var(--font-ui-smaller);color:var(--text-muted);padding:2px 0 4px}
.tnct-today-header{font-weight:600;margin:12px 0 4px}
.tnct-today-overdue{color:var(--text-error)}
.tnct-today-section .tnct-today-row:last-child{border-bottom:none}
.tnct-today-row{display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid var(--background-modifier-border)}
.tnct-today-main{flex:1;min-width:0}
.tnct-today-title{font-weight:600;display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tnct-today-meta{font-size:var(--font-ui-smaller);color:var(--text-muted);margin-top:2px}
.tnct-today-actions{display:flex;gap:4px;flex:none}
.tnct-today-actions button{font-size:var(--font-ui-smaller);padding:2px 8px}
.tnct-today-donefoot{margin-top:12px;font-size:var(--font-ui-smaller);color:var(--text-muted)}
.tnct-today-empty{color:var(--text-muted)}
.tnct-days-input{display:flex;gap:4px;align-items:center;flex:1}
.tnct-days-input input{width:64px;padding:2px 6px;font-size:var(--font-ui-smaller)}
.tnct-days-input button{padding:2px 6px;font-size:var(--font-ui-smaller);cursor:pointer}
.tnct-recent-modal{width:min(760px,94vw) !important;max-width:94vw !important}
.tnct-recent{width:100%;max-height:70vh;overflow-y:auto}
.tnct-recent-cols{display:flex;gap:16px;align-items:flex-start;width:100%}
.tnct-recent-col{flex:1 1 0;min-width:0}
.tnct-recent-coltitle{display:flex;align-items:center;gap:6px;font-weight:700;font-size:var(--font-ui-medium);
	color:var(--text-normal);letter-spacing:.14em;margin:0 0 8px;padding:4px 8px 8px;
	border-bottom:2px solid var(--background-modifier-border)}
.tnct-colicon{display:inline-flex;color:var(--color-accent)}
.tnct-colicon svg{width:15px;height:15px}
.tnct-title-fav .tnct-colicon{color:var(--color-yellow)}
.tnct-recent-col .tnct-recent-list{max-height:52vh;overflow-y:auto}
.tnct-fav-searchwrap{position:relative;margin-bottom:4px}
.tnct-fav-searchwrap input{width:100%;padding:3px 8px;font-size:var(--font-ui-smaller)}
.tnct-fav-suggest{display:none;position:relative;margin:0 0 4px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);overflow:hidden}
.tnct-fav-suggest-item{display:flex;flex-direction:column;padding:4px 8px;cursor:pointer}
.tnct-fav-suggest-item:hover{background:var(--background-modifier-hover)}
.tnct-dragging{opacity:.45}
.tnct-drag-over-top{box-shadow:inset 0 2px 0 0 var(--color-accent)}
.tnct-drag-over-bottom{box-shadow:inset 0 -2px 0 0 var(--color-accent)}
.tnct-recent-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer}
.tnct-recent-row:hover{background:var(--background-modifier-hover)}
.tnct-recent-row.tnct-recent-confirm{background:var(--background-modifier-error-hover)}
.tnct-recent-name{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tnct-recent-path{font-size:var(--font-ui-smaller);color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tnct-rename-input{width:100%;padding:4px 8px;margin:6px 0}`;
	document.head.appendChild(style);
}

class ReminderModal extends Modal {
	constructor(app, task, day, overdueDay, isOverdue, actions, onClosed) {
		super(app);
		this.task = task;
		this.day = day;
		this.overdueDay = overdueDay;
		this.isOverdue = isOverdue;
		this.actions = actions;
		this.onClosed = onClosed;
		this.resolved = false;
	}

	onEscapeKey(e) {
		// "推迟N天…"输入框激活时，Esc 转发给取消回调而不是关闭弹窗
		//（官方 keymap 在 window 捕获阶段监听 Escape，输入框内的拦截不可达）
		if (this._daysInputActive && typeof this._daysInputCancel === "function") {
			e?.preventDefault?.();
			this._daysInputCancel(); // 内部会清理激活标志
			return;
		}
		super.onEscapeKey(e);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("tnct-modal");
		const high = this.task.priority === HIGH;
		const title = high && this.isOverdue ? "高优先级过期任务提醒" : high ? "高优先级任务提醒" : "过期任务提醒";
		contentEl.createEl("h3", { text: title });
		const row = contentEl.createDiv({ cls: "tnct-float-row" });
		row.createSpan({ cls: "tnct-float-dot" });
		row.createSpan({ cls: "tnct-float-title", text: this.task.title });
		contentEl.createEl("p", {
			cls: this.overdueDay ? "tnct-modal-overdue" : "tnct-modal-date",
			text: this.day
				? this.overdueDay
					? `原定 ${this.day}（已过期）`
					: `提醒日 ${this.day}`
				: "已过期",
		});
		const btns = contentEl.createDiv({ cls: "modal-button-container" });
		const forever = btns.createEl("button", { cls: "mod-warning", text: "彻底关闭" });
		const toFloat = btns.createEl("button", { cls: "mod-cta", text: "普通关闭（保留浮窗）" });
		forever.addEventListener("click", () => {
			this.resolved = true;
			this.actions.forever();
			this.close();
		});
		toFloat.addEventListener("click", () => {
			this.resolved = true;
			this.actions.toFloat();
			this.close();
		});
		if (this.isOverdue) {
			const acts = contentEl.createDiv({ cls: "tnct-float-actions" });
			this.renderOverdueActions(acts);
		}
	}

	renderOverdueActions(acts) {
		// 异步动作失败时不置 resolved：onClose 兜底转浮窗，且周期扫描可补弹
		const runAction = async (fn) => {
			this.resolved = true;
			try {
				const ok = await fn();
				if (ok === false) this.resolved = false;
			} catch (e) {
				this.resolved = false;
			}
			this.close();
		};
		const mk = (text, title, fn) => {
			const b = acts.createEl("button", { text });
			b.title = title;
			b.addEventListener("click", fn);
			return b;
		};
		mk("日期→明天", "任务日期修改到明天", () => runAction(() => this.actions.tomorrow()));
		mk("推迟N天…", "输入自定义天数推迟", () => {
			mountDaysInput(
				acts,
				(n) => runAction(() => this.actions.customDays(n)),
				() => {
					while (acts.firstChild) acts.removeChild(acts.firstChild);
					this.renderOverdueActions(acts);
				},
				this
			);
		});
		mk("标记为已完成", "标记为已完成", () => runAction(() => this.actions.complete()));
	}

	onClose() {
		this.contentEl.empty();
		// Esc / 点击遮罩 = 普通关闭（转浮窗）
		if (!this.resolved) this.actions.toFloat();
		this.onClosed?.();
	}
}

/* ---------- 今日任务清单弹窗 ---------- */

class TodayListModal extends Modal {
	constructor(app, tweaks) {
		super(app);
		this.tweaks = tweaks;
		this.tn = tweaks.tn;
	}

	async onOpen() {
		await this.render();
	}

	onClose() {
		this.contentEl?.empty?.();
		this._confirmDeleteId = null;
		if (this.tweaks) this.tweaks._todayModal = null;
	}

	onEscapeKey(e) {
		// "推迟N天…"输入框激活时，Esc 转发给取消回调而不是关闭清单
		if (this._daysInputActive && typeof this._daysInputCancel === "function") {
			e?.preventDefault?.();
			this._daysInputCancel(); // 内部会清理激活标志
			return;
		}
		super.onEscapeKey(e);
	}

	/* ---------- 每日任务独立栏（置顶，始终可见） ---------- */

	renderDailySection(container) {
		const tweaks = this.tweaks;
		const state = tweaks._daily;
		const today = todayStr();
		const doneIds = state.completions[today] || [];
		const pending = state.items.filter((it) => !doneIds.includes(it.id));
		const doneCount = state.items.length - pending.length;

		const wrap = container.createDiv({ cls: "tnct-daily" });
		const header = wrap.createDiv({ cls: "tnct-today-header" });
		header.createSpan({ text: "每日任务" });
		header.createSpan({
			cls: "tnct-daily-count",
			text: state.items.length ? `　今日已完成 ${doneCount}/${state.items.length}` : "",
		});
		const allBtn = header.createEl("button", { cls: "tnct-daily-all", text: "全部完成" });
		allBtn.disabled = pending.length === 0;
		allBtn.addEventListener("click", async () => {
			if (completeAllDaily(state, today)) await tweaks.persistState();
			await this.render();
		});

		// 内联新建
		const inputRow = wrap.createDiv({ cls: "tnct-daily-inputrow" });
		const input = inputRow.createEl("input", { type: "text", placeholder: "输入标题，回车新建每日任务" });
		const addBtn = inputRow.createEl("button", { text: "添加" });
		addBtn.addEventListener("click", () => this.submitDaily(input));
		input.addEventListener("keydown", (ev) => {
			if (ev.key === "Enter") {
				ev.preventDefault();
				this.submitDaily(input);
			}
		});

		// 未完成条目行（今日已完成的不展示）
		for (const it of pending) {
			const row = wrap.createDiv({ cls: "tnct-today-row" });
			const main = row.createDiv({ cls: "tnct-today-main" });
			const titleLine = main.createDiv({ cls: "tnct-today-title" });
			const dot = titleLine.createSpan({ cls: "tnct-float-dot" });
			dot.style.background = "var(--color-accent)";
			dot.title = "每日任务";
			titleLine.createSpan({ text: it.title });
			const actions = row.createDiv({ cls: "tnct-today-actions" });
			const doneBtn = actions.createEl("button", { text: "完成", title: "今日完成（明天恢复展示）" });
			doneBtn.addEventListener("click", async () => {
				if (completeDailyToday(state, it.id, today)) await tweaks.persistState();
				await this.render();
			});
			const confirming = this._confirmDeleteId === it.id;
			const delBtn = actions.createEl("button", { text: confirming ? "确认删除？" : "删除", cls: confirming ? "mod-warning" : "" });
			delBtn.title = confirming ? "再次点击永久删除" : "永久删除此每日任务";
			delBtn.addEventListener("click", async () => {
				if (this._confirmDeleteId === it.id) {
					this._confirmDeleteId = null;
					if (deleteDailyItem(state, it.id)) await tweaks.persistState();
				} else {
					this._confirmDeleteId = it.id;
				}
				await this.render();
			});
		}
		if (!state.items.length) wrap.createDiv({ cls: "tnct-daily-empty", text: "还没有每日任务，用上方输入框创建" });
	}

	async submitDaily(input) {
		if (this._dailyBusy) return; // 防回车连击重复建项
		const item = addDailyItem(this.tweaks._daily, input.value, todayStr());
		if (!item) {
			input.value = "";
			return;
		}
		input.value = ""; // 立即清空，防 await 窗口内的重复提交
		this._dailyBusy = true;
		try {
			await this.tweaks.persistState();
			await this.render();
		} finally {
			this._dailyBusy = false;
		}
		// 重建后聚焦回输入框，便于连续录入
		const next = this.contentEl?.querySelector?.(".tnct-daily-inputrow input");
		if (next && typeof next.focus === "function") next.focus();
	}

	async render() {
		const el = this.contentEl;
		el.empty();
		el.addClass("tnct-today");
		el.createEl("h3", { text: "今日任务清单" });
		this.renderDailySection(el);
		const seq = (this._renderSeq = (this._renderSeq || 0) + 1);
		let tasks = [];
		try {
			tasks = (await this.tn.cacheManager.getAllTasks()) || [];
		} catch (e) {
			console.error("[TN Calendar Tweaks] load tasks for today list failed:", e);
		}
		if (seq !== this._renderSeq) return; // 并发重入：已有更新的渲染，丢弃过期结果
		const groups = filterTodayTasks(this.tn, tasks, todayStr());
		const totalOpen = groups.overdue.length + groups.todaySched.length + groups.todayDue.length;
		const hasDaily = this.tweaks._daily.items.length > 0;
		if (!totalOpen && !groups.completedToday.length && !hasDaily) {
			el.createEl("p", { cls: "tnct-today-empty", text: "今天没有需要完成的任务" });
			return;
		}
		const section = (title, list, metaOf, cls) => {
			if (!list.length) return;
			const div = el.createDiv({ cls: "tnct-today-section" });
			div.createEl("div", { cls: `tnct-today-header ${cls || ""}`, text: `${title}（${list.length}）` });
			for (const t of list) div.appendChild(this.renderRow(t, metaOf(t)));
		};
		section("过期未完成", groups.overdue, (t) => `原定 ${dayOf(t.scheduled) || dayOf(t.due)}`, "tnct-today-overdue");
		section(
			"计划于今日",
			groups.todaySched,
			(t) => (t.scheduled && t.scheduled.includes("T") ? `今天 ${t.scheduled.split("T")[1]}` : "今天"),
			""
		);
		section(
			"今日截止",
			groups.todayDue,
			(t) => (t.due && t.due.includes("T") ? `今天 ${t.due.split("T")[1]} 截止` : "今天截止"),
			""
		);
		if (groups.completedToday.length) {
			const done = el.createDiv({ cls: "tnct-today-donefoot" });
			done.textContent = `今日已完成 ${groups.completedToday.length} 项`;
		}
	}

	renderRow(task, meta) {
		const tn = this.tn;
		const row = document.createElement("div");
		row.className = "tnct-today-row";

		const main = document.createElement("div");
		main.className = "tnct-today-main";
		const titleLine = document.createElement("div");
		titleLine.className = "tnct-today-title";
		const pri = tn.priorityManager?.getPriorityConfig?.(task.priority);
		if (pri?.color) {
			const dot = document.createElement("span");
			dot.className = "tnct-float-dot";
			dot.style.background = pri.color;
			dot.title = `优先级：${pri.label || task.priority}`;
			titleLine.appendChild(dot);
		}
		const name = document.createElement("span");
		name.textContent = task.title + (task.recurrence ? " ⟳" : "");
		name.title = task.recurrence ? `${task.title}（循环任务，完成按钮针对今日实例）` : task.title;
		titleLine.appendChild(name);
		const metaLine = document.createElement("div");
		metaLine.className = "tnct-today-meta";
		metaLine.textContent = meta;
		main.append(titleLine, metaLine);

		const actions = document.createElement("div");
		actions.className = "tnct-today-actions";
		const mkBtn = (text, title, fn) => {
			const b = document.createElement("button");
			b.textContent = text;
			b.title = title;
			b.addEventListener("click", async () => {
				b.disabled = true;
				try {
					await fn();
				} finally {
					await this.render(); // 动作完成后就地刷新清单
				}
			});
			return b;
		};
		if (!task.recurrence) {
			// 循环任务推迟会改动整个模板日期，不提供推迟按钮
			actions.appendChild(mkBtn("明天", "任务日期修改到明天", () => postponeTask(this.tweaks, task, 1, true)));
			actions.appendChild(
				mkBtn("N天…", "输入自定义天数推迟", () => {
					// 就地将按钮行换成天数输入框；取消/无效输入则还原按钮
					return new Promise((resolve) => {
						const restore = () => {
							while (actions.firstChild) actions.removeChild(actions.firstChild);
							this.mountRowButtons(actions, task);
							resolve();
						};
						mountDaysInput(
							actions,
							(n) => {
								postponeTask(this.tweaks, task, n, true).finally(() => this.render().then(resolve));
							},
							restore,
						this
						);
					});
				})
			);
		}
		actions.appendChild(mkBtn(task.recurrence ? "完成今日" : "完成", "标记为已完成", () => completeByButton(this.tweaks, task)));

		row.append(main, actions);
		return row;
	}

	mountRowButtons(actions, task) {
		const mkBtn = (text, title, fn) => {
			const b = document.createElement("button");
			b.textContent = text;
			b.title = title;
			b.addEventListener("click", async () => {
				b.disabled = true;
				try {
					await fn();
				} finally {
					await this.render(); // 动作完成后就地刷新清单
				}
			});
			return b;
		};
		actions.appendChild(mkBtn("明天", "任务日期修改到明天", () => postponeTask(this.tweaks, task, 1, true)));
		actions.appendChild(
			mkBtn("N天…", "输入自定义天数推迟", () => {
				return new Promise((resolve) => {
					const restore = () => {
						while (actions.firstChild) actions.removeChild(actions.firstChild);
						this.mountRowButtons(actions, task);
						resolve();
					};
					mountDaysInput(
						actions,
						(n) => {
							postponeTask(this.tweaks, task, n, true).finally(() => this.render().then(resolve));
						},
						restore,
					this
					);
				});
			})
		);
		actions.appendChild(mkBtn("完成", "标记为已完成", () => completeByButton(this.tweaks, task)));
	}
}

/* ---------- 最近文件列表弹窗 ---------- */

class RecentFilesModal extends Modal {
	constructor(app, tweaks) {
		super(app);
		this.tweaks = tweaks;
		this._confirmDeletePath = null;
		this._suggest = []; // 搜索建议当前结果
		this._dragPath = null; // 正在拖动的常用文件路径
	}

	onOpen() {
		// Obsidian 的 .modal 自带默认宽度：直接给弹窗容器设宽，否则内容会溢出到弹窗外（真实踩坑）
		try {
			this.modalEl.addClass("tnct-recent-modal");
		} catch (e) {
			this.modalEl?.style?.setProperty?.("width", "min(760px, 94vw)");
		}
		this.render();
	}

	render() {
		const el = this.contentEl;
		el.empty();
		el.addClass("tnct-recent");
		el.createEl("h3", { text: "文件" });
		const cols = el.createDiv({ cls: "tnct-recent-cols" });
		this.renderRecentColumn(cols);
		this.renderFavoritesColumn(cols);
	}

	/* ---------- 左栏：最近 ---------- */

	// 栏标题：图标 + 文字 + 底部分隔线，与文件行拉开层次
	renderColumnTitle(col, text, icon, extraCls) {
		const title = col.createDiv({ cls: `tnct-recent-coltitle ${extraCls}`.trim() });
		const iconEl = title.createSpan({ cls: "tnct-colicon" });
		try {
			setIcon(iconEl, icon);
		} catch (e) {
			iconEl.textContent = icon === "star" ? "★" : "🕘";
		}
		title.createSpan({ text });
	}

	renderRecentColumn(cols) {
		const col = cols.createDiv({ cls: "tnct-recent-col" });
		this.renderColumnTitle(col, "最近", "history", "");
		const list = col.createDiv({ cls: "tnct-recent-list" });
		const app = this.tweaks.app;
		// getLastOpenFiles() 内部把读取数写死为 maxCount:10；直接调底层 getRecentFiles
		// 传大 maxCount——Obsidian 的 lastOpenFiles 存储上限为 md 25 + canvas/图片/其他各 10 条
		let raw = [];
		try {
			raw =
				app.workspace.getRecentFiles?.({
					showMarkdown: true,
					showCanvas: true,
					showNonImageAttachments: true,
					showImages: true,
					maxCount: 60,
				}) || [];
		} catch (e) {
			console.error("[TN Calendar Tweaks] getRecentFiles failed:", e);
		}
		if (!raw.length) raw = app.workspace.getLastOpenFiles?.() || [];
		const paths = sanitizeRecentPaths(raw, (p) => !!app.vault.getAbstractFileByPath(p), RECENT_LIMIT);
		this._lastPaths = paths;
		if (!paths.length) {
			list.createEl("p", { cls: "tnct-today-empty", text: "暂无最近打开的文件" });
			return;
		}
		for (const path of paths) {
			const file = app.vault.getAbstractFileByPath(path);
			// 只处理真实文件：脏数据可能取到文件夹（误删整个文件夹的代价不可接受）
			if (!file || !(file instanceof TFile)) continue;
			list.appendChild(this.renderRow(file, "recent"));
		}
	}

	/* ---------- 右栏：常用 ---------- */

	renderFavoritesColumn(cols) {
		const col = cols.createDiv({ cls: "tnct-recent-col" });
		this.renderColumnTitle(col, "常用", "star", "tnct-title-fav");
		// 搜索添加框 + 建议下拉
		const searchWrap = col.createDiv({ cls: "tnct-fav-searchwrap" });
		const input = searchWrap.createEl("input", { type: "text", placeholder: "搜索文件名添加常用…" });
		this._favInput = input;
		input.addEventListener("input", () => this.renderSuggest(input.value));
		input.addEventListener("keydown", (ev) => {
			if (ev.key === "Enter") {
				ev.preventDefault();
				const first = this._suggest[0];
				if (first) this.addFavorite(first);
			} else if (ev.key === "Escape") {
				ev.preventDefault();
				this.renderSuggest("");
			}
		});
		this._favSuggestEl = searchWrap.createDiv({ cls: "tnct-fav-suggest" });
		this.renderSuggest("");

		const list = col.createDiv({ cls: "tnct-recent-list" });
		const app = this.tweaks.app;
		const favs = (this.tweaks._favorites || []).filter((p) => {
			const f = app.vault.getAbstractFileByPath(p);
			return f && f instanceof TFile; // 已删除/改名的条目保留数据但不显示
		});
		this._favShown = favs;
		if (!favs.length) {
			list.createEl("p", { cls: "tnct-today-empty", text: "右键最近文件或用上方搜索框添加常用" });
			return;
		}
		for (const path of favs) {
			const file = app.vault.getAbstractFileByPath(path);
			list.appendChild(this.renderRow(file, "fav"));
		}
	}

	// 搜索建议：库内 md/canvas 全部文件模糊匹配，排除已在常用中的
	renderSuggest(query) {
		this._favQuery = query || "";
		const box = this._favSuggestEl;
		if (!box) return;
		while (box.firstChild) box.removeChild(box.firstChild);
		if (!query || !query.trim()) {
			this._suggest = [];
			box.style.display = "none";
			return;
		}
		const app = this.tweaks.app;
		let pool = [];
		try {
			// 全部文件类型（md/canvas/图片/附件）；getFiles 不存在时退回 md 列表
			pool = app.vault.getFiles?.() || app.vault.getMarkdownFiles() || [];
		} catch (e) {
			pool = [];
		}
		const exclude = new Set(this.tweaks._favorites || []);
		this._suggest = matchFiles(pool, query, exclude, 8);
		if (!this._suggest.length) {
			box.style.display = "none";
			return;
		}
		box.style.display = "block";
		for (const file of this._suggest) {
			const item = box.createDiv({ cls: "tnct-fav-suggest-item" });
			item.createSpan({ cls: "tnct-recent-name", text: file.name });
			item.createSpan({
				cls: "tnct-recent-path",
				text: file.parent && file.parent.path !== "/" ? file.parent.path : "（根目录）",
			});
			item.addEventListener("click", () => this.addFavorite(file));
		}
	}

	addFavorite(file) {
		const favs = this.tweaks._favorites;
		if (!favs.includes(file.path)) {
			favs.push(file.path);
			this.tweaks.persistState();
			new Notice(`已添加常用：${file.name}`);
		}
		this.render();
		// 重建后恢复搜索词并聚焦，便于连续添加（render 会清空输入框）
		const input = this._favInput;
		if (input) {
			try {
				input.value = this._favQuery || "";
				this.renderSuggest(this._favQuery || "");
				input.focus();
			} catch (e) {
				/* ignore */
			}
		}
	}

	removeFavorite(file) {
		const favs = this.tweaks._favorites;
		const idx = favs.indexOf(file.path);
		if (idx >= 0) {
			favs.splice(idx, 1);
			this.tweaks.persistState();
			new Notice(`已取消常用：${file.name}`);
		}
		this.render();
	}

	/* ---------- 行渲染（两栏共用） ---------- */

	renderRow(file, column) {
		const isFav = column === "fav";
		const row = document.createElement("div");
		row.className = "tnct-recent-row";
		if (this._confirmDeletePath === file.path) row.classList.add("tnct-recent-confirm");

		const main = document.createElement("div");
		main.className = "tnct-today-main";
		const name = document.createElement("div");
		name.className = "tnct-recent-name";
		name.textContent = file.name;
		const dir = document.createElement("div");
		dir.className = "tnct-recent-path";
		dir.textContent = file.parent && file.parent.path !== "/" ? file.parent.path : "（根目录）";
		main.append(name, dir);
		main.title = isFav
			? `${file.path}\n左键打开 · Ctrl+左键新标签页 · 右键菜单 · 拖动排序`
			: `${file.path}\n左键打开 · Ctrl+左键新标签页 · 右键菜单`;
		row.appendChild(main);

		// 删除确认态
		if (this._confirmDeletePath === file.path) {
			const actions = document.createElement("div");
			actions.className = "tnct-today-actions";
			const yes = document.createElement("button");
			yes.textContent = "确认删除";
			yes.className = "mod-warning";
			yes.addEventListener("click", (ev) => {
				ev.stopPropagation();
				this.confirmDelete(file);
			});
			const no = document.createElement("button");
			no.textContent = "取消";
			no.addEventListener("click", (ev) => {
				ev.stopPropagation();
				this._confirmDeletePath = null;
				this.render();
			});
			actions.append(yes, no);
			row.appendChild(actions);
		}

		row.addEventListener("click", (ev) => {
			if (this._dragPath) return; // 拖拽刚结束的点击不触发打开
			if (ev.target?.closest?.("button")) return; // 确认/取消按钮自行处理
			this.openFile(file, ev.ctrlKey || ev.metaKey);
		});
		row.addEventListener("contextmenu", (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
			this.showMenu(ev, file, column);
		});

		if (isFav) {
			row.draggable = true;
			row.addEventListener("dragstart", (ev) => {
				this._dragPath = file.path;
				try {
					ev.dataTransfer?.setData("text/plain", file.path);
					if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
				} catch (e) {
					/* ignore */
				}
				row.classList.add("tnct-dragging");
			});
			row.addEventListener("dragend", () => {
				this._dragPath = null;
				row.classList.remove("tnct-dragging");
				this.render(); // 清除所有插入指示
			});
			row.addEventListener("dragover", (ev) => {
				if (!this._dragPath || this._dragPath === file.path) return;
				ev.preventDefault();
				if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
				// 按指针在行的上半/下半决定插入到前/后
				const rect = row.getBoundingClientRect();
				const before = ev.clientY < rect.top + rect.height / 2;
				row.classList.toggle("tnct-drag-over-top", before);
				row.classList.toggle("tnct-drag-over-bottom", !before);
			});
			row.addEventListener("dragleave", () => {
				row.classList.remove("tnct-drag-over-top", "tnct-drag-over-bottom");
			});
			row.addEventListener("drop", (ev) => {
				ev.preventDefault();
				const rect = row.getBoundingClientRect();
				const before = ev.clientY < rect.top + rect.height / 2;
				row.classList.remove("tnct-drag-over-top", "tnct-drag-over-bottom");
				this.reorderFavorite(this._dragPath, file.path, before);
			});
		}
		return row;
	}

	// 把 dragged 移动到 targetPath 之前/之后
	reorderFavorite(draggedPath, targetPath, before) {
		if (!draggedPath || draggedPath === targetPath) return;
		const favs = this.tweaks._favorites;
		const from = favs.indexOf(draggedPath);
		if (from === -1) return;
		favs.splice(from, 1);
		let to = favs.indexOf(targetPath);
		if (to === -1) {
			favs.splice(from, 0, draggedPath); // 目标不在了：还原
			return;
		}
		if (!before) to += 1;
		favs.splice(to, 0, draggedPath);
		this.tweaks.persistState();
		this._dragPath = null;
		this.render();
	}

	async openFile(file, newTab) {
		try {
			const leaf = this.tweaks.app.workspace.getLeaf(newTab ? "tab" : false);
			await leaf.openFile(file);
			this.close();
		} catch (e) {
			console.error("[TN Calendar Tweaks] open recent file failed:", e);
			new Notice("打开文件失败");
		}
	}

	showMenu(ev, file, column) {
		const menu = new Menu();
		if (column === "fav") {
			menu.addItem((item) =>
				item
					.setTitle("取消常用")
					.setIcon("star")
					.onClick(() => this.removeFavorite(file))
			);
		}
		menu.addItem((item) =>
			item
				.setTitle("重命名")
				.setIcon("pencil")
				.onClick(() => new RenameModal(this.app, this, file).open())
		);
		menu.addItem((item) =>
			item
				.setTitle("复制双向链接")
				.setIcon("brackets")
				.onClick(() => this.copyRecentLink(file))
		);
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("删除此文件")
				.setIcon("trash")
				.onClick(() => {
					this._confirmDeletePath = file.path;
					this.render();
				})
		);
		if (column === "recent") {
			const favs = this.tweaks._favorites || [];
			const isFav = favs.includes(file.path);
			menu.addSeparator();
			menu.addItem((item) =>
				item
					.setTitle(isFav ? "★ 已在常用（点击移除）" : "⭐ 添加到常用")
					.setIcon("star")
					.onClick(() => (isFav ? this.removeFavorite(file) : this.addFavorite(file)))
			);
		}
		menu.showAtMouseEvent(ev);
	}

	async copyRecentLink(file) {
		try {
			const link = `[[${recentLinkName(file)}]]`;
			await navigator.clipboard.writeText(link);
			new Notice(`已复制：${link}`);
			return true;
		} catch (e) {
			console.error("[TN Calendar Tweaks] copy link failed:", e);
			new Notice("复制失败");
			return false;
		}
	}

	async confirmDelete(file) {
		try {
			// 系统回收站；失败时 Obsidian 自动回落到库内 .trash
			await this.tweaks.app.vault.trash(file, true);
			new Notice(`已移入回收站：${file.name}`);
		} catch (e) {
			console.error("[TN Calendar Tweaks] trash file failed:", e);
			new Notice("删除失败（文件仍在原处）");
		}
		this._confirmDeletePath = null;
		this.render();
	}

	onClose() {
		this.contentEl?.empty?.();
		if (this.tweaks) this.tweaks._recentModal = null;
	}
}

/* ---------- 最近文件：重命名弹窗 ---------- */

class RenameModal extends Modal {
	constructor(app, recent, file) {
		super(app);
		this.recent = recent;
		this.file = file;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("tnct-rename");
		contentEl.createEl("h3", { text: "重命名文件" });
		contentEl.createEl("p", { cls: "tnct-modal-date", text: this.file.path });
		const input = contentEl.createEl("input", { type: "text", value: this.file.name, cls: "tnct-rename-input" });
		const btns = contentEl.createDiv({ cls: "modal-button-container" });
		btns.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
		const ok = btns.createEl("button", { cls: "mod-cta", text: "重命名" });
		ok.addEventListener("click", () => this.submitRename(input.value));
		input.addEventListener("keydown", (ev) => {
			if (ev.key === "Enter") {
				ev.preventDefault();
				this.submitRename(input.value);
			}
		});
		window.setTimeout(() => {
			try {
				input.focus();
				input.select();
			} catch (e) {
				/* ignore */
			}
		}, 50);
	}

	async submitRename(value) {
		if (this._busy) return false; // 防回车连击导致对已失效的文件引用重复改名
		this._busy = true;
		try {
			const res = buildRenameTarget(this.file, value);
			if (!res.ok) {
				new Notice(res.reason);
				return false;
			}
			if (res.target === this.file.path) return this.close();
			const app = this.recent.tweaks.app;
			if (app.vault.getAbstractFileByPath(res.target)) {
				new Notice("同名文件已存在");
				return false;
			}
			try {
				// renameFile 会自动更新全库双向链接
				await app.fileManager.renameFile(this.file, res.target);
				new Notice(`已重命名为：${res.target.split("/").pop()}`);
				this.close();
				return true;
			} catch (e) {
				console.error("[TN Calendar Tweaks] rename failed:", e);
				new Notice("重命名失败");
				return false;
			}
		} finally {
			this._busy = false;
		}
	}

	onClose() {
		this.contentEl?.empty?.();
		// 重命名弹窗关闭后刷新底下的列表（仅在列表仍打开时）
		if (this.recent && this.recent.tweaks?._recentModal === this.recent) this.recent.render();
	}
}

function buildFloatEl(tweaks, path, task, entry) {
	const el = document.createElement("div");
	el.className = "tnct-float";
	const pos = clampFloatPos(entry.float); // 恢复时钳制到当前视口，防止换显示器后浮窗不可达
	el.style.left = `${pos.x}px`;
	el.style.top = `${pos.y}px`;
	const row = document.createElement("div");
	row.className = "tnct-float-row";
	const dot = document.createElement("span");
	dot.className = "tnct-float-dot";
	const title = document.createElement("span");
	title.className = "tnct-float-title";
	title.textContent = task.title;
	title.title = `${task.title}（点击编辑，拖动移动）`;
	const close = document.createElement("span");
	close.className = "tnct-float-close";
	close.textContent = "×";
	close.title = "彻底关闭提醒";
	row.append(dot, title, close);
	el.appendChild(row);

	close.addEventListener("pointerdown", (ev) => ev.stopPropagation());
	close.addEventListener("click", (ev) => {
		ev.stopPropagation();
		tweaks.dismissForever(path);
	});

	// 过期任务：第二行三个处理按钮
	if (isOverdueTask(tweaks.tn, task)) {
		const acts = document.createElement("div");
		acts.className = "tnct-float-actions";
		acts.addEventListener("pointerdown", (ev) => ev.stopPropagation());
		const renderButtons = () => {
			while (acts.firstChild) acts.removeChild(acts.firstChild);
			const bTom = document.createElement("button");
			bTom.textContent = "明天";
			bTom.title = "日期修改到明天";
			const bDays = document.createElement("button");
			bDays.textContent = "N天…";
			bDays.title = "输入自定义天数推迟";
			const bDone = document.createElement("button");
			bDone.textContent = "完成";
			bDone.title = "标记为已完成";
			bTom.addEventListener("click", (ev) => {
				ev.stopPropagation();
				postponeTask(tweaks, task, 1);
			});
			bDays.addEventListener("click", (ev) => {
				ev.stopPropagation();
				mountDaysInput(
					acts,
					(n) => postponeTask(tweaks, task, n),
					renderButtons
				);
			});
			bDone.addEventListener("click", (ev) => {
				ev.stopPropagation();
				completeByButton(tweaks, task);
			});
			acts.append(bTom, bDays, bDone);
		};
		renderButtons();
		el.appendChild(acts);
	}

	// 整卡可拖；位移 <4px 视为轻点 → 打开编辑弹窗
	el.addEventListener("pointerdown", (ev) => {
		if (ev.button !== 0) return;
		const pid = ev.pointerId;
		const startX = ev.clientX;
		const startY = ev.clientY;
		const origL = el.offsetLeft;
		const origT = el.offsetTop;
		let moved = false;
		const cleanup = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("pointercancel", up);
			try {
				el.releasePointerCapture?.(pid);
			} catch (e) {
				/* ignore */
			}
		};
		const move = (e2) => {
			if (e2.pointerId !== pid) return; // 忽略第二指针（触屏/数位板）
			if (e2.buttons === 0) {
				cleanup(); // 拖出窗口外释放时收不到 pointerup，靠按键状态自愈
				return;
			}
			const dx = e2.clientX - startX;
			const dy = e2.clientY - startY;
			if (!moved && Math.hypot(dx, dy) < 4) return;
			moved = true;
			el.style.left = `${origL + dx}px`;
			el.style.top = `${origT + dy}px`;
		};
		const up = (e2) => {
			if (e2.pointerId !== pid) return;
			cleanup();
			if (moved) tweaks.saveFloatPos(path, el);
			else
				Promise.resolve(tweaks.tn.openTaskEditModal(task)).catch((e) => {
					console.error("[TN Calendar Tweaks] open edit modal failed:", e);
					new Notice("打开任务编辑弹窗失败");
				});
		};
		try {
			el.setPointerCapture?.(pid); // 捕获指针：拖出窗口外释放也能收到 pointerup
		} catch (e) {
			/* ignore */
		}
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		window.addEventListener("pointercancel", up);
	});

	return el;
}

// 同时满足加载器的两种导出检测（module.exports.default || module.exports）
module.exports.default = module.exports;

// 供冒烟测试直接验证内部纯逻辑（生产代码不使用）
module.exports.__test = {
	isOverdueTask,
	isActiveTask,
	isArmableTask,
	filterTodayTasks,
	reminderDayOf,
	postponeTask,
	completeByButton,
	todayStr,
	sanitizeDailyState,
	pruneCompletions,
	addDailyItem,
	completeDailyToday,
	completeAllDaily,
	deleteDailyItem,
	sanitizeRecentPaths,
	recentLinkName,
	buildRenameTarget,
	sanitizeReminderState,
	overdueDayOf,
	normalizeFavorites,
	matchFiles,
};
