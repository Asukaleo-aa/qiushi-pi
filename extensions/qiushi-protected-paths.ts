/**
 * Qiushi Protected Paths Extension
 *
 * 从 Pi 官方 protected-paths example 吸入，阻止对敏感路径的写入。
 * 与 qiushi 约束引擎正交：此扩展提供路径级防护（永远生效，不受环节影响），
 * qiushi constraint-engine 提供环节级防护（感知环禁止写入，执行环放开）。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const protectedPaths = [
		".env",
		".env.local",
		".env.production",
		".git/",
		"node_modules/",
		"credentials.json",
		"secrets/",
		".pi/settings.json",
		"~/.pi/agent/settings.json",
	];

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "write" && event.toolName !== "edit") {
			return undefined;
		}

		const path = (event.input.path as string) || "";
		const isProtected = protectedPaths.some((p) => path.includes(p));

		if (isProtected) {
			if (ctx.hasUI) {
				ctx.ui.notify(`🛡️ 阻止写入受保护路径：${path}`, "warning");
			}
			return { block: true, reason: `路径 "${path}" 受保护，不可写入` };
		}

		return undefined;
	});
}
