import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasCommandType, CanvasCommandV01 } from '../model/contracts';

export const HIGH_COST_CANVAS_COMMANDS = [
  'CREATE_VIRTUAL_CHARACTER',
  'BIND_ASSET_TO_ENTITY',
  'GENERATE_SHOT',
  'SELECT_SHOT_OUTPUT',
  'EXPORT_PLAYLIST',
] as const satisfies readonly CanvasCommandType[];

export type HighCostCanvasCommandType = (typeof HIGH_COST_CANVAS_COMMANDS)[number];

export interface CanvasCommandExecutionContext {
  tenantId: string;
  projectId: string;
  packageId: string;
  canvasSessionId: string;
  requestedByActorId: string;
}

export interface PrepareHighCostApprovalRequest extends CanvasCommandExecutionContext {
  commandType: HighCostCanvasCommandType;
  action: {
    commandId: string;
    payload: CanvasCommandV01['payload'];
  };
}

export interface PreparedHighCostApproval {
  approvalId: string;
  status: 'active' | 'consumed' | 'expired' | 'revoked';
}

export type PrepareHighCostApproval = (
  request: PrepareHighCostApprovalRequest,
) => Promise<PreparedHighCostApproval | null>;

export interface HighCostConfirmationCopy {
  title: string;
  summary: string;
}

export type HighCostApprovalPhase =
  | 'confirming'
  | 'preparing'
  | 'approval_failed'
  | 'dispatching'
  | 'dispatch_failed';

export interface HighCostApprovalView {
  title: string;
  summary: string;
  phase: HighCostApprovalPhase;
  errorMessage: string | null;
}

interface PendingApproval {
  attemptId: symbol;
  command: CanvasCommandV01;
  confirmation: HighCostConfirmationCopy;
  phase: HighCostApprovalPhase;
  errorMessage: string | null;
  approvedCommand: CanvasCommandV01 | null;
}

interface UseCanvasCommandApprovalFlowOptions {
  context: CanvasCommandExecutionContext | null;
  prepareHighCostApproval?: PrepareHighCostApproval;
  onCommand: (command: CanvasCommandV01) => void | Promise<void>;
}

const HIGH_COST_COMMAND_SET = new Set<CanvasCommandType>(HIGH_COST_CANVAS_COMMANDS);
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function freezeValue<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freezeValue);
  }
  return value;
}

function safeCommandSnapshot(command: CanvasCommandV01): CanvasCommandV01 {
  return freezeValue(structuredClone({ ...command, approvalId: null }));
}

function matchesContext(command: CanvasCommandV01, context: CanvasCommandExecutionContext | null): boolean {
  return Boolean(context)
    && command.tenantId === context?.tenantId
    && command.projectId === context.projectId
    && command.packageId === context.packageId
    && command.canvasSessionId === context.canvasSessionId
    && command.requestedByActorId === context.requestedByActorId;
}

function publicView(pending: PendingApproval | null): HighCostApprovalView | null {
  if (!pending) return null;
  return {
    title: pending.confirmation.title,
    summary: pending.confirmation.summary,
    phase: pending.phase,
    errorMessage: pending.errorMessage,
  };
}

export function useCanvasCommandApprovalFlow({
  context,
  prepareHighCostApproval,
  onCommand,
}: UseCanvasCommandApprovalFlowOptions) {
  const contextRef = useRef(context);
  contextRef.current = context;
  const pendingRef = useRef<PendingApproval | null>(null);
  const busyRef = useRef(false);
  const [pending, setPendingState] = useState<PendingApproval | null>(null);

  const setPending = useCallback((next: PendingApproval | null) => {
    pendingRef.current = next;
    setPendingState(next);
  }, []);

  useEffect(() => {
    const current = pendingRef.current;
    if (current && !matchesContext(current.command, context)) {
      busyRef.current = false;
      setPending(null);
    }
  }, [context, setPending]);

  const requestCommand = useCallback((
    command: CanvasCommandV01,
    confirmation?: HighCostConfirmationCopy,
  ): boolean => {
    if (pendingRef.current || !matchesContext(command, contextRef.current)) return false;
    const snapshot = safeCommandSnapshot(command);

    if (!HIGH_COST_COMMAND_SET.has(snapshot.commandType)) {
      void Promise.resolve(onCommand(snapshot)).catch(() => undefined);
      return true;
    }

    if (!confirmation) return false;
    const next: PendingApproval = {
      attemptId: Symbol(snapshot.commandId),
      command: snapshot,
      confirmation,
      phase: prepareHighCostApproval ? 'confirming' : 'approval_failed',
      errorMessage: prepareHighCostApproval ? null : '未能取得有效操作确认，请稍后重试。',
      approvedCommand: null,
    };
    setPending(next);
    return true;
  }, [onCommand, prepareHighCostApproval, setPending]);

  const cancelApproval = useCallback(() => {
    const current = pendingRef.current;
    if (!current || !['confirming', 'approval_failed'].includes(current.phase) || busyRef.current) return;
    setPending(null);
  }, [setPending]);

  const confirmApproval = useCallback(() => {
    const selected = pendingRef.current;
    if (!selected || busyRef.current) return;
    if (!['confirming', 'approval_failed', 'dispatch_failed'].includes(selected.phase)) return;
    if (!matchesContext(selected.command, contextRef.current)) {
      setPending(null);
      return;
    }

    busyRef.current = true;
    void (async () => {
      let approvedCommand = selected.approvedCommand;
      try {
        if (!approvedCommand) {
          if (!prepareHighCostApproval || !HIGH_COST_COMMAND_SET.has(selected.command.commandType)) {
            throw new Error('approval unavailable');
          }
          setPending({ ...selected, phase: 'preparing', errorMessage: null });
          const approval = await prepareHighCostApproval({
            tenantId: selected.command.tenantId,
            projectId: selected.command.projectId,
            packageId: selected.command.packageId,
            canvasSessionId: selected.command.canvasSessionId,
            requestedByActorId: selected.command.requestedByActorId,
            commandType: selected.command.commandType as HighCostCanvasCommandType,
            action: {
              commandId: selected.command.commandId,
              payload: structuredClone(selected.command.payload),
            },
          });
          if (
            pendingRef.current?.attemptId !== selected.attemptId
            || !matchesContext(selected.command, contextRef.current)
          ) return;
          if (!approval || approval.status !== 'active' || !CANONICAL_UUID.test(approval.approvalId)) {
            throw new Error('approval invalid');
          }
          approvedCommand = freezeValue(structuredClone({
            ...selected.command,
            approvalId: approval.approvalId,
          }));
        }

        if (!matchesContext(approvedCommand, contextRef.current)) {
          setPending(null);
          return;
        }
        setPending({
          ...selected,
          phase: 'dispatching',
          errorMessage: null,
          approvedCommand,
        });
        try {
          await onCommand(approvedCommand);
          if (pendingRef.current?.attemptId === selected.attemptId) setPending(null);
        } catch {
          if (pendingRef.current?.attemptId === selected.attemptId) {
            setPending({
              ...selected,
              phase: 'dispatch_failed',
              errorMessage: '提交结果未知，请重试同一命令以恢复服务端事实。',
              approvedCommand,
            });
          }
        }
      } catch {
        if (pendingRef.current?.attemptId === selected.attemptId) {
          setPending({
            ...selected,
            phase: 'approval_failed',
            errorMessage: '未能取得有效操作确认，请稍后重试。',
            approvedCommand: null,
          });
        }
      } finally {
        busyRef.current = false;
      }
    })();
  }, [onCommand, prepareHighCostApproval, setPending]);

  return {
    approval: publicView(pending),
    requestCommand,
    confirmApproval,
    cancelApproval,
    approvalPending: pending !== null,
  };
}
