import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HighCostApprovalDialog } from '../components/HighCostApprovalDialog';
import type { CanvasCommandType, CanvasCommandV01 } from '../model/contracts';
import {
  type CanvasCommandExecutionContext,
  type PrepareHighCostApproval,
  useCanvasCommandApprovalFlow,
} from './useCanvasCommandApprovalFlow';

const context: CanvasCommandExecutionContext = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  packageId: '33333333-3333-4333-8333-333333333333',
  canvasSessionId: 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678',
  requestedByActorId: '12121212-1212-4212-8212-121212121212',
};
const legacyApprovalId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const preparedApprovalId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const payloads = {
  ANALYZE_ASSET_REQUIREMENTS: { shotId: '66666666-6666-4666-8666-666666666666' },
  CREATE_VIRTUAL_CHARACTER: {
    assetId: '88888888-8888-4888-8888-888888888888',
    entityId: '16161616-1616-4616-8616-161616161616',
    prompt: '门店讲解员，暖色自然光。',
  },
  SYNC_PROVIDER_ASSET: { assetId: '88888888-8888-4888-8888-888888888888' },
  BIND_ASSET_TO_ENTITY: {
    assetId: '88888888-8888-4888-8888-888888888888',
    entityId: '16161616-1616-4616-8616-161616161616',
  },
  GENERATE_SHOT: {
    shotId: '66666666-6666-4666-8666-666666666666',
    readinessId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    prompt: '镜头缓慢推进。',
    referenceAssetIds: ['88888888-8888-4888-8888-888888888888'],
  },
  SELECT_SHOT_OUTPUT: {
    shotId: '66666666-6666-4666-8666-666666666666',
    outputAssetId: '19191919-1919-4919-8919-191919191919',
    documentId: '77777777-7777-4777-8777-777777777777',
    expectedVersion: 4,
  },
  SAVE_CANVAS_DOCUMENT: {
    documentId: '77777777-7777-4777-8777-777777777777',
    expectedVersion: 4,
    shots: [{
      shotId: '66666666-6666-4666-8666-666666666666',
      position: 0,
      selectedOutputAssetId: null,
      prompt: '镜头缓慢推进。',
      updatedAt: '2026-08-14T02:01:00.000Z',
    }],
    playlist: { shotIds: ['66666666-6666-4666-8666-666666666666'] },
  },
  EXPORT_PLAYLIST: {
    documentId: '77777777-7777-4777-8777-777777777777',
    expectedVersion: 4,
  },
} satisfies Record<CanvasCommandType, CanvasCommandV01['payload']>;

function command(commandType: CanvasCommandType): CanvasCommandV01 {
  return {
    objectType: 'CanvasCommand',
    contractVersion: '0.1',
    ...context,
    commandId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    commandType,
    requestSource: 'user',
    approvalId: legacyApprovalId,
    payload: structuredClone(payloads[commandType]),
    requestId: 'req-ui-approval-flow',
    occurredAt: '2026-08-14T02:02:00.000Z',
  };
}

interface HarnessProps {
  executionContext?: CanvasCommandExecutionContext;
  prepareHighCostApproval?: PrepareHighCostApproval;
  onCommand: (value: CanvasCommandV01) => void | Promise<void>;
}

function Harness({ executionContext = context, prepareHighCostApproval, onCommand }: HarnessProps) {
  const flow = useCanvasCommandApprovalFlow({
    context: executionContext,
    prepareHighCostApproval,
    onCommand,
  });
  const [requestedType, setRequestedType] = useState<CanvasCommandType>('GENERATE_SHOT');

  return (
    <>
      <select aria-label="命令类型" value={requestedType} onChange={(event) => setRequestedType(event.target.value as CanvasCommandType)}>
        {Object.keys(payloads).map((type) => <option key={type}>{type}</option>)}
      </select>
      <button
        type="button"
        onClick={() => flow.requestCommand(command(requestedType), {
          title: '确认高成本操作',
          summary: '门店开场 · 当前候选画面',
        })}
      >
        请求命令
      </button>
      <HighCostApprovalDialog
        approval={flow.approval}
        onCancel={flow.cancelApproval}
        onConfirm={flow.confirmApproval}
      />
    </>
  );
}

async function chooseAndRequest(user: ReturnType<typeof userEvent.setup>, commandType: CanvasCommandType) {
  await user.selectOptions(screen.getByRole('combobox', { name: '命令类型' }), commandType);
  await user.click(screen.getByRole('button', { name: '请求命令' }));
}

const highCostTypes = [
  'CREATE_VIRTUAL_CHARACTER',
  'BIND_ASSET_TO_ENTITY',
  'GENERATE_SHOT',
  'SELECT_SHOT_OUTPUT',
  'EXPORT_PLAYLIST',
] as const;

describe('useCanvasCommandApprovalFlow', () => {
  it.each(highCostTypes)('prepares exact %s action after explicit confirmation and ignores a legacy static approval', async (commandType) => {
    const user = userEvent.setup();
    const prepare = vi.fn<PrepareHighCostApproval>(async () => ({ approvalId: preparedApprovalId, status: 'active' }));
    const onCommand = vi.fn();
    render(<Harness prepareHighCostApproval={prepare} onCommand={onCommand} />);

    await chooseAndRequest(user, commandType);

    expect(screen.getByRole('dialog', { name: '确认高成本操作' })).toBeInTheDocument();
    expect(prepare).not.toHaveBeenCalled();
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(context.projectId);
    expect(document.body.textContent).not.toContain(JSON.stringify(payloads[commandType]));

    await user.click(screen.getByRole('button', { name: '确认并继续' }));

    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
    expect(prepare).toHaveBeenCalledWith({
      ...context,
      commandType,
      action: {
        commandId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        payload: payloads[commandType],
      },
    });
    const dispatched = onCommand.mock.calls[0][0];
    expect(dispatched).toEqual({
      ...command(commandType),
      approvalId: preparedApprovalId,
      payload: payloads[commandType],
    });
    expect(dispatched.approvalId).not.toBe(legacyApprovalId);
  });

  it.each(['ANALYZE_ASSET_REQUIREMENTS', 'SYNC_PROVIDER_ASSET', 'SAVE_CANVAS_DOCUMENT'] as const)(
    'dispatches low-cost %s directly without preparing approval',
    async (commandType) => {
      const user = userEvent.setup();
      const prepare = vi.fn<PrepareHighCostApproval>();
      const onCommand = vi.fn();
      render(<Harness prepareHighCostApproval={prepare} onCommand={onCommand} />);

      await chooseAndRequest(user, commandType);

      await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
      expect(prepare).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onCommand.mock.calls[0][0]).toEqual({ ...command(commandType), approvalId: null });
    },
  );

  it('cancels before approval preparation and never dispatches', async () => {
    const user = userEvent.setup();
    const prepare = vi.fn<PrepareHighCostApproval>();
    const onCommand = vi.fn();
    render(<Harness prepareHighCostApproval={prepare} onCommand={onCommand} />);

    await chooseAndRequest(user, 'GENERATE_SHOT');
    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(prepare).not.toHaveBeenCalled();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('moves keyboard focus to the explicit confirmation action', async () => {
    const user = userEvent.setup();
    const prepare = vi.fn<PrepareHighCostApproval>(async () => ({ approvalId: preparedApprovalId, status: 'active' }));
    const onCommand = vi.fn();
    render(<Harness prepareHighCostApproval={prepare} onCommand={onCommand} />);

    await chooseAndRequest(user, 'GENERATE_SHOT');
    expect(screen.getByRole('button', { name: '确认并继续' })).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['cancelled', async () => null],
    ['expired', async () => ({ approvalId: preparedApprovalId, status: 'expired' as const })],
    ['invalid id', async () => ({ approvalId: 'not-a-uuid', status: 'active' as const })],
    ['unsafe projection', async () => ({ approvalId: preparedApprovalId, status: 'active' as const, secret: 'must-not-enter-state' })],
    ['failed', async () => { throw new Error('provider secret should never render'); }],
  ])('fails closed when approval preparation is %s', async (_case, result) => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<Harness prepareHighCostApproval={vi.fn(result as PrepareHighCostApproval)} onCommand={onCommand} />);

    await chooseAndRequest(user, 'GENERATE_SHOT');
    await user.click(screen.getByRole('button', { name: '确认并继续' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('未能取得有效操作确认');
    expect(screen.getByRole('alert')).not.toHaveTextContent('provider secret');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('rejects a result when current scope or actor changes while approval is pending', async () => {
    const user = userEvent.setup();
    let resolveApproval: ((value: { approvalId: string; status: 'active' }) => void) | undefined;
    const prepare = vi.fn<PrepareHighCostApproval>(() => new Promise((resolve) => { resolveApproval = resolve; }));
    const onCommand = vi.fn();
    const view = render(<Harness prepareHighCostApproval={prepare} onCommand={onCommand} />);

    await chooseAndRequest(user, 'GENERATE_SHOT');
    await user.click(screen.getByRole('button', { name: '确认并继续' }));
    view.rerender(
      <Harness
        executionContext={{ ...context, projectId: '29292929-2929-4929-8929-292929292929' }}
        prepareHighCostApproval={prepare}
        onCommand={onCommand}
      />,
    );
    resolveApproval?.({ approvalId: preparedApprovalId, status: 'active' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('deduplicates confirmation double clicks and reuses the same approved command after response loss', async () => {
    const user = userEvent.setup();
    let resolveApproval: ((value: { approvalId: string; status: 'active' }) => void) | undefined;
    const prepare = vi.fn<PrepareHighCostApproval>(() => new Promise((resolve) => { resolveApproval = resolve; }));
    const onCommand = vi.fn()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce(undefined);
    render(<Harness prepareHighCostApproval={prepare} onCommand={onCommand} />);

    await chooseAndRequest(user, 'GENERATE_SHOT');
    const confirm = screen.getByRole('button', { name: '确认并继续' });
    await Promise.all([user.click(confirm), user.click(confirm)]);
    expect(prepare).toHaveBeenCalledTimes(1);
    resolveApproval?.({ approvalId: preparedApprovalId, status: 'active' });

    expect(await screen.findByRole('alert')).toHaveTextContent('提交结果未知');
    const firstCommand = onCommand.mock.calls[0][0];
    await user.click(screen.getByRole('button', { name: '重试同一命令' }));

    await waitFor(() => expect(onCommand).toHaveBeenCalledTimes(2));
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[1][0]).toBe(firstCommand);
  });
});
