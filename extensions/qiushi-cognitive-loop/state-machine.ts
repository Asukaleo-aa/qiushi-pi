/**
 * 认知环状态机
 *
 * 维护当前认知环节、深度等级、系统层次，管理环节推进和回退。
 * 状态通过 Pi 的 session 条目持久化，跨会话恢复。
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  type CognitiveState,
  type CognitivePhase,
  type DepthLevel,
  type SystemHierarchy,
  COGNITIVE_PHASES,
  CORRECTION_ROUTING,
  createDefaultState,
} from "./types";

const STATE_ENTRY_TYPE = "qiushi-cognitive-state";

// ─── 状态持久化 ─────────────────────────────────────────

export async function saveState(
  pi: ExtensionAPI,
  state: CognitiveState,
): Promise<void> {
  await pi.appendEntry({
    type: STATE_ENTRY_TYPE,
    role: "system",
    content: JSON.stringify(state),
  });
}

export async function loadState(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<CognitiveState> {
  try {
    // 从 session 中查找最近的 qiushi 状态条目
    const sessionFile = ctx.sessionManager?.getSessionFile?.();
    if (!sessionFile) return createDefaultState();

    // 遍历 session 条目找最近的状态（由调用方在 session_start 时处理）
    // 注意：Pi 的 session API 需要通过 ctx 访问，这里由调用者负责传入
    return createDefaultState();
  } catch {
    return createDefaultState();
  }
}

// ─── 环节转移逻辑 ───────────────────────────────────────

/** 推进到下一个环节（按线性顺序） */
export function advancePhase(state: CognitiveState): CognitiveState {
  const currentIdx = COGNITIVE_PHASES.indexOf(state.phase);
  if (currentIdx < COGNITIVE_PHASES.length - 1) {
    const nextPhase = COGNITIVE_PHASES[currentIdx + 1];
    return transitionTo(state, nextPhase);
  }
  // 已经是最后一个环节（修正），回到感知
  return transitionTo(state, "perceive");
}

/** 回退到上一个环节 */
export function retreatPhase(state: CognitiveState): CognitiveState {
  const currentIdx = COGNITIVE_PHASES.indexOf(state.phase);
  if (currentIdx > 0) {
    return transitionTo(state, COGNITIVE_PHASES[currentIdx - 1]);
  }
  return state; // 感知环不能再回退
}

/** 从修正环回退到指定环节（根据偏差层次） */
export function correctToPhase(
  state: CognitiveState,
  deviationDepth: string,
): CognitiveState {
  const targetPhase = CORRECTION_ROUTING[deviationDepth];
  if (targetPhase) {
    return transitionTo(state, targetPhase);
  }
  // 默认回到感知
  return transitionTo(state, "perceive");
}

/** 强制设置环节 */
export function setPhase(
  state: CognitiveState,
  phase: CognitivePhase,
): CognitiveState {
  return transitionTo(state, phase);
}

// ─── 深度和层次 ─────────────────────────────────────────

export function setDepth(state: CognitiveState, depth: DepthLevel): CognitiveState {
  return { ...state, depth };
}

export function setHierarchy(
  state: CognitiveState,
  hierarchy: SystemHierarchy,
): CognitiveState {
  return { ...state, hierarchy };
}

// ─── 内部辅助 ──────────────────────────────────────────

function transitionTo(
  state: CognitiveState,
  targetPhase: CognitivePhase,
): CognitiveState {
  const now = new Date().toISOString();

  // 标记当前环节退出时间
  const updatedHistory = state.phaseHistory.map((entry, idx) => {
    if (idx === state.phaseHistory.length - 1 && !entry.exitedAt) {
      return { ...entry, exitedAt: now };
    }
    return entry;
  });

  return {
    ...state,
    phase: targetPhase,
    phaseHistory: [
      ...updatedHistory,
      { phase: targetPhase, enteredAt: now },
    ],
  };
}
