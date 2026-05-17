/**
 * 求是认知环 —— Pi 扩展入口 v1.2
 *
 * 将求是系统工程方法论的七环认知闭环嵌入 Pi 的运行时事件循环。
 *
 * 环节推进模式（两种）：
 *   - 手动确认（默认）：LLM 调用 assess_phase 提议 → 弹窗让用户确认 → 推进
 *   - 自动批准：LLM 调用 assess_phase 提议 → 直接推进（仅通知）
 *
 * 切换：/auto-approve on|off
 *
 * 安装：pi install qiushi-pi
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";

import {
  type CognitiveState,
  type CognitivePhase,
  PHASE_LABELS,
  PHASE_SKILLS,
} from "./types";
import {
  saveState,
  loadState,
  advancePhase,
  retreatPhase,
  setPhase,
  setDepth,
  setHierarchy,
} from "./state-machine";
import { generatePhaseContext } from "./phase-context";
import { checkToolPermission, formatBlockNotification } from "./constraint-engine";

// ─── 全局状态 ───────────────────────────────────────────

let cognitiveState: CognitiveState | null = null;

/** 环节推进模式：false=手动确认，true=自动批准 */
let autoApproveMode = false;

/** 本轮是否已调用过 assess_phase */
let assessCalledThisTurn = false;

/** 状态是否有未持久化的变更 */
let stateDirty = false;

/** 是否需要在下轮注入 assess_phase 提醒（上轮未调用） */
let remindAssess = false;

// ─── 模型预设自动切换 ───────────────────────────────────

const PHASE_MODEL_PRESET: Record<CognitivePhase, string> = {
  perceive:    "deepseek/deepseek-v4-flash",
  understand:  "deepseek/deepseek-v4-pro",
  model:       "deepseek/deepseek-v4-pro",
  solve:       "deepseek/deepseek-v4-pro",
  execute:     "deepseek/deepseek-v4-flash",
  verify:      "deepseek/deepseek-v4-flash",
  correct:     "deepseek/deepseek-v4-pro",
};

const VALID_PHASES = ["perceive", "understand", "model", "solve", "execute", "verify", "correct"];

function switchModelForPhase(pi: ExtensionAPI, phase: CognitivePhase): void {
  pi.sendUserMessage(`/preset qiushi-${phase}`, { deliverAs: "followUp" });
}

function doAdvancePhase(pi: ExtensionAPI): CognitivePhase {
  cognitiveState = advancePhase(cognitiveState!);
  const newPhase = cognitiveState.phase;
  stateDirty = true;
  switchModelForPhase(pi, newPhase);
  return newPhase;
}

// ─── 入口 ───────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ═══════════════════════════════════════════════════════
  // 1. 会话生命周期
  // ═══════════════════════════════════════════════════════

  pi.on("session_start", async (_event, ctx) => {
    cognitiveState = await loadState(pi, ctx);
    ctx.ui.notify(
      `求是认知环已启动 | ${PHASE_LABELS[cognitiveState.phase].emoji} ${PHASE_LABELS[cognitiveState.phase].cn}` +
      ` | ${autoApproveMode ? "自动批准" : "手动确认"}`,
      "info",
    );
    ctx.ui.setStatus("qiushi", formatStatusBar());
    ctx.ui.setWidget("qiushi", buildPhaseWidget());
  });

  pi.on("session_shutdown", async () => {
    cognitiveState = null;
  });

  // ═══════════════════════════════════════════════════════
  // 2. 每次 Agent 启动前：注入认知环上下文 + 自我评估提示
  // ═══════════════════════════════════════════════════════

  // 监听每轮开始，重置 assess_phase 调用标记
  pi.on("turn_start", async () => {
    assessCalledThisTurn = false;
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (!cognitiveState) return;

    let extraContext = "";

    // 上轮未调用 assess_phase → 注入醒目提醒
    if (remindAssess) {
      extraContext = [
        "",
        "⚠️⚠️⚠️ 环节评估缺失警告 ⚠️⚠️⚠️",
        `上轮未调用 assess_phase 工具。当前仍处于「${PHASE_LABELS[cognitiveState.phase].cn}」环节。`,
        "在本轮完成工作前，必须调用 assess_phase 评估当前环节是否已完成。",
        "不要跳过这一步——它决定了认知环能否正常流转。",
        "",
      ].join("\n");
      remindAssess = false;
    }

    const phaseContext = generatePhaseContext(cognitiveState, autoApproveMode);
    event.injectSystemMessage?.(extraContext + "\n" + phaseContext);

    ctx.ui.setStatus("qiushi", formatStatusBar());
    ctx.ui.setWidget("qiushi", buildPhaseWidget());
  });

  // ═══════════════════════════════════════════════════════
  // 3. 工具调用拦截：环节权限约束
  // ═══════════════════════════════════════════════════════

  pi.on("tool_call", async (event, ctx) => {
    if (!cognitiveState) return;

    const check = checkToolPermission(
      event.toolName,
      event.input as Record<string, unknown>,
      cognitiveState,
    );

    switch (check.action) {
      case "block":
        ctx.ui.notify(formatBlockNotification(event.toolName, cognitiveState.phase, check.reason ?? ""), "error");
        return { block: true, reason: check.reason ?? `工具 ${event.toolName} 在当前认知环节被阻止` };
      case "confirm": {
        const ok = await ctx.ui.confirm("认知环约束", check.reason ?? "当前环节对此操作有限制，确认继续？");
        if (!ok) return { block: true, reason: "用户拒绝了在当前环节执行此操作" };
        break;
      }
      case "warn":
        ctx.ui.notify(check.reason ?? "当前环节对此操作有限制", "warning");
        break;
      default:
        break;
    }
  });

  // ═══════════════════════════════════════════════════════
  // 4. 轮次结束：状态持久化 + assess_phase 遗漏检测
  // ═══════════════════════════════════════════════════════

  pi.on("turn_end", async (_event, ctx) => {
    if (!cognitiveState) return;

    // 只在实际变更时持久化，避免冗余条目
    if (stateDirty) {
      await saveState(pi, cognitiveState);
      stateDirty = false;
    }

    // 如果本轮未调用 assess_phase，下轮注入提醒
    if (!assessCalledThisTurn) {
      remindAssess = true;
    }

    ctx.ui.setStatus("qiushi", formatStatusBar());
  });

  // ═══════════════════════════════════════════════════════
  // 5. assess_phase 工具 —— 环节自我评估与推进
  // ═══════════════════════════════════════════════════════

  const ExitDataSchema = Type.Object({
    facts: Type.Optional(Type.Array(Type.String())),
    knowledgeGaps: Type.Optional(Type.Array(Type.String())),
    essence: Type.Optional(Type.String()),
    mainContradiction: Type.Optional(Type.String()),
    contradictionBasis: Type.Optional(Type.String()),
    modelDescription: Type.Optional(Type.String()),
    modelLimitations: Type.Optional(Type.String()),
    solution: Type.Optional(Type.String()),
    bottleneckConstraint: Type.Optional(Type.String()),
  });

  pi.registerTool({
    name: "assess_phase",
    label: "评估环节",
    description:
      "评估当前认知环节是否已完成。在完成本轮所有工具调用后，反思当前环节的出口条件是否满足。" +
      "如果满足，提议推进到下一环节；如果不满足，说明还需要做什么。" +
      `当前模式：${autoApproveMode ? "自动批准（提议通过即推进）" : "手动确认（提议后需用户确认）"}。`,
    parameters: Type.Object({
      ready: Type.Boolean({ description: "出口条件是否已满足？true=可以推进，false=继续当前环节" }),
      reasoning: Type.String({ description: "判断依据。列出已满足和未满足的条件" }),
      nextPhase: Type.Optional(Type.String({ description: "如果推进，目标环节名称。不填则自动按顺序推进" })),
      exitData: Type.Optional(ExitDataSchema, { description: "当前环节的出口数据，用于持久化" }),
    }),
    required: ["ready", "reasoning"],

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!cognitiveState) {
        return { content: [{ type: "text", text: "认知环未初始化" }], details: {} };
      }

      assessCalledThisTurn = true;

      const ready = params.ready === true;
      const reasoning = String(params.reasoning ?? "");

      // ── 不满足：继续当前环节 ──
      if (!ready) {
        return {
          content: [{ type: "text", text: `⏸️ 继续「${PHASE_LABELS[cognitiveState.phase].cn}」环节。\n理由：${reasoning}` }],
          details: { ready: false, phase: cognitiveState.phase },
        };
      }

      // ── 满足：保存出口数据 ──
      if (params.exitData) {
        applyExitData(cognitiveState, params.exitData);
        stateDirty = true;
      }

      // ── 自动批准模式 ──
      if (autoApproveMode) {
        const newPhase = doAdvancePhase(pi);
        ctx.ui.notify(
          `⚡ 自动推进：${PHASE_LABELS[cognitiveState.phase].emoji} ${PHASE_LABELS[cognitiveState.phase].cn}`,
          "success",
        );
        return {
          content: [{
            type: "text",
            text: `✅ 已自动推进到「${PHASE_LABELS[newPhase].cn}」环节。\n理由：${reasoning}`,
          }],
          details: { ready: true, previousPhase: cognitiveState.phaseHistory.slice(-2, -1)[0]?.phase, newPhase },
        };
      }

      // ── 手动确认模式 ──
      const targetLabel = params.nextPhase
        ? (PHASE_LABELS[params.nextPhase as CognitivePhase]?.cn ?? params.nextPhase)
        : "下一环节";

      const confirmed = await ctx.ui.confirm(
        "环节推进确认",
        `模型提议推进到「${targetLabel}」环节。\n\n理由：${reasoning}\n\n确认推进吗？`,
      );

      if (!confirmed) {
        return {
          content: [{ type: "text", text: `⏸️ 用户拒绝推进，继续「${PHASE_LABELS[cognitiveState.phase].cn}」环节。` }],
          details: { ready: true, rejected: true, phase: cognitiveState.phase },
        };
      }

      const newPhase = doAdvancePhase(pi);
      ctx.ui.notify(
        `✅ 已推进：${PHASE_LABELS[cognitiveState.phase].emoji} ${PHASE_LABELS[cognitiveState.phase].cn}`,
        "success",
      );
      return {
        content: [{
          type: "text",
          text: `✅ 已推进到「${PHASE_LABELS[newPhase].cn}」环节。\n理由：${reasoning}`,
        }],
        details: { ready: true, newPhase },
      };
    },

    renderCall(args, theme, _context) {
      const ready = args.ready ? "✓ 可推进" : "⏸ 继续";
      return new Text(theme.fg("toolTitle", theme.bold("assess_phase ")) + theme.fg("muted", `${ready}`), 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as Record<string, unknown> | undefined;
      const txt = result.content?.[0]?.type === "text" ? result.content[0].text : "";
      const icon = details?.rejected ? theme.fg("warning", "⏸") : details?.ready ? theme.fg("success", "✅") : theme.fg("muted", "⏸");
      return new Text(`${icon} ${txt.slice(0, 80)}`, 0, 0);
    },
  });

  // ═══════════════════════════════════════════════════════
  // 6. 用户命令
  // ═══════════════════════════════════════════════════════

  // /auto-approve —— 切换自动批准模式
  pi.registerCommand("auto-approve", {
    description: "切换环节推进模式。用法：/auto-approve [on|off]",
    async handler(args, ctx) {
      const sub = args?.trim().toLowerCase() ?? "";
      if (sub === "on" || sub === "1" || sub === "true") {
        autoApproveMode = true;
        ctx.ui.notify("⚡ 环节推进模式：自动批准（模型判断满足即推进）", "success");
      } else if (sub === "off" || sub === "0" || sub === "false") {
        autoApproveMode = false;
        ctx.ui.notify("👆 环节推进模式：手动确认（模型提议后需用户确认）", "info");
      } else {
        ctx.ui.notify(
          `当前模式：${autoApproveMode ? "自动批准" : "手动确认"}。用法：/auto-approve on|off`,
          "info",
        );
      }
    },
  });

  // /phase —— 查看或管理认知环状态
  pi.registerCommand("phase", {
    description: "查看或管理认知环状态。用法：/phase [status|advance|back|set <环节名>|reset]",
    async handler(args, ctx) {
      if (!cognitiveState) { ctx.ui.notify("认知环未初始化", "error"); return; }

      const sub = args?.trim() ?? "status";

      if (sub === "status" || sub === "") {
        showFullStatus(ctx);
      } else if (sub === "advance") {
        const newPhase = doAdvancePhase(pi);
        ctx.ui.notify(`推进到 ${PHASE_LABELS[newPhase].emoji} ${PHASE_LABELS[newPhase].cn}`, "success");
      } else if (sub === "back") {
        cognitiveState = retreatPhase(cognitiveState);
        stateDirty = true;
        switchModelForPhase(pi, cognitiveState.phase);
        ctx.ui.notify(`回退到 ${PHASE_LABELS[cognitiveState.phase].emoji} ${PHASE_LABELS[cognitiveState.phase].cn}`, "warning");
      } else if (sub === "reset") {
        cognitiveState = {
          ...cognitiveState, phase: "perceive",
          phaseExits: {
            facts: [], knowledgeGaps: [], reliableSources: [],
            essence: "", mainContradiction: "", contradictionBasis: "",
            keyAssumptions: [], modelDescription: "", modelLimitations: "",
            solution: "", bottleneckConstraint: "", solutionAssumptions: [],
            tasksCompleted: [], milestonesReached: [], deviations: [], deviationDepth: null,
          },
        };
        stateDirty = true;
        switchModelForPhase(pi, "perceive");
        ctx.ui.notify("认知环已重置到感知环节", "success");
      } else if (sub.startsWith("set ")) {
        const phaseName = sub.slice(4).trim();
        if (VALID_PHASES.includes(phaseName)) {
          cognitiveState = setPhase(cognitiveState, phaseName as CognitivePhase);
          stateDirty = true;
          switchModelForPhase(pi, cognitiveState.phase);
          ctx.ui.notify(`已设置环节为 ${phaseName}`, "success");
        } else {
          ctx.ui.notify(`无效环节名：${phaseName}。有效值：${VALID_PHASES.join(", ")}`, "error");
        }
      } else {
        ctx.ui.notify(`未知子命令：${sub}。可用：status, advance, back, set, reset`, "error");
      }
    },
  });

  // /depth —— 设置深度等级
  pi.registerCommand("depth", {
    description: "设置认知环深度等级。用法：/depth <0-4>",
    async handler(args, ctx) {
      if (!cognitiveState) return;
      const d = parseInt(args?.trim() ?? "", 10);
      if (d >= 0 && d <= 4) {
        cognitiveState = setDepth(cognitiveState, d as 0 | 1 | 2 | 3 | 4);
        stateDirty = true;
        ctx.ui.notify(`深度等级已设置为 ${d}`, "success");
      } else { ctx.ui.notify("深度等级需在 0-4 之间", "error"); }
    },
  });

  // /hierarchy —— 设置系统层次
  pi.registerCommand("hierarchy", {
    description: "设置系统层次。用法：/hierarchy <physical|engineering|product|socio-technical>",
    async handler(args, ctx) {
      if (!cognitiveState) return;
      const h = args?.trim() ?? "";
      const valid = ["physical", "engineering", "product", "socio-technical"];
      if (valid.includes(h)) {
        cognitiveState = setHierarchy(cognitiveState, h as SystemHierarchy);
        stateDirty = true;
        ctx.ui.notify(`系统层次已设置为 ${h}`, "success");
      } else { ctx.ui.notify(`无效层次。有效值：${valid.join(", ")}`, "error"); }
    },
  });

  // ═══════════════════════════════════════════════════════
  // 7. load_qiushi_skill 工具
  // ═══════════════════════════════════════════════════════

  pi.registerTool({
    name: "load_qiushi_skill",
    label: "加载求是技能",
    description:
      "按需加载一个求是系统工程方法论技能的完整内容。只在需要技能的具体指导时调用。" +
      "可用技能列表会在每个认知环节的上下文中列出。",
    parameters: {
      type: "object",
      properties: { skillName: { type: "string", description: "技能名称，如 investigation-first, contradiction-analysis 等" } },
      required: ["skillName"],
    },
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const skillName = String(params.skillName ?? "");
      try {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const skillsDir = path.resolve(__dirname, "../../skills", skillName);
        const skillPath = path.join(skillsDir, "SKILL.md");
        let content: string;
        try { content = await fs.readFile(skillPath, "utf-8"); } catch {
          return { content: [{ type: "text", text: `技能 "${skillName}" 未找到。` }], details: {} };
        }
        return { content: [{ type: "text", text: content }], details: { skillName } };
      } catch (err) {
        return { content: [{ type: "text", text: `加载技能 "${skillName}" 时出错：${String(err)}` }], details: {} };
      }
    },
  });
}

// ═══════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════

function applyExitData(state: CognitiveState, data: Record<string, unknown>): void {
  const exits = state.phaseExits;
  if (Array.isArray(data.facts)) exits.facts = data.facts as string[];
  if (Array.isArray(data.knowledgeGaps)) exits.knowledgeGaps = data.knowledgeGaps as string[];
  if (typeof data.essence === "string") exits.essence = data.essence;
  if (typeof data.mainContradiction === "string") exits.mainContradiction = data.mainContradiction;
  if (typeof data.contradictionBasis === "string") exits.contradictionBasis = data.contradictionBasis;
  if (typeof data.modelDescription === "string") exits.modelDescription = data.modelDescription;
  if (typeof data.modelLimitations === "string") exits.modelLimitations = data.modelLimitations;
  if (typeof data.solution === "string") exits.solution = data.solution;
  if (typeof data.bottleneckConstraint === "string") exits.bottleneckConstraint = data.bottleneckConstraint;
}

function formatStatusBar(): string {
  if (!cognitiveState) return "求是 | 未初始化";
  const label = PHASE_LABELS[cognitiveState.phase];
  const mode = autoApproveMode ? "⚡" : "👆";
  return `求是 ${mode} | ${label.emoji} ${label.cn} | 深度 ${cognitiveState.depth}`;
}

function buildPhaseWidget(): string[] {
  if (!cognitiveState) return [];
  const label = PHASE_LABELS[cognitiveState.phase];
  const skills = PHASE_SKILLS[cognitiveState.phase];
  const mode = autoApproveMode ? "⚡ 自动批准" : "👆 手动确认";
  return [
    `┌─ 求是认知环 ──────────────────────────┐`,
    `│ ${label.emoji} 当前：${label.cn}（深度 ${cognitiveState.depth}）${mode}`,
    `│ 可用技能：${skills.slice(0, 3).join(", ")}${skills.length > 3 ? " …" : ""}`,
    `│ /phase status · /auto-approve on|off`,
    `└────────────────────────────────────────┘`,
  ];
}

function showFullStatus(ctx: ExtensionContext): void {
  if (!cognitiveState) return;
  const label = PHASE_LABELS[cognitiveState.phase];
  const skills = PHASE_SKILLS[cognitiveState.phase];
  const exits = cognitiveState.phaseExits;
  const mode = autoApproveMode ? "⚡ 自动批准" : "👆 手动确认";

  for (const line of [
    `${label.emoji} 认知环完整状态`,
    `环节：${label.cn}（${label.en}）| 深度：${cognitiveState.depth} | 层次：${cognitiveState.hierarchy}`,
    `模式：${mode}`,
    ``,
    `📊 出口数据：`,
    `  事实：${exits.facts.length > 0 ? exits.facts.join("; ") : "（空）"}`,
    `  知识缺口：${exits.knowledgeGaps.length > 0 ? exits.knowledgeGaps.join("; ") : "（空）"}`,
    `  问题本质：${exits.essence || "（未定义）"}`,
    `  主要矛盾：${exits.mainContradiction || "（未定义）"}`,
    `  解：${exits.solution || "（未产出）"}`,
    `  瓶颈约束：${exits.bottleneckConstraint || "（未识别）"}`,
    `  偏差：${exits.deviations.length} 条`,
    ``,
    `🧰 当前环节技能：${skills.join(", ")}`,
  ]) {
    ctx.ui.notify(line, "info");
  }
}

export type { CognitiveState } from "./types";
