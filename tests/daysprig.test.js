const { __test } = require("../src/companion/daysprig-enhancements.js");

describe("DaySprig data helpers", () => {
	test("cleans daily state and keeps valid completions", () => {
		const state = __test.sanitizeDailyState({
			items: [{ id: "a", title: "Read" }, { id: "bad", title: "" }],
			completions: { "2026-10-04": ["a", 4], invalid: ["x"] },
		});
		expect(state.items).toHaveLength(1);
		expect(state.completions["2026-10-04"]).toEqual(["a"]);
		expect(state.completions.invalid).toBeUndefined();
	});

	test("normalizes favorite paths without reordering", () => {
		expect(__test.normalizeFavorites(["a.md", "a.md", 4, "b.md"])).toEqual(["a.md", "b.md"]);
	});

	test("identifies overdue incomplete non-recurring tasks", () => {
		const tn = { statusManager: { isCompletedStatus: (status) => status === "done" } };
		expect(__test.isOverdueTask(tn, { status: "open", due: "2020-01-01" })).toBe(true);
		expect(__test.isOverdueTask(tn, { status: "done", due: "2020-01-01" })).toBe(false);
		expect(__test.isOverdueTask(tn, { status: "open", recurrence: "FREQ=DAILY", due: "2020-01-01" })).toBe(false);
	});
});
