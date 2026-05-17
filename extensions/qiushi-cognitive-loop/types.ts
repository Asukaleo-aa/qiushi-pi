/**
 * 求是认知环扩展 —— 类型定义
 *
 * 定义了认知环状态机、环节转移规则、权限矩阵、上下文注入模板
 * 所需的全部 TypeScript 接口与类型。
 */

// ─── 认知环节 ───────────────────────────────────────────

export type CognitivePhase =
  | "perceive"    // 感知
  | "understand"  // 理解
  | "model"       // 建模
  | "solve"       // 求解
  | "execute"     // 执行
  | "verify"      // 校验
  | "correct";    // 修正

export const COGNITIVE_PHASES: CognitivePhase[] = [
  "perceive", "understand", "model", "solve", "execute", "verify", "correct",
];

export const PHASE_LABELS: Record<CognitivePhase, { emoji: string; cn: string; en: string }> = {
  perceive:    { emoji: "🔍", cn: "感知", en: "Perceive" },
  understand:  { emoji: "💡", cn: "理解", en: "Understand" },
  model:       { emoji: "📐", cn: "建模", en: "Model" },
  solve:       { emoji: "⚙️", cn: "求解", en: "Solve" },
  execute:     { emoji: "🚀", cn: "执行", en: "Execute" },
  verify:      { emoji: "✅", cn: "校验", en: "Verify" },
  correct:     { emoji: "🔧", cn: "修正", en: "Correct" },
};

// ─── 深度等级 ───────────────────────────────────────────

export type DepthLevel = 0 | 1 | 2 | 3 | 4;

export const DEPTH_LABELS: Record<DepthLevel, string> = {
  0: "不武装",
  1: "仅感知",
  2: "感知+理解+执行",
  3: "全环展开",
  4: "全环迭代",
};

// ─── 系统层次 ───────────────────────────────────────────

export type SystemHierarchy =
  | "physical"
  | "engineering"
  | "product"
  | "socio-technical";

export const HIERARCHY_LABELS: Record<SystemHierarchy, { cn: string; en: string }> = {
  physical:        { cn: "物理系统", en: "Physical System" },
  engineering:     { cn: "工程系统", en: "Engineering System" },
  product:         { cn: "产品系统", en: "Product System" },
  "socio-technical": { cn: "社会-技术系统", en: "Socio-Technical System" },
};

// ─── 环节出口数据 ───────────────────────────────────────

export interface PhaseExits {
  // 感知出口
  facts: string[];
  knowledgeGaps: string[];
  reliableSources: string[];

  // 理解出口
  essence: string;
  mainContradiction: string;
  contradictionBasis: string;
  keyAssumptions: Array<{ statement: string; verified: boolean }>;

  // 建模出口
  modelDescription: string;
  modelLimitations: string;

  // 求解出口
  solution: string;
  bottleneckConstraint: string;
  solutionAssumptions: string[];

  // 执行出口
  tasksCompleted: string[];
  milestonesReached: string[];

  // 校验出口
  deviations: Array<{ expected: string; actual: string; rootCause: string }>;
  deviationDepth: "execution" | "solution" | "model" | "understanding" | "perception" | null;
}

// ─── 认知状态（持久化） ─────────────────────────────────

export interface CognitiveState {
  phase: CognitivePhase;
  depth: DepthLevel;
  hierarchy: SystemHierarchy;
  phaseExits: PhaseExits;
  phaseHistory: PhaseHistoryEntry[];
  version: string; // 方法论版本（如 "3.1"）
}

export interface PhaseHistoryEntry {
  phase: CognitivePhase;
  enteredAt: string; // ISO 8601
  exitedAt?: string;
}

// ─── 环节转移 ──────────────────────────────────────────

/** 环节推进条件 */
export interface PhaseAdvanceCondition {
  targetPhase: CognitivePhase;
  condition: string;
  check: (state: CognitiveState) => boolean;
}

/** 修正回退映射：偏差层次 → 回退到哪个环节 */
export const CORRECTION_ROUTING: Record<string, CognitivePhase> = {
  execution:     "execute",
  solution:      "solve",
  model:         "model",
  understanding: "understand",
  perception:    "perceive",
};

// ─── 权限矩阵 ──────────────────────────────────────────

export type ToolPermission = "allowed" | "restricted" | "blocked" | "confirm";

export interface PhasePermissions {
  read: ToolPermission;
  write: ToolPermission;
  edit: ToolPermission;
  bash: ToolPermission;
  bashAllowedPatterns?: RegExp[];
  bashBlockedPatterns?: RegExp[];
}

export const PHASE_PERMISSIONS: Record<CognitivePhase, PhasePermissions> = {
  perceive: {
    read: "allowed", write: "restricted", edit: "blocked",
    bash: "restricted",
    bashAllowedPatterns: [/^(ls|cat|head|tail|grep|find|wc|stat|file|which|echo|pwd|whoami|uname|date|env)\b/],
    bashBlockedPatterns: [/rm\s+-rf/, /sudo\b/, />\s*\/dev\//, /mkfs/, /dd\s+if=/],
  },
  understand: {
    read: "allowed", write: "restricted", edit: "blocked",
    bash: "restricted",
    bashAllowedPatterns: [/^(ls|cat|head|tail|grep|find|wc|stat|file|which|echo|pwd|git\s+log|git\s+diff|git\s+status)\b/],
    bashBlockedPatterns: [/rm\s+-rf/, /sudo\b/, /git\s+push/, /git\s+commit/, />\s*\/dev\//],
  },
  model: {
    read: "allowed", write: "allowed", edit: "restricted",
    bash: "allowed",
    bashBlockedPatterns: [/rm\s+-rf/, /sudo\b/, />\s*\/dev\//],
  },
  solve: {
    read: "allowed", write: "allowed", edit: "allowed",
    bash: "allowed",
    bashBlockedPatterns: [/rm\s+-rf\s+\//, /sudo\b/, />\s*\/dev\//],
  },
  execute: {
    read: "allowed", write: "allowed", edit: "allowed",
    bash: "allowed",
  },
  verify: {
    read: "allowed", write: "restricted", edit: "blocked",
    bash: "restricted",
    bashAllowedPatterns: [/^(npm\s+test|pytest|cargo\s+test|go\s+test|make\s+test)\b/],
    bashBlockedPatterns: [/rm\s+-rf/, /sudo\b/, /git\s+push/],
  },
  correct: {
    read: "allowed", write: "allowed", edit: "allowed",
    bash: "allowed",
    // 修正环的权限取决于要回退到哪个环节，这里放默认值
  },
};

// ─── 环节技能映射 ──────────────────────────────────────

export const PHASE_SKILLS: Record<CognitivePhase, string[]> = {
  perceive: [
    "investigation-first",
    "problem-domain-investigation",
    "mass-line",
    "state-estimation",
  ],
  understand: [
    "first-principles-analysis",
    "historical-evolution-analysis",
    "contradiction-analysis",
  ],
  model: [
    "systems-thinking-framework",
    "system-boundary-structuring",
    "quantitative-modeling-workflow",
    "meta-synthesis-engine",
  ],
  solve: [
    "constrained-optimization",
    "hierarchical-decomposition-coordination",
    "duality-complementarity-analysis",
    "perturbation-progressive-method",
    "multi-representation-equivalence-transform",
  ],
  execute: [
    "engineering-orchestration",
    "concentrate-forces",
    "spark-prairie-fire",
    "protracted-strategy",
    "overall-planning",
  ],
  verify: [
    "practice-cognition",
    "simulation-validation-cycle",
    "feedback-and-revision-loop",
  ],
  correct: [
    "criticism-self-criticism",
    "adaptive-robust-strategy",
  ],
};

// ─── 默认状态 ──────────────────────────────────────────

export function createDefaultState(): CognitiveState {
  return {
    phase: "perceive",
    depth: 2,
    hierarchy: "engineering",
    phaseExits: {
      facts: [],
      knowledgeGaps: [],
      reliableSources: [],
      essence: "",
      mainContradiction: "",
      contradictionBasis: "",
      keyAssumptions: [],
      modelDescription: "",
      modelLimitations: "",
      solution: "",
      bottleneckConstraint: "",
      solutionAssumptions: [],
      tasksCompleted: [],
      milestonesReached: [],
      deviations: [],
      deviationDepth: null,
    },
    phaseHistory: [{ phase: "perceive", enteredAt: new Date().toISOString() }],
    version: "3.1",
  };
}
