import { IconAlertTriangle, IconLoader2, IconX } from '@tabler/icons-react';
import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import type { HighCostApprovalView } from '../hooks/useCanvasCommandApprovalFlow';

interface HighCostApprovalDialogProps {
  approval: HighCostApprovalView | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const busyPhases = new Set<HighCostApprovalView['phase']>(['preparing', 'dispatching']);

function confirmCopy(phase: HighCostApprovalView['phase']): string {
  if (phase === 'preparing') return '正在确认';
  if (phase === 'dispatching') return '正在提交';
  if (phase === 'approval_failed') return '重试确认';
  if (phase === 'dispatch_failed') return '重试同一命令';
  return '确认并继续';
}

export function HighCostApprovalDialog({ approval, onCancel, onConfirm }: HighCostApprovalDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const open = Boolean(approval);

  useLayoutEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  if (!approval) return null;
  const busy = busyPhases.has(approval.phase);
  const canCancel = ['confirming', 'approval_failed'].includes(approval.phase);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && canCancel) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="cv1-approval-layer">
      <div className="cv1-approval-scrim" aria-hidden="true" />
      <section ref={dialogRef} className="cv1-approval-dialog" role="dialog" aria-modal="true" aria-labelledby="cv1-approval-title" aria-describedby="cv1-approval-summary" onKeyDown={handleKeyDown}>
        <header>
          <div><span>USER CONFIRMATION</span><h2 id="cv1-approval-title">{approval.title}</h2></div>
          {canCancel ? <button type="button" aria-label="关闭确认对话框" onClick={onCancel}><IconX size={18} /></button> : null}
        </header>
        <div className="cv1-approval-dialog__notice"><IconAlertTriangle size={18} /><strong>此操作可能产生模型用量或改变项目资产。</strong></div>
        <p id="cv1-approval-summary">{approval.summary}</p>
        {approval.errorMessage ? <p className="cv1-approval-dialog__error" role="alert">{approval.errorMessage}</p> : null}
        <div className="cv1-approval-dialog__actions">
          {canCancel ? <button className="cv1-secondary-action" type="button" onClick={onCancel}>取消</button> : null}
          <button ref={confirmRef} className="cv1-primary-action" type="button" disabled={busy} onClick={onConfirm}>
            {busy ? <IconLoader2 className="cv1-spin" size={16} aria-hidden="true" /> : null}
            {confirmCopy(approval.phase)}
          </button>
        </div>
      </section>
    </div>
  );
}
