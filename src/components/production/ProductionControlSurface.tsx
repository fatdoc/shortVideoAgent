import {
  ApiOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  FileDoneOutlined,
  LinkOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Progress,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_PROJECT_ID, ROUTES } from '../../domain/constants';
import { isPhase1HandoffReady } from '../../domain/phase1Production';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';
import {
  DEMO_FAILURE_TASK_ID,
  DEMO_SUCCESS_TASK_ID,
} from '../../mocks/controlPlaneDemo';
import { CanonicalScriptApproval } from './CanonicalScriptApproval';
import { TruthBadge } from '../workbench/TruthBadge';

export type ProductionView = 'all' | 'inbox' | 'tasks' | 'assets' | 'export';

interface ProductionControlSurfaceProps {
  view?: ProductionView;
}

interface FlowAction {
  key: string;
  index: string;
  title: string;
  detail: string;
  done: boolean;
  disabled: boolean;
  action: () => void | Promise<unknown>;
  buttonLabel: string;
  tone?: 'success' | 'failure';
}

function shortDigest(value: string) {
  return `${value.slice(0, 18)}…${value.slice(-8)}`;
}

export function ProductionControlSurface({
  view = 'all',
}: ProductionControlSurfaceProps) {
  const navigate = useNavigate();
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  const phase1Projection = useControlPlaneStore((state) => state.phase1Projection);
  const loading = useControlPlaneStore((state) => state.loading);
  const error = useControlPlaneStore((state) => state.error);
  const lastAction = useControlPlaneStore((state) => state.lastAction);
  const bootstrapResult = useControlPlaneStore((state) => state.bootstrapResult);
  const lastPackageDispatch = useControlPlaneStore(
    (state) => state.lastPackageDispatch,
  );
  const lastReceiptSync = useControlPlaneStore((state) => state.lastReceiptSync);
  const clearError = useControlPlaneStore((state) => state.clearError);
  const dispatchPackage = useControlPlaneStore(
    (state) => state.dispatchCanonicalPackage,
  );
  const retryPackage = useControlPlaneStore(
    (state) => state.retryCanonicalPackage,
  );
  const syncReceipts = useControlPlaneStore(
    (state) => state.syncStoryCanvasReceipts,
  );
  const reserveSuccess = useControlPlaneStore(
    (state) => state.reserveCanonicalSuccess,
  );
  const reserveFailure = useControlPlaneStore(
    (state) => state.reserveCanonicalFailure,
  );
  const resetDemoReady = useControlPlaneStore((state) => state.resetDemoReady);
  const [packageInspectorOpen, setPackageInspectorOpen] = useState(false);

  const credit = snapshot.commercial.creditState;
  const successReservation = credit.reservations.find(
    (reservation) => reservation.taskId === DEMO_SUCCESS_TASK_ID,
  );
  const failureReservation = credit.reservations.find(
    (reservation) => reservation.taskId === DEMO_FAILURE_TASK_ID,
  );
  const successTask = snapshot.generationTaskReceipts.find(
    (receipt) => receipt.generationTaskId === DEMO_SUCCESS_TASK_ID,
  );
  const failureTask = snapshot.generationTaskReceipts.find(
    (receipt) => receipt.generationTaskId === DEMO_FAILURE_TASK_ID,
  );
  const successAsset = snapshot.assetReceipts.find(
    (receipt) => receipt.generationTaskId === DEMO_SUCCESS_TASK_ID,
  );
  const successExport = snapshot.exportReceipts.find(
    (receipt) => receipt.generationTaskId === DEMO_SUCCESS_TASK_ID,
  );
  const productionPackage = snapshot.package;
  const phase1Handoff = phase1Projection?.handoffs?.find(
    (handoff) => handoff.packageId === productionPackage?.packageId,
  );
  const grant = snapshot.grants[0];
  const sourceTask = successTask ?? failureTask;
  const sourceAsset = sourceTask
    ? snapshot.assetReceipts.find(
        (receipt) => receipt.generationTaskId === sourceTask.generationTaskId,
      )
    : null;
  const sourceExport = sourceTask
    ? snapshot.exportReceipts.find(
        (receipt) => receipt.generationTaskId === sourceTask.generationTaskId,
      )
    : null;
  const sourceReservation = sourceTask
    ? credit.reservations.find(
        (reservation) => reservation.taskId === sourceTask.generationTaskId,
      )
    : null;
  const scriptApproval = snapshot.scriptApprovals.find(
    (approval) => approval.scriptVersionId === 'script-a',
  );
  const transport = snapshot.transport;
  const visibleReceiptSync = transport.lastAttemptAt ? lastReceiptSync : null;
  const packageAccepted =
    (isPhase1HandoffReady(phase1Handoff) ||
      ([
      'accepted',
      'duplicate',
      'handoff_waiting',
      'handoff_ready',
      'handoff_timeout',
    ].includes(transport.phase) ||
      ['accepted', 'duplicate'].includes(
        lastPackageDispatch?.response?.result ?? '',
      ))) &&
    transport.packageId === productionPackage?.packageId &&
    transport.projectId === productionPackage?.projectId;
  const retryableTransport =
    !packageAccepted &&
    Boolean(transport.lastAttemptAt) &&
    ['offline', 'rejected', 'error'].includes(transport.phase);
  const resetSucceeded =
    lastAction === 'resetDemoExperience' &&
    !error &&
    snapshot.stateName === 'DEMO_READY';
  const resetFailed = lastAction === 'resetDemoExperience:failed';
  const fallbackTruth = snapshot.truthManifest.entries.find(
    (entry) => entry.capabilityId === 'production.basic-ffmpeg-merge',
  );

  const flowActions = useMemo<FlowAction[]>(
    () => [
      {
        key: 'dispatch',
        index: '01',
        title: 'POST canonical package + Demo grant',
        detail: '一次调用创建/复用包与 Grant，并等待 StoryCanvas accepted / duplicate。',
        done: packageAccepted,
        disabled: scriptApproval?.status !== 'approved',
        action: dispatchPackage,
        buttonLabel: '发包并握手',
      },
      {
        key: 'reserve-success',
        index: '02',
        title: '成功支线预冻结 120',
        detail: 'reserve 120；随后进入同页画布执行成功案例，再回到任务页同步回执。',
        done: Boolean(successReservation),
        disabled: !packageAccepted,
        action: reserveSuccess,
        buttonLabel: 'Reserve 120',
        tone: 'success',
      },
      {
        key: 'sync-success',
        index: '03',
        title: '同步并确认成功交付',
        detail: '轮询 Outbox，Task → Asset → Export 全部 ACK 后才完成并结算 100 + 20。',
        done: Boolean(successTask && successAsset && successExport),
        disabled: !successReservation,
        action: syncReceipts,
        buttonLabel: '同步 Outbox',
        tone: 'success',
      },
      {
        key: 'reserve-failure',
        index: '04',
        title: '失败支线预冻结 80',
        detail: '成功交付闭环后 reserve 80；在画布执行失败案例，不生成假资产。',
        done: Boolean(failureReservation),
        disabled: !successExport,
        action: reserveFailure,
        buttonLabel: 'Reserve 80',
        tone: 'failure',
      },
      {
        key: 'sync-failure',
        index: '05',
        title: '同步并确认失败回执',
        detail: '匹配的失败 Task receipt 进入控制平面；无 Asset，释放全部 80。',
        done: Boolean(failureTask),
        disabled: !failureReservation,
        action: syncReceipts,
        buttonLabel: '再次同步 Outbox',
        tone: 'failure',
      },
    ],
    [
      dispatchPackage,
      failureReservation,
      failureTask,
      packageAccepted,
      reserveFailure,
      reserveSuccess,
      scriptApproval?.status,
      syncReceipts,
      successAsset,
      successExport,
      successReservation,
      successTask,
    ],
  );

  const completed = flowActions.filter((item) => item.done).length;
  const progress = Math.round((completed / flowActions.length) * 100);
  const generationLedger = credit.ledger.filter(
    (entry) => entry.referenceType === 'GENERATION_TASK',
  );
  const availableForNextTask =
    credit.wallet.available.value >=
    snapshot.commercial.rateCard.maxReservedCredits.value;

  return (
    <div className="d1-production-stack">
      {error ? (
        <Alert
          type="error"
          showIcon
          closable
          onClose={clearError}
          message={`${error.code} · 控制平面拒绝本次操作`}
          description={error.message}
          action={
            error.retryable && retryableTransport ? (
              <Button size="small" loading={loading} onClick={retryPackage}>
                重试同一生产包
              </Button>
            ) : null
          }
        />
      ) : null}

      <section className="d1-production-hero">
        <div>
          <Space size={8} wrap>
            <Tag color="blue">demo-local-001</Tag>
            <TruthBadge capabilityId="control.production-contract-adapter" compact />
            <Tag>{snapshot.truthManifest.disclaimer}</Tag>
          </Space>
          <Typography.Title level={3}>海底捞三里屯 · 双平面生产控制</Typography.Title>
          <Typography.Paragraph type="secondary">
            每一步直接调用 C4 ControlPlane Mock Adapter；任务状态与额度状态分别推进。
          </Typography.Paragraph>
        </div>
        <div className="d1-production-progress">
          <Progress type="circle" size={76} percent={progress} />
          <div>
            <Typography.Text strong>
              {completed} / {flowActions.length} 状态已完成
            </Typography.Text>
            <Typography.Text type="secondary">
              Last action: {lastAction ?? '等待操作'}
            </Typography.Text>
          </div>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={resetDemoReady}
          >
            重置 DEMO_READY
          </Button>
          {resetSucceeded ? <Tag color="success">reset ready</Tag> : null}
          {resetFailed ? <Tag color="error">reset error</Tag> : null}
        </div>
      </section>

      <CanonicalScriptApproval />

      <section className="d1-wallet-rail">
        <div>
          <Typography.Text type="secondary">可用额度</Typography.Text>
          <Typography.Title level={2}>{credit.wallet.available.value}</Typography.Title>
        </div>
        <div>
          <Typography.Text type="secondary">冻结额度</Typography.Text>
          <Typography.Title level={2}>{credit.wallet.reserved.value}</Typography.Title>
        </div>
        <div>
          <Typography.Text type="secondary">成功支线</Typography.Text>
          <Typography.Text strong>
            {successReservation
              ? `${successReservation.status} · ${successReservation.consumedCredits.value} 消费 / ${successReservation.releasedCredits.value} 释放`
              : 'requested · 120 → 100 + 20'}
          </Typography.Text>
        </div>
        <div>
          <Typography.Text type="secondary">失败支线</Typography.Text>
          <Typography.Text strong>
            {failureReservation
              ? `${failureReservation.status} · ${failureReservation.consumedCredits.value} 消费 / ${failureReservation.releasedCredits.value} 释放`
              : 'requested · 80 → 0 + 80'}
          </Typography.Text>
        </div>
      </section>

      <Alert
        type={availableForNextTask ? 'success' : 'error'}
        showIcon
        message={
          availableForNextTask
            ? '额度门禁已通过'
            : 'INSUFFICIENT_CREDITS · 可用额度不足'
        }
        description={
          availableForNextTask
            ? `当前可用 ${credit.wallet.available.value}，满足演示 RateCard 最大冻结 ${snapshot.commercial.rateCard.maxReservedCredits.value}。`
            : '控制平面不会部分冻结或透支；请重置 DEMO_READY 或联系企业管理员。'
        }
      />

      {view === 'all' || view === 'inbox' ? (
        <section className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>生产包与 StoryCanvas 入口</Typography.Title>
              <Typography.Text type="secondary">
                发包完成后进入同一 SaaS 前端内嵌画布；Grant 只通过 React 内存边界传递。
              </Typography.Text>
            </div>
            <Space wrap>
              {!packageAccepted && !retryableTransport ? (
                <Button
                  type="primary"
                  loading={loading}
                  disabled={scriptApproval?.status !== 'approved'}
                  onClick={dispatchPackage}
                >
                  POST package + grant
                </Button>
              ) : null}
              {retryableTransport ? (
                <Button
                  danger
                  icon={<ReloadOutlined />}
                  loading={loading}
                  onClick={retryPackage}
                >
                  重试发包
                </Button>
              ) : null}
              <Button
                icon={<FileDoneOutlined />}
                disabled={!productionPackage}
                onClick={() => setPackageInspectorOpen(true)}
              >
                检查生产包
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                disabled={!packageAccepted}
                onClick={() =>
                  navigate(ROUTES.productionCanvas(DEMO_PROJECT_ID))
                }
              >
                进入 StoryCanvas 画布
              </Button>
            </Space>
          </div>

          {phase1Handoff ? (
            <Alert
              type={isPhase1HandoffReady(phase1Handoff) ? 'success' : 'error'}
              showIcon
              message={`Production handoff · ${phase1Handoff.status}`}
              description={
                phase1Handoff.error
                  ? `${phase1Handoff.error.code} · ${phase1Handoff.error.message}`
                  : `Grant ${phase1Handoff.grantStatus} · Package ${phase1Handoff.packageId}`
              }
            />
          ) : null}

          <div className="d1-connection-line">
            <div className="is-ready">
              <CloudServerOutlined />
              <span>控制平面</span>
              <small>
                {productionPackage && grant
                  ? 'package + grant ready'
                  : 'waiting approved script'}
              </small>
            </div>
            <span className="d1-connection-track" />
            <div className={packageAccepted ? 'is-ready' : 'is-offline'}>
              <ApiOutlined />
              <span>StoryCanvas</span>
              <small>
                {packageAccepted
                  ? `${transport.phase} · embedded route ready`
                  : `${transport.phase} · HTTP_NOT_CONNECTED`}
              </small>
            </div>
          </div>

          {!packageAccepted ? (
            <Alert
              type="warning"
              showIcon
              message={`${bootstrapResult.status === 'offline' ? 'HTTP_NOT_CONNECTED' : transport.phase} · StoryCanvas 尚未完成握手`}
              description="不会提前开放 deepLink。可发包/重试；服务离线时使用同一 canonical package 检查器，不伪装为已连通。"
              action={
                <TruthBadge
                  capabilityId="production.storycanvas-foundation"
                  compact
                />
              }
            />
          ) : (
            <Alert
              type="success"
              showIcon
              message={`${transport.phase} · 同页画布入口已就绪`}
              description="Package 与当前 Grant 已验证。进入 /production/canvas/demo-local-001 后由根应用以内存 Prop 注入 Grant，不经过 URL、LocalStorage、sessionStorage 或子窗消息。"
              action={
                <Button
                  size="small"
                  type="primary"
                  onClick={() =>
                    navigate(ROUTES.productionCanvas(DEMO_PROJECT_ID))
                  }
                >
                  打开画布
                </Button>
              }
            />
          )}
        </section>
      ) : null}

      {view === 'all' || view === 'tasks' ? (
        <section className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>状态推进</Typography.Title>
              <Typography.Text type="secondary">
                顺序执行，成功任务必须等资产登记后才能结算。
              </Typography.Text>
            </div>
            <TruthBadge
              capabilityId="control.production-contract-adapter"
              compact
            />
          </div>

          <div className="d1-flow-list">
            {flowActions.map((item) => (
              <article
                key={item.key}
                className={`d1-flow-row is-${item.tone ?? 'neutral'} ${
                  item.done ? 'is-done' : ''
                }`}
              >
                <span className="d1-flow-index">{item.index}</span>
                <span className="d1-flow-status">
                  {item.done ? <CheckCircleOutlined /> : <span />}
                </span>
                <div className="d1-flow-copy">
                  <Typography.Text strong>{item.title}</Typography.Text>
                  <Typography.Text type="secondary">{item.detail}</Typography.Text>
                </div>
                <div className="d1-flow-actions">
                  <TruthBadge
                    capabilityId="control.production-contract-adapter"
                    compact
                  />
                  <Button
                    type={item.done ? 'default' : 'primary'}
                    danger={item.tone === 'failure' && !item.done}
                    disabled={item.disabled || item.done}
                    loading={loading}
                    onClick={item.action}
                  >
                    {item.done ? '已完成' : item.buttonLabel}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {view === 'all' || view === 'tasks' || view === 'assets' ? (
        <section className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>StoryCanvas Receipt Outbox</Typography.Title>
              <Typography.Text type="secondary">
                delivered → ACK → acknowledged；C4 只在 ACK 成功后 apply，ACK
                失败保持 Task / Asset / Credit 零变化。
              </Typography.Text>
            </div>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              disabled={!packageAccepted}
              loading={loading}
              onClick={syncReceipts}
            >
              同步并 ACK
            </Button>
          </div>

          <div className="d1-outbox-lifecycle">
            {[
              {
                key: 'waiting',
                label: 'waiting',
                active: packageAccepted && !visibleReceiptSync,
              },
              {
                key: 'delivered',
                label: 'delivered',
                active: Boolean(visibleReceiptSync?.items.length),
              },
              {
                key: 'acknowledged',
                label: 'acknowledged',
                active: Boolean(
                  visibleReceiptSync?.items.some((item) => item.acked),
                ),
              },
              {
                key: 'retry',
                label: 'retry · zero-entry',
                active:
                  transport.phase === 'error' ||
                  Boolean(
                    visibleReceiptSync?.items.some(
                      (item) =>
                        item.status === 'ack_error' || item.status === 'rejected',
                    ),
                  ),
              },
            ].map((stage) => (
              <div
                key={stage.key}
                className={stage.active ? 'is-active' : undefined}
              >
                <span>{stage.label}</span>
              </div>
            ))}
          </div>

          {visibleReceiptSync?.items.length ? (
            <div className="d1-receipt-list">
              {visibleReceiptSync.items.map((item) => (
                <div className="d1-receipt-row" key={item.deliveryId}>
                  <span
                    className={`d1-receipt-icon ${
                      item.acked ? 'is-success' : 'is-failure'
                    }`}
                  >
                    {item.acked ? <CheckCircleOutlined /> : <SyncOutlined />}
                  </span>
                  <div>
                    <Typography.Text strong>
                      {item.kind.toUpperCase()} · {item.receiptId}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      delivery {item.deliveryId} ·{' '}
                      {item.acked
                        ? 'delivered → acknowledged · 已入账'
                        : item.status === 'ack_error'
                          ? 'delivered · ACK 失败 · 零入账 / 可重试'
                          : 'delivered · 已拒绝 · 零入账'}
                    </Typography.Text>
                    {item.error ? (
                      <Typography.Text type="danger">
                        {item.error.code} · {item.error.message}
                      </Typography.Text>
                    ) : null}
                  </div>
                  <Tag color={item.acked ? 'green' : 'red'}>
                    {item.status}
                  </Tag>
                </div>
              ))}
            </div>
          ) : (
            <Alert
              type={transport.phase === 'error' ? 'error' : 'info'}
              showIcon
              message={
                transport.phase === 'error'
                  ? 'Receipt 同步失败，可重试'
                  : '尚无已交付回执'
              }
              description="钱包只显示 useControlPlaneStore 的账本投影；未 ACK 的回执不生成 Task、Asset 或额度流水。"
            />
          )}
          {visibleReceiptSync?.items.some(
            (item) => item.status === 'ack_error',
          ) ? (
            <Alert
              type="warning"
              showIcon
              message="ACK 失败 · 本地零入账"
              description="C4 已保留 delivered 回执供安全重试；当前 Task、Asset、Export 与 Wallet 不因本次失败变化。"
            />
          ) : null}
        </section>
      ) : null}

      {view === 'all' || view === 'assets' ? (
        <section className="d1-detail-grid">
          <div className="d1-surface">
            <div className="d1-section-heading">
              <div>
                <Typography.Title level={4}>控制平面回执事实</Typography.Title>
                <Typography.Text type="secondary">
                  Task / Asset / Export 分开显示；只读取 useControlPlaneStore。
                </Typography.Text>
              </div>
            </div>
            <div className="d1-receipt-group">
              <Space>
                <Typography.Text strong>TaskReceipt</Typography.Text>
                <Tag>{snapshot.generationTaskReceipts.length}</Tag>
              </Space>
              {snapshot.generationTaskReceipts.length ? (
                <div className="d1-receipt-list">
                  {snapshot.generationTaskReceipts.map((receipt) => (
                    <div className="d1-receipt-row" key={receipt.generationTaskId}>
                      <span
                        className={
                          receipt.status === 'succeeded'
                            ? 'd1-receipt-icon is-success'
                            : 'd1-receipt-icon is-failure'
                        }
                      >
                        {receipt.status === 'succeeded' ? (
                          <CheckCircleOutlined />
                        ) : (
                          <StopOutlined />
                        )}
                      </span>
                      <div>
                        <Typography.Text strong>
                          {receipt.generationTaskId}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          {receipt.shotId} · {receipt.taskType} · {receipt.model}
                        </Typography.Text>
                      </div>
                      <Tag color={receipt.status === 'succeeded' ? 'green' : 'red'}>
                        {receipt.status}
                      </Tag>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 TaskReceipt" />
              )}
            </div>

            <div className="d1-receipt-group">
              <Space>
                <Typography.Text strong>AssetReceipt</Typography.Text>
                <Tag>{snapshot.assetReceipts.length}</Tag>
              </Space>
              {snapshot.assetReceipts.length ? (
                <div className="d1-receipt-list">
                  {snapshot.assetReceipts.map((receipt) => (
                    <div className="d1-receipt-row" key={receipt.assetId}>
                      <span className="d1-receipt-icon is-asset">
                        <SafetyCertificateOutlined />
                      </span>
                      <div>
                        <Typography.Text strong>{receipt.assetId}</Typography.Text>
                        <Typography.Text type="secondary">
                          {receipt.dimensions.width}×{receipt.dimensions.height} ·{' '}
                          {receipt.reviewStatus}
                        </Typography.Text>
                      </div>
                      <Tag
                        color={
                          receipt.reviewStatus === 'approved'
                            ? 'green'
                            : receipt.reviewStatus === 'qa_blocked'
                              ? 'red'
                              : 'blue'
                        }
                      >
                        {receipt.reviewStatus}
                      </Tag>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 AssetReceipt" />
              )}
              {snapshot.assetReceipts.some(
                (receipt) => receipt.reviewStatus === 'qa_blocked',
              ) ? (
                <Alert
                  type="error"
                  showIcon
                  message="qa_blocked · 资产不可进入可播放交付"
                />
              ) : null}
            </div>

            <div className="d1-receipt-group">
              <Space>
                <Typography.Text strong>ExportReceipt</Typography.Text>
                <Tag>{snapshot.exportReceipts.length}</Tag>
              </Space>
              {snapshot.exportReceipts.length ? (
              <div className="d1-receipt-list">
                {snapshot.exportReceipts.map((receipt) => {
                  const playable =
                    receipt.status === 'succeeded' &&
                    receipt.outputAssetIds.length > 0 &&
                    receipt.outputAssetIds.every((assetId) =>
                      snapshot.assetReceipts.some(
                        (asset) =>
                          asset.assetId === assetId &&
                          asset.reviewStatus === 'approved',
                      ),
                    );
                  return (
                  <div className="d1-receipt-row" key={receipt.exportId}>
                    <span
                      className={`d1-receipt-icon ${
                        playable ? 'is-success' : 'is-failure'
                      }`}
                    >
                      {playable ? <CheckCircleOutlined /> : <StopOutlined />}
                    </span>
                    <div>
                      <Typography.Text strong>{receipt.exportId}</Typography.Text>
                      <Typography.Text type="secondary">
                        {receipt.status} · output {receipt.outputAssetIds.length} ·{' '}
                        playable={String(playable)}
                      </Typography.Text>
                    </div>
                    <Tag color={playable ? 'green' : 'red'}>
                      {playable ? 'playable=true' : 'playable=false'}
                    </Tag>
                  </div>
                  );
                })}
              </div>
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="尚无 ExportReceipt · playable=false"
                  description="不会把静态素材、qa_blocked 资产或 FALLBACK 说明包装成成片。"
                />
              )}
            </div>
          </div>

          <div className="d1-surface">
            <div className="d1-section-heading">
              <div>
                <Typography.Title level={4}>额度流水</Typography.Title>
                <Typography.Text type="secondary">
                  append-only · {snapshot.truthManifest.disclaimer}
                </Typography.Text>
              </div>
            </div>
            {generationLedger.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务额度流水" />
            ) : (
              <div className="d1-ledger-list">
                {generationLedger.map((entry) => (
                  <div className="d1-ledger-row" key={entry.entryId}>
                    <div>
                      <Typography.Text strong>{entry.operation}</Typography.Text>
                      <Typography.Text type="secondary">
                        {entry.referenceId} · {entry.bucket}
                      </Typography.Text>
                    </div>
                    <Typography.Text
                      strong
                      type={entry.delta.value < 0 ? 'danger' : 'success'}
                    >
                      {entry.delta.value > 0 ? '+' : ''}
                      {entry.delta.value}
                    </Typography.Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {view === 'all' || view === 'export' ? (
        <section className="d1-surface">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={4}>交付与来源链</Typography.Title>
              <Typography.Text type="secondary">
                当前只呈现已登记来源事实；不生成未接入的 ExportArtifact。
              </Typography.Text>
            </div>
            <Space wrap>
              <TruthBadge capabilityId="production.basic-ffmpeg-merge" compact />
              <Button disabled icon={<LinkOutlined />}>
                {snapshot.exportReceipts.length
                  ? '无可验证下载地址'
                  : '等待 ExportReceipt'}
              </Button>
            </Space>
          </div>

          {productionPackage && sourceTask && sourceReservation ? (
            <div className="d1-source-chain">
              {[
                ['Tenant', productionPackage.tenantId],
                ['Package', productionPackage.packageId],
                ['Script', productionPackage.approvedScriptVersion.id],
                ['Task', sourceTask.generationTaskId],
                ['Asset', sourceAsset?.assetId ?? '无可交付资产'],
                ['Export', sourceExport?.exportId ?? '无 ExportReceipt'],
                [
                  'Credit',
                  `${sourceReservation.status} · ${sourceReservation.consumedCredits.value} consumed`,
                ],
              ].map(([label, value]) => (
                <div className="d1-chain-node" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="完成成功或失败回执后生成可下钻来源链"
            />
          )}

          <Alert
            type={
              snapshot.exportReceipts.some(
                (receipt) =>
                  receipt.status === 'succeeded' &&
                  receipt.outputAssetIds.length > 0,
              )
                ? 'warning'
                : 'info'
            }
            showIcon
            message={`${
              fallbackTruth?.displayName ?? '基础合并导出'
            } · playable=false`}
            description={
              `${
                fallbackTruth?.knownLimitations.join('；') ??
                '当前没有可验证的导出能力声明。'
              }；仅有 succeeded receipt 仍不足以证明可播放，必须同时有已批准输出资产和可验证交付引用。`
            }
          />
        </section>
      ) : null}

      <Drawer
        open={packageInspectorOpen}
        onClose={() => setPackageInspectorOpen(false)}
        title="ProjectProductionPackage 检查器"
        width={640}
      >
        {productionPackage ? (
          <Space direction="vertical" size={18} style={{ width: '100%' }}>
            <Alert
              type={packageAccepted ? 'info' : 'warning'}
              showIcon
              message={
                packageAccepted
                  ? `${transport.phase} · StoryCanvas 已接受同一生产包`
                  : 'HTTP_NOT_CONNECTED · 使用包检查器降级'
              }
              description="本页只检查 canonical package；不会伪造接收、生成或导出成功。"
            />
            <Descriptions
              column={1}
              size="small"
              items={[
                {
                  key: 'contract',
                  label: 'Contract',
                  children: `v${productionPackage.contractVersion}`,
                },
                {
                  key: 'project',
                  label: 'Project',
                  children: productionPackage.projectId,
                },
                {
                  key: 'tenant',
                  label: 'Tenant',
                  children: productionPackage.tenantId,
                },
                {
                  key: 'package',
                  label: 'Package',
                  children: productionPackage.packageId,
                },
                {
                  key: 'digest',
                  label: 'Digest',
                  children: (
                    <Typography.Text copyable={{ text: productionPackage.digest }}>
                      {shortDigest(productionPackage.digest)}
                    </Typography.Text>
                  ),
                },
                {
                  key: 'claims',
                  label: 'Claims',
                  children: productionPackage.brandFactsSnapshot
                    .map((claim) => claim.id)
                    .join(' · '),
                },
                {
                  key: 'script',
                  label: 'Approved script',
                  children: productionPackage.approvedScriptVersion.id,
                },
                {
                  key: 'shots',
                  label: 'Shots',
                  children: `${productionPackage.shotDrafts.length} 镜 · ${productionPackage.target.aspectRatio} · ${productionPackage.target.durationSeconds}s`,
                },
                {
                  key: 'grant',
                  label: 'Grant',
                  children: grant
                    ? `${grant.grantId} · ${grant.truthMode}`
                    : '尚未签发',
                },
              ]}
            />
            <TruthBadge
              capabilityId="control.production-contract-adapter"
            />
          </Space>
        ) : (
          <Empty description="请先创建 canonical production package" />
        )}
      </Drawer>
    </div>
  );
}
