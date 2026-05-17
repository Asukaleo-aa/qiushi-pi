/**
 * 环节上下文注入模板
 *
 * 为每个认知环节生成注入到系统提示词中的上下文块。
 * 注入发生在 before_agent_start 事件。
 */

import type { CognitiveState, CognitivePhase } from "./types";
import {
  PHASE_LABELS,
  DEPTH_LABELS,
  HIERARCHY_LABELS,
  PHASE_SKILLS,
  PHASE_PERMISSIONS,
} from "./types";

// ─── 环节核心命题和行为准则 ──────────────────────────────

interface PhaseGuidance {
  coreQuestion: string;
  behaviorRules: string[];
  exitConditions: string[];
}

const PHASE_GUIDANCE: Record<CognitivePhase, PhaseGuidance> = {
  perceive: {
    coreQuestion: "我面对的是什么？已知什么，未知什么？现状是什么？",
    behaviorRules: [
      "先调查再发言，不凭猜测做判断",
      "区分「已知事实」「推测」「待验证」，显式标注",
      "标注每个信息源的可靠性（可靠/待验证/存疑）",
      "宁可不完整，不可不诚实——不知道就说不知道",
      "不要为了快速推进而用假设填补信息缺口",
    ],
    exitConditions: [
      "事实清单 ≥ 3 项",
      "信息缺口已显式标注",
      "各信息源可靠性已评估",
    ],
  },
  understand: {
    coreQuestion: "这个东西的本质是什么？主要矛盾是什么？关键假设有哪些？",
    behaviorRules: [
      "剥离假设到不可再分的基本元素，从第一性原理出发重建理解",
      "追溯系统如何变成现在这样（历史演化路径和关键转折点）",
      "识别所有矛盾，从中判定主要矛盾——主要矛盾决定主攻方向",
      "列出所有关键假设，每个标注验证状态（已验证/待验证/存疑）",
      "区分「物理约束」「工程惯例」「偶然选择」",
    ],
    exitConditions: [
      "问题本质能用一句话说清",
      "主要矛盾已显式标注，附判定依据",
      "关键假设已列出，每项有验证状态",
    ],
  },
  model: {
    coreQuestion: "怎么描述这个系统？组成部分、边界、关系是什么？",
    behaviorRules: [
      "先确定系统层次（物理/工程/产品/社会-技术），层次决定目标来源",
      "定义系统边界：什么在里面，什么在外面",
      "识别组分及其相互关系，标注耦合强度和方向",
      "建立定量或定性模型，明确模型的适用范围和局限性",
      "定性判断 + 定量结果 → 综合集成结论",
    ],
    exitConditions: [
      "系统层次已确定",
      "边界和组分已描述",
      "模型适用范围和局限性已声明",
    ],
  },
  solve: {
    coreQuestion: "在系统模型内，面对约束，最优方案是什么？",
    behaviorRules: [
      "先做目标函数层次校验：在哪个系统层次上定义「好」？",
      "列出全部约束，区分硬约束（不可违反）和软约束（可权衡）",
      "从可用方法中选择最匹配的求解路径（优化/分解/对偶/摄动/等价变换）",
      "至少找到一个可行解，标注解的适用范围和敏感假设",
      "标出瓶颈约束——哪个约束限制了进一步优化？",
    ],
    exitConditions: [
      "至少一个可行解已产出",
      "解的适用范围和敏感假设已标注",
      "瓶颈约束已识别",
    ],
  },
  execute: {
    coreQuestion: "怎么把方案变成有序的、可追踪的行动？",
    behaviorRules: [
      "编排任务依赖关系，识别关键路径",
      "确定当前主攻方向（集中兵力，不分散用力）",
      "如果从零起步，先建立最小可行根据地",
      "如果长期任务，划分阶段（防御/相持/反攻）",
      "多目标冲突时先做全局平衡再集中兵力",
    ],
    exitConditions: [
      "任务依赖图已产出",
      "主攻目标已宣告",
      "有可检查的里程碑",
    ],
  },
  verify: {
    coreQuestion: "结果符合预期吗？偏差在哪？为什么？",
    behaviorRules: [
      "量化实际结果与预期的偏差",
      "追溯偏差根因到所属层次（执行层/模型层/理解层/感知层）",
      "判断偏差是噪声还是真问题（如果是噪声，不做过度反应）",
      "多场景仿真，压力测试，评估边缘情况",
      "不隐藏不利证据——偏差是改进的信号，不是失败的标志",
    ],
    exitConditions: [
      "偏差已量化",
      "根因已追溯到所属层次",
      "「噪声还是真问题」判断已给出",
    ],
  },
  correct: {
    coreQuestion: "基于偏差，改什么？方案？模型？还是从头再理解？",
    behaviorRules: [
      "偏差层次决定回退深度：执行偏差回执行、求解偏差回求解、理解偏差回理解",
      "结构化审视工作质量（批评与自我批评），不要护短",
      "如有自适应机制（自寻优/自镇定/模型参考），优先让系统自校正",
      "修正后重新进入对应环节，不跳过",
      "记录修正的原因和内容，为未来积累经验",
    ],
    exitConditions: [
      "偏差层次已判定",
      "回退目标环节已确定",
      "修正方案已产出",
    ],
  },
};

// ─── 上下文注入生成器 ───────────────────────────────────

/**
 * 生成当前环节的完整上下文注入块。
 * 在 before_agent_start 事件中调用，追加到系统提示词。
 * @param autoApprove 是否自动批准模式（true=模型判断满足即推进，false=弹窗确认）
 */
export function generatePhaseContext(state: CognitiveState, autoApprove: boolean): string {
  const phase = state.phase;
  const label = PHASE_LABELS[phase];
  const guidance = PHASE_GUIDANCE[phase];
  const skills = PHASE_SKILLS[phase];
  const permissions = PHASE_PERMISSIONS[phase];
  const hierarchy = HIERARCHY_LABELS[state.hierarchy];

  const lines: string[] = [];

  // ── 环节标识 ──
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`${label.emoji} 当前认知环节：${label.cn}（${label.en}）`);
  lines.push(`深度等级：${state.depth}（${DEPTH_LABELS[state.depth]}）`);
  lines.push(`系统层次：${hierarchy.cn}`);
  lines.push("");

  // ── 核心命题 ──
  lines.push(`🎯 核心命题：${guidance.coreQuestion}`);
  lines.push("");

  // ── 行为准则 ──
  lines.push("📋 行为准则：");
  for (const rule of guidance.behaviorRules) {
    lines.push(`  • ${rule}`);
  }
  lines.push("");

  // ── 出口条件 ──
  lines.push("🚪 本环节出口条件（完成后才能推进）：");
  let allExitsMet = true;
  for (let i = 0; i < guidance.exitConditions.length; i++) {
    const cond = guidance.exitConditions[i];
    const met = isExitConditionMet(state, i);
    const mark = met ? "✅" : "⬜";
    if (!met) allExitsMet = false;
    lines.push(`  ${mark} ${cond}`);
  }
  if (allExitsMet) {
    lines.push("  → 全部条件已满足，可以推进到下一环节。");
  }
  lines.push("");

  // ── 可用技能 ──
  lines.push("🧰 当前环节可用技能（仅列出名称和用途，需要时调用 load_qiushi_skill 加载完整内容）：");
  for (const skillName of skills) {
    lines.push(`  • ${skillName}`);
  }
  lines.push("");

  // ── 权限提示 ──
  if (permissions.write === "restricted" || permissions.write === "blocked") {
    lines.push("⚠️ 权限提示：当前环节对文件写入有限制，如需写入请先推进认知环节。");
  }
  if (permissions.bash === "restricted") {
    lines.push("⚠️ 权限提示：当前环节对 bash 命令有限制，仅允许只读分析类命令。");
  }

  // ── 关键数据 ──
  if (state.phaseExits.facts.length > 0) {
    lines.push("");
    lines.push("📊 已收集的事实：");
    for (const fact of state.phaseExits.facts) {
      lines.push(`  • ${fact}`);
    }
  }
  if (state.phaseExits.mainContradiction) {
    lines.push("");
    lines.push(`⭐ 已识别的主要矛盾：${state.phaseExits.mainContradiction}`);
  }
  if (state.phaseExits.essence) {
    lines.push("");
    lines.push(`💡 问题本质：${state.phaseExits.essence}`);
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ── 自我评估提示 ──
  lines.push("");
  lines.push(generateSelfAssessmentPrompt(state.phase, autoApprove));

  return lines.join("\n");
}

// ─── 出口条件检查辅助 ───────────────────────────────────

function isExitConditionMet(state: CognitiveState, conditionIndex: number): boolean {
  const exits = state.phaseExits;
  switch (state.phase) {
    case "perceive":
      if (conditionIndex === 0) return exits.facts.length >= 3;
      if (conditionIndex === 1) return exits.knowledgeGaps.length > 0;
      if (conditionIndex === 2) return exits.reliableSources.length > 0;
      return false;
    case "understand":
      if (conditionIndex === 0) return exits.essence.length > 0;
      if (conditionIndex === 1) return exits.mainContradiction.length > 0;
      if (conditionIndex === 2) return exits.keyAssumptions.length > 0;
      return false;
    case "model":
      if (conditionIndex === 0) return state.hierarchy !== "engineering"; // 已显式设置
      if (conditionIndex === 1) return true; // 边界和组分在上下文中体现
      if (conditionIndex === 2) return exits.modelLimitations.length > 0;
      return true;
    case "solve":
      if (conditionIndex === 0) return exits.solution.length > 0;
      if (conditionIndex === 1) return exits.solutionAssumptions.length > 0;
      if (conditionIndex === 2) return exits.bottleneckConstraint.length > 0;
      return false;
    case "execute":
      if (conditionIndex === 0) return exits.tasksCompleted.length > 0;
      if (conditionIndex === 1) return true;
      if (conditionIndex === 2) return exits.milestonesReached.length > 0;
      return true;
    case "verify":
      if (conditionIndex === 0) return exits.deviations.length > 0;
      if (conditionIndex === 1) return exits.deviationDepth !== null;
      return true;
    case "correct":
      if (conditionIndex === 0) return exits.deviationDepth !== null;
      return true;
    default:
      return false;
  }
}

// ─── 自我评估提示生成 ────────────────────────────────

/**
 * 生成环节自我评估提示，注入到上下文末尾。
 * 引导 LLM 在每轮结束后反思是否需要推进环节。
 */
export function generateSelfAssessmentPrompt(phase: CognitivePhase, autoApprove: boolean): string {
  const label = PHASE_LABELS[phase];
  const guidance = PHASE_GUIDANCE[phase];
  const modeHint = autoApprove
    ? "当前为「自动批准」模式：你判断满足条件后调用 assess_phase 工具，环节将自动推进。"
    : "当前为「手动确认」模式：你调用 assess_phase 工具提议推进，系统会弹窗让用户确认。";

  const exitChecks = guidance.exitConditions.map((c, i) => `  ${i + 1}. ${c}`).join("\n");

  return `🔄 环节自我评估
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
在完成本轮所有工具调用后，请反思：

1. 当前环节「${label.cn}」的出口条件是否已满足？
${exitChecks}

2. 如果满足，调用 **assess_phase** 工具：
   - ready: true
   - reasoning: 说明每个条件为什么满足
   - exitData: 填写出口数据（facts/essence/mainContradiction 等）

3. 如果不满足，调用 **assess_phase** 工具：
   - ready: false
   - reasoning: 说明还缺什么

${modeHint}

⚠️ 重要：每轮结束时必须调用 assess_phase 工具。不要跳过。`;
}
