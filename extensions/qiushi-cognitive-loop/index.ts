/**
 * 求是认知环 —— Pi 扩展入口
 *
 * 将求是系统工程方法论的七环认知闭环嵌入 Pi 的运行时事件循环。
 * 安装后，Pi 在每次交互中自动：
 *   1. 维护认知环状态机（环节/深度/层次）
 *   2. 注入当前环节的上下文和行为准则
 *   3. 强制执行环节权限约束
 *   4. 评估出口条件并推进/回退环节
 *   5. 在 UI 中展示当前认知状态
 *
 * 安装：pi install qiushi-pi
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import {
  type CognitiveState,
  PHASE_LABELS,
  PHASE_SKILLS,
} from "./types";
import {
  saveState,
  loadState,
  advancePhase,
  retreatPhase,
  correctToPhase,
  setPhase,
  setDepth,
  setHierarchy,
} from "./state-machine";
import { generatePhaseContext } from "./phase-context";
import { checkToolPermission, formatBlockNotification } from "./constraint-engine";

// ─── 全局状态（扩展实例内） ──────────────────────────────

let cognitiveState: CognitiveState | null = null;

// ─── 入口 ───────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ═══════════════════════════════════════════════════════
  // 1. 会话生命周期
  // ═══════════════════════════════════════════════════════

  pi.on("session_start", async (event, ctx) => {
    // 从会话文件恢复状态，或新建默认状态
    cognitiveState = await loadState(pi, ctx);
    ctx.ui.notify(
      `求是认知环已启动 | ${PHASE_LABELS[cognitiveState.phase].emoji} ${PHASE_LABELS[cognitiveState.phase].cn}`,
      "info",
    );
    ctx.ui.setStatus("qiushi", formatStatusBar(cognitiveState));
    ctx.ui.setWidget("qiushi", buildPhaseWidget(cognitiveState));
    await saveState(pi, cognitiveState);
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    cognitiveState = null;
  });

  // ═══════════════════════════════════════════════════════
  // 2. 每次 Agent 启动前：注入认知环上下文
  // ═══════════════════════════════════════════════════════

  pi.on("before_agent_start", async (event, ctx) => {
    if (!cognitiveState) return;

    // 注入当前环节的上下文块到系统提示词
    const phaseContext = generatePhaseContext(cognitiveState);
    event.injectSystemMessage?.(phaseContext);

    // 更新 UI
    ctx.ui.setStatus("qiushi", formatStatusBar(cognitiveState));
    ctx.ui.setWidget("qiushi", buildPhaseWidget(cognitiveState));
  });

  // ═══════════════════════════════════════════════════════
  // 3. 工具调用拦截：环节权限约束
  // ═══════════════════════════════════════════════════════

  pi.on("tool_call", async (event, ctx) => {
    if (!cognitiveState) return;

    const toolName = event.toolName;
    const toolInput = event.input as Record<string, unknown>;

    const check = checkToolPermission(toolName, toolInput, cognitiveState);

    switch (check.action) {
      case "block": {
        ctx.ui.notify(
          formatBlockNotification(toolName, cognitiveState.phase, check.reason ?? ""),
          "error",
        );
        return {
          block: true,
          reason: check.reason ?? `工具 ${toolName} 在当前认知环节被阻止`,
        };
      }
      case "confirm": {
        const ok = await ctx.ui.confirm(
          "认知环约束",
          check.reason ?? "当前环节对此操作有限制，确认继续？",
        );
        if (!ok) {
          return {
            block: true,
            reason: "用户拒绝了在当前环节执行此操作",
          };
        }
        break;
      }
      case "warn": {
        ctx.ui.notify(check.reason ?? "当前环节对此操作有限制", "warning");
        break;
      }
      case "allow":
      default:
        break;
    }
  });

  // ═══════════════════════════════════════════════════════
  // 4. 轮次结束：评估出口条件与环节推进
  // ═══════════════════════════════════════════════════════

  pi.on("turn_end", async (_event, ctx) => {
    if (!cognitiveState) return;
    // 出口条件评估由 LLM 在上下文中自行判断。
    // 如需自动推进，可以在此注入推进提示。
    // 当前设计：由用户通过 /phase advance 命令显式推进，
    // 或 LLM 自己判断后建议推进。
    ctx.ui.setStatus("qiushi", formatStatusBar(cognitiveState));
    await saveState(pi, cognitiveState);
  });

  // ═══════════════════════════════════════════════════════
  // 5. 自定义命令
  // ═══════════════════════════════════════════════════════

  // /phase —— 查看或管理认知环状态
  pi.registerCommand("phase", {
    description: "查看或管理认知环状态。用法：/phase [status|advance|back|set <环节名>|reset]",
    async handler(args, ctx) {
      if (!cognitiveState) {
        ctx.ui.notify("认知环未初始化", "error");
        return;
      }

      const sub = args?.trim() ?? "status";

      if (sub === "status" || sub === "") {
        showFullStatus(ctx, cognitiveState);
      } else if (sub === "advance") {
        cognitiveState = advancePhase(cognitiveState);
        ctx.ui.notify(
          `推进到 ${PHASE_LABELS[cognitiveState.phase].emoji} ${PHASE_LABELS[cognitiveState.phase].cn}`,
          "success",
        );
        await saveState(pi, cognitiveState);
      } else if (sub === "back") {
        cognitiveState = retreatPhase(cognitiveState);
        ctx.ui.notify(
          `回退到 ${PHASE_LABELS[cognitiveState.phase].emoji} ${PHASE_LABELS[cognitiveState.phase].cn}`,
          "warning",
        );
        await saveState(pi, cognitiveState);
      } else if (sub === "reset") {
        cognitiveState = {
          ...cognitiveState,
          phase: "perceive",
          phaseExits: {
            facts: [], knowledgeGaps: [], reliableSources: [],
            essence: "", mainContradiction: "", contradictionBasis: "",
            keyAssumptions: [], modelDescription: "", modelLimitations: "",
            solution: "", bottleneckConstraint: "", solutionAssumptions: [],
            tasksCompleted: [], milestonesReached: [],
            deviations: [], deviationDepth: null,
          },
        };
        ctx.ui.notify("认知环已重置到感知环节", "success");
        await saveState(pi, cognitiveState);
      } else if (sub.startsWith("set ")) {
        const phaseName = sub.slice(4).trim();
        const validPhases = ["perceive", "understand", "model", "solve", "execute", "verify", "correct"];
        if (validPhases.includes(phaseName)) {
          cognitiveState = setPhase(cognitiveState, phaseName as CognitivePhase);
          ctx.ui.notify(`已设置环节为 ${phaseName}`, "success");
          await saveState(pi, cognitiveState);
        } else {
          ctx.ui.notify(`无效环节名：${phaseName}。有效值：${validPhases.join(", ")}`, "error");
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
        ctx.ui.notify(`深度等级已设置为 ${d}`, "success");
        await saveState(pi, cognitiveState);
      } else {
        ctx.ui.notify("深度等级需在 0-4 之间", "error");
      }
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
        ctx.ui.notify(`系统层次已设置为 ${h}`, "success");
        await saveState(pi, cognitiveState);
      } else {
        ctx.ui.notify(`无效层次。有效值：${valid.join(", ")}`, "error");
      }
    },
  });

  // ═══════════════════════════════════════════════════════
  // 6. 自定义工具：load_qiushi_skill
  // ═══════════════════════════════════════════════════════

  pi.registerTool({
    name: "load_qiushi_skill",
    label: "加载求是技能",
    description:
      "按需加载一个求是系统工程方法论技能的完整内容。只在需要技能的具体指导时调用。" +
      "可用技能列表会在每个认知环节的上下文中列出。",
    parameters: {
      type: "object",
      properties: {
        skillName: {
          type: "string",
          description: "技能名称，如 investigation-first, contradiction-analysis 等",
        },
      },
      required: ["skillName"],
    },
    async execute(toolCallId, params, _signal, _onUpdate, ctx) {
      const skillName = String(params.skillName ?? "");
      // 从扩展的 skills 目录加载 SKILL.md
      // 实际路径解析依赖于 Pi 的扩展目录结构
      try {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");

        // 从扩展所在目录向上找到 qiushi-pi 根目录的 skills/
        const extDir = __dirname;
        const skillsDir = path.resolve(extDir, "../../skills", skillName);

        let skillPath = path.join(skillsDir, "SKILL.md");
        let content: string;
        try {
          content = await fs.readFile(skillPath, "utf-8");
        } catch {
          return {
            content: [{ type: "text", text: `技能 "${skillName}" 未找到。可用技能列表请参见当前环节上下文。` }],
            details: {},
          };
        }

        return {
          content: [{ type: "text", text: content }],
          details: { skillName, loadedAt: new Date().toISOString() },
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `加载技能 "${skillName}" 时出错：${String(err)}` }],
          details: {},
        };
      }
    },
  });
}

// ═══════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════

function formatStatusBar(state: CognitiveState): string {
  const label = PHASE_LABELS[state.phase];
  return `求是 | ${label.emoji} ${label.cn} | 深度 ${state.depth}`;
}

function buildPhaseWidget(state: CognitiveState): string[] {
  const label = PHASE_LABELS[state.phase];
  const skills = PHASE_SKILLS[state.phase];
  const lines: string[] = [];
  lines.push(`┌─ 求是认知环 ──────────────────────────┐`);
  lines.push(`│ ${label.emoji} 当前：${label.cn}（深度 ${state.depth}）`);
  lines.push(`│ 可用技能：${skills.slice(0, 3).join(", ")}${skills.length > 3 ? " …" : ""}`);
  lines.push(`│ 命令：/phase status | advance | back | reset`);
  lines.push(`└────────────────────────────────────────┘`);
  return lines;
}

function showFullStatus(ctx: ExtensionContext, state: CognitiveState): void {
  const label = PHASE_LABELS[state.phase];
  const skills = PHASE_SKILLS[state.phase];
  const exits = state.phaseExits;

  const lines = [
    `${label.emoji} 认知环完整状态`,
    `环节：${label.cn}（${label.en}）`,
    `深度：${state.depth}`,
    `系统层次：${state.hierarchy}`,
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
  ];

  for (const line of lines) {
    ctx.ui.notify(line, "info");
  }
}

// 复导出类型供外部使用
export type { CognitiveState } from "./types";
