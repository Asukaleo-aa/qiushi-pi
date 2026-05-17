/**
 * 约束引擎
 *
 * 在 tool_call 事件中检查当前环节的权限矩阵，
 * 决定是允许、阻止、限制还是要求用户确认。
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CognitiveState, CognitivePhase } from "./types";
import { PHASE_PERMISSIONS } from "./types";

// ─── 检查结果 ───────────────────────────────────────────

export interface ConstraintCheckResult {
  action: "allow" | "block" | "confirm" | "warn";
  reason?: string;
}

// ─── 主检查函数 ─────────────────────────────────────────

/**
 * 在工具调用前检查权限。
 * 返回 { block: true } 时 Pi 会阻止工具执行。
 */
export function checkToolPermission(
  toolName: string,
  toolInput: Record<string, unknown>,
  state: CognitiveState,
): ConstraintCheckResult {
  const permissions = PHASE_PERMISSIONS[state.phase];
  if (!permissions) return { action: "allow" };

  // 根据工具类型匹配权限
  let permission = "allowed";

  switch (toolName) {
    case "read":
      permission = permissions.read;
      break;
    case "write":
      permission = permissions.write;
      break;
    case "edit":
      permission = permissions.edit;
      break;
    case "bash":
      permission = permissions.bash;
      return checkBashPermission(toolInput, permissions, state.phase);
    default:
      // 自定义工具默认允许
      return { action: "allow" };
  }

  switch (permission) {
    case "allowed":
      return { action: "allow" };
    case "blocked":
      return {
        action: "block",
        reason: `当前处于认知环「${state.phase}」环节，${toolName} 工具被阻止。如需执行此操作，请先推进认知环节。`,
      };
    case "restricted":
      return {
        action: "confirm",
        reason: `当前处于认知环「${state.phase}」环节，${toolName} 工具有限制。确认要继续吗？`,
      };
    case "confirm":
      return {
        action: "confirm",
        reason: `当前操作可能需要额外确认。`,
      };
    default:
      return { action: "allow" };
  }
}

// ─── Bash 权限专用检查 ──────────────────────────────────

function checkBashPermission(
  input: Record<string, unknown>,
  permissions: NonNullable<typeof PHASE_PERMISSIONS[CognitivePhase]>,
  phase: CognitivePhase,
): ConstraintCheckResult {
  const command = String(input.command ?? "");

  // 硬阻止：检查高风险模式
  if (permissions.bashBlockedPatterns) {
    for (const pattern of permissions.bashBlockedPatterns) {
      if (pattern.test(command)) {
        return {
          action: "block",
          reason: `当前处于认知环「${phase}」环节，bash 命令被阻止：${command.slice(0, 80)}`,
        };
      }
    }
  }

  // 限制模式：检查是否在白名单中
  if (permissions.bash === "restricted" && permissions.bashAllowedPatterns) {
    const isAllowed = permissions.bashAllowedPatterns.some((p) => p.test(command));
    if (!isAllowed) {
      return {
        action: "confirm",
        reason: `当前处于认知环「${phase}」环节，bash 命令可能超出限制范围：${command.slice(0, 80)}`,
      };
    }
  }

  // 如果 restricted 但通过白名单
  if (permissions.bash === "restricted") {
    return { action: "allow" };
  }

  if (permissions.bash === "blocked") {
    return {
      action: "block",
      reason: `当前处于认知环「${phase}」环节，bash 完全被阻止。`,
    };
  }

  return { action: "allow" };
}

// ─── 格式化用户通知 ────────────────────────────────────

export function formatBlockNotification(
  toolName: string,
  phase: CognitivePhase,
  reason: string,
): string {
  return `🛑 工具调用被阻止——${toolName}\n环节：${phase}\n原因：${reason}`;
}
