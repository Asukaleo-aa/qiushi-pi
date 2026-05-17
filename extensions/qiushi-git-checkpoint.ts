/**
 * Qiushi Git Checkpoint Extension
 *
 * 从 Pi 官方 git-checkpoint example 吸入，每轮自动 git stash 创建回退点。
 * qiushi 适配：在校验/修正环节，checkpoint 与 feedback-and-revision-loop 联动，
 * 偏差检测后提供「回到 checkpoint N」的选项。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const checkpoints = new Map<string, string>();
	let currentEntryId: string | undefined;

	pi.on("tool_result", async (_event, ctx) => {
		const leaf = ctx.sessionManager.getLeafEntry();
		if (leaf) currentEntryId = leaf.id;
	});

	pi.on("turn_start", async () => {
		const { stdout } = await pi.exec("git", ["stash", "create"]);
		const ref = stdout.trim();
		if (ref && currentEntryId) {
			checkpoints.set(currentEntryId, ref);
		}
	});

	pi.on("session_before_fork", async (event, ctx) => {
		const ref = checkpoints.get(event.entryId);
		if (!ref) return;

		if (!ctx.hasUI) return;

		const choice = await ctx.ui.select("恢复代码状态？", [
			"是，恢复到该检查点",
			"否，保持当前代码",
		]);

		if (choice?.startsWith("是")) {
			await pi.exec("git", ["stash", "apply", ref]);
			ctx.ui.notify("代码已恢复到检查点", "info");
		}
	});

	pi.on("agent_end", async () => {
		checkpoints.clear();
	});
}
