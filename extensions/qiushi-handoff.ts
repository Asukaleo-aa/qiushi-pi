/**
 * Qiushi Handoff Extension
 *
 * 从 Pi 官方 handoff example 吸入。环节间上下文浓缩传递。
 * qiushi 适配：自动注入当前认知环状态（环节、出口数据、主要矛盾等）
 * 到 handoff 提示词中，确保环节转移时关键判断不丢失。
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { complete, type Message } from "@earendil-works/pi-ai";
import type { ExtensionAPI, SessionEntry } from "@earendil-works/pi-coding-agent";
import { BorderedLoader, convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

const SYSTEM_PROMPT = `You are a context transfer assistant for a cognitive-loop coding agent (求是系统工程方法论).
Given a conversation history and the user's goal for a new thread, generate a focused prompt that:

1. Summarizes relevant context from the conversation (decisions made, approaches taken, key findings)
2. Lists any relevant files that were discussed or modified
3. If cognitive phase data is present, include it: current phase, essence, main contradiction, solution
4. Clearly states the next task based on the user's goal
5. Is self-contained - the new thread should be able to proceed without the old conversation

Format your response as a prompt the user can send to start the new thread. Be concise. No preamble.`;

function entryToMessage(entry: SessionEntry): AgentMessage | undefined {
	if (entry.type === "message") return entry.message;
	if (entry.type === "compaction") {
		return {
			role: "compactionSummary",
			summary: entry.summary,
			tokensBefore: entry.tokensBefore,
			timestamp: new Date(entry.timestamp).getTime(),
		};
	}
	return undefined;
}

function getHandoffMessages(branch: SessionEntry[]): AgentMessage[] {
	let compactionIndex = -1;
	for (let i = branch.length - 1; i >= 0; i--) {
		if (branch[i].type === "compaction") { compactionIndex = i; break; }
	}
	if (compactionIndex < 0) {
		return branch.map(entryToMessage).filter((m) => m !== undefined);
	}
	const compaction = branch[compactionIndex];
	const firstKeptIndex = compaction.type === "compaction"
		? branch.findIndex((entry) => entry.id === compaction.firstKeptEntryId)
		: -1;
	const compactedBranch = [
		compaction,
		...(firstKeptIndex >= 0 ? branch.slice(firstKeptIndex, compactionIndex) : []),
		...branch.slice(compactionIndex + 1),
	];
	return compactedBranch.map(entryToMessage).filter((m) => m !== undefined);
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("handoff", {
		description: "浓缩当前上下文到新会话（支持 qiushi 认知环状态注入）",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("handoff 需要交互模式", "error");
				return;
			}
			if (!ctx.model) {
				ctx.ui.notify("未选择模型", "error");
				return;
			}

			const goal = args?.trim() || "";
			if (!goal) {
				ctx.ui.notify("用法: /handoff <新会话目标>", "error");
				return;
			}

			const messages = getHandoffMessages(ctx.sessionManager.getBranch());
			if (messages.length === 0) {
				ctx.ui.notify("没有可传递的对话内容", "error");
				return;
			}

			const llmMessages = convertToLlm(messages);
			const conversationText = serializeConversation(llmMessages);
			const currentSessionFile = ctx.sessionManager.getSessionFile();

			// qiushi: 扫描会话中最近的认知状态，注入到 handoff 上下文
			const qiushiStateHint = extractQiushiState(messages);

			const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
				const loader = new BorderedLoader(tui, theme, "正在生成 handoff 提示词…");
				loader.onAbort = () => done(null);

				const doGenerate = async () => {
					const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model!);
					if (!auth.ok || !auth.apiKey) {
						throw new Error(auth.ok ? `缺少 ${ctx.model!.provider} API Key` : auth.error);
					}

					const stateBlock = qiushiStateHint
						? `\n\n## Qiushi Cognitive State\n${qiushiStateHint}`
						: "";

					const userMessage: Message = {
						role: "user",
						content: [{
							type: "text",
							text: `## Conversation History\n\n${conversationText}${stateBlock}\n\n## User's Goal for New Thread\n\n${goal}`,
						}],
						timestamp: Date.now(),
					};

					const response = await complete(
						ctx.model!,
						{ systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
						{ apiKey: auth.apiKey, headers: auth.headers, signal: loader.signal },
					);

					if (response.stopReason === "aborted") return null;
					return response.content
						.filter((c): c is { type: "text"; text: string } => c.type === "text")
						.map((c) => c.text)
						.join("\n");
				};

				doGenerate().then(done).catch((err) => {
					console.error("Handoff 生成失败:", err);
					done(null);
				});
				return loader;
			});

			if (result === null) {
				ctx.ui.notify("已取消", "info");
				return;
			}

			const editedPrompt = await ctx.ui.editor("编辑 handoff 提示词", result);
			if (editedPrompt === undefined) {
				ctx.ui.notify("已取消", "info");
				return;
			}

			const newSessionResult = await ctx.newSession({
				parentSession: currentSessionFile,
				withSession: async (replacementCtx) => {
					replacementCtx.ui.setEditorText(editedPrompt);
					replacementCtx.ui.notify("Handoff 就绪。提交即可开始新会话。", "info");
				},
			});

			if (newSessionResult.cancelled) {
				ctx.ui.notify("新会话已取消", "info");
			}
		},
	});
}

/**
 * 从会话条目中提取最近的 qiushi 认知状态 JSON。
 * 用于在 handoff 时注入关键判断信息。
 */
function extractQiushiState(messages: AgentMessage[]): string | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i];
		if (m.role === "system" && Array.isArray(m.content)) {
			for (const part of m.content) {
				if (part.type === "text" && part.text.includes('"qiushi-cognitive-state"')) {
					try {
						const json = JSON.parse(part.text);
						const phase = json.phase;
						const exits = json.phaseExits;
						if (!phase) continue;
						const lines = [
							`认知环节: ${phase}`,
							`深度等级: ${json.depth}`,
							`系统层次: ${json.hierarchy}`,
						];
						if (exits?.essence) lines.push(`问题本质: ${exits.essence}`);
						if (exits?.mainContradiction) lines.push(`主要矛盾: ${exits.mainContradiction}`);
						if (exits?.solution) lines.push(`当前解: ${exits.solution}`);
						if (exits?.bottleneckConstraint) lines.push(`瓶颈约束: ${exits.bottleneckConstraint}`);
						return lines.join("\n");
					} catch { continue; }
				}
			}
		}
	}
	return null;
}
