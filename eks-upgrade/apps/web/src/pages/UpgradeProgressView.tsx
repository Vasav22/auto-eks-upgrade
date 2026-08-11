import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Timeline,
  Tag,
  Button,
  Space,
  Typography,
  Spin,
  Progress,
  Alert,
  Descriptions,
  Badge,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  WifiOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface ActivityEntry {
  id: string;
  timestamp: string;
  type: string;
  payload: Record<string, unknown>;
  sequenceNumber: number;
}

interface UpgradeJobDetail {
  id: string;
  clusterId: string;
  clusterName?: string;
  targetVersion: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'STALLED';
  dryRun: boolean;
  initiatedBy: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  PENDING: { color: 'processing', icon: <SyncOutlined spin />, label: 'Pending' },
  IN_PROGRESS: { color: 'processing', icon: <SyncOutlined spin />, label: 'In Progress' },
  COMPLETED: { color: 'success', icon: <CheckCircleOutlined />, label: 'Completed' },
  FAILED: { color: 'error', icon: <CloseCircleOutlined />, label: 'Failed' },
  CANCELLED: { color: 'default', icon: <CloseCircleOutlined />, label: 'Cancelled' },
  STALLED: { color: 'warning', icon: <ExclamationCircleOutlined />, label: 'Stalled' },
};

const EVENT_COLOR: Record<string, string> = {
  UPGRADE_STARTED: 'blue',
  UPGRADE_COMPLETED: 'green',
  UPGRADE_FAILED: 'red',
  UPGRADE_STALLED: 'orange',
  POLL_RESULT: 'gray',
  POLL_ERROR: 'red',
  VALIDATION_PASSED: 'blue',
};

export default function UpgradeProgressView() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [jobDetail, setJobDetail] = useState<UpgradeJobDetail | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const lastSeqRef = useRef(0);
  const timelineEndRef = useRef<HTMLDivElement>(null);

  const wsUrl = jobId
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/upgrades`
    : null;

  const { sendJsonMessage, readyState } = useWebSocket(wsUrl, {
    onOpen: () => {
      if (jobId) {
        sendJsonMessage({ event: 'subscribe', data: { jobId } });
        sendJsonMessage({
          event: 'REQUEST_GAP_FILL',
          data: { jobId, lastSeq: lastSeqRef.current },
        });
      }
    },
    onMessage: (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        handleWsMessage(msg);
      } catch {
        /* ignore parse errors */
      }
    },
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
  });

  const handleWsMessage = (msg: { event: string; data: unknown }) => {
    if (msg.event === 'upgrade_progress' || msg.event === 'upgrade_completed' || msg.event === 'upgrade_failed' || msg.event === 'upgrade_stalled') {
      const data = msg.data as Record<string, unknown>;
      const entry: ActivityEntry = {
        id: String(Date.now()),
        timestamp: new Date().toISOString(),
        type: msg.event.toUpperCase(),
        payload: data,
        sequenceNumber: lastSeqRef.current + 1,
      };
      lastSeqRef.current = entry.sequenceNumber;

      setActivities((prev) => [...prev, entry]);

      if (data.status) {
        setJobDetail((prev) => prev ? { ...prev, status: data.status as any } : prev);
      }

      setTimeout(() => {
        timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }

    if (msg.event === 'GAP_FILL') {
      const data = msg.data as { events: ActivityEntry[] };
      if (data.events?.length > 0) {
        setActivities((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newEntries = data.events.filter((e) => !existingIds.has(e.id));
          return [...prev, ...newEntries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        });
      }
    }
  };

  useEffect(() => {
    if (!jobId) return;

    const fetchJob = async () => {
      try {
        setLoading(true);
        const [jobRes, activityRes] = await Promise.all([
          fetch(`/api/upgrades/${jobId}`, {
            headers: { Authorization: `Bearer ${user?.token ?? ''}` },
          }),
          fetch(`/api/upgrades/${jobId}/activity`, {
            headers: { Authorization: `Bearer ${user?.token ?? ''}` },
          }),
        ]);

        if (!jobRes.ok) throw new Error('Failed to load upgrade job');
        const job = await jobRes.json();
        setJobDetail(job);

        if (activityRes.ok) {
          const activityData = await activityRes.json();
          setActivities(activityData.events ?? []);
          const maxSeq = Math.max(0, ...(activityData.events ?? []).map((e: ActivityEntry) => e.sequenceNumber));
          lastSeqRef.current = maxSeq;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    void fetchJob();
  }, [jobId, user?.token]);

  const handleCancel = async () => {
    if (!jobId || !jobDetail) return;
    try {
      setCancelling(true);
      const res = await fetch(`/api/upgrades/${jobId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token ?? ''}` },
      });
      if (!res.ok) throw new Error('Cancel failed');
      setJobDetail((prev) => prev ? { ...prev, status: 'CANCELLED' } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  const connectionStatus = {
    [ReadyState.CONNECTING]: { label: 'Connecting', color: 'processing' as const, icon: <SyncOutlined spin /> },
    [ReadyState.OPEN]: { label: 'Live', color: 'success' as const, icon: <WifiOutlined /> },
    [ReadyState.CLOSING]: { label: 'Closing', color: 'warning' as const, icon: <DisconnectOutlined /> },
    [ReadyState.CLOSED]: { label: 'Disconnected', color: 'error' as const, icon: <DisconnectOutlined /> },
    [ReadyState.UNINSTANTIATED]: { label: 'Uninstantiated', color: 'default' as const, icon: null },
  }[readyState];

  const isTerminal = jobDetail && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(jobDetail.status);

  const getProgress = () => {
    if (!jobDetail) return 0;
    if (jobDetail.status === 'COMPLETED') return 100;
    if (jobDetail.status === 'FAILED' || jobDetail.status === 'CANCELLED') return 0;
    if (activities.length === 0) return 5;
    return Math.min(90, 5 + activities.length * 3);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="Failed to load upgrade job"
        description={error}
        action={<Button onClick={() => navigate(-1)}>Go Back</Button>}
      />
    );
  }

  const statusCfg = jobDetail ? (STATUS_CONFIG[jobDetail.status] ?? STATUS_CONFIG.PENDING) : STATUS_CONFIG.PENDING;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Back
        </Button>
        {!isTerminal && (
          <Button
            danger
            icon={<CloseCircleOutlined />}
            loading={cancelling}
            onClick={handleCancel}
          >
            Cancel Upgrade
          </Button>
        )}
        <Badge
          status={connectionStatus.color}
          text={
            <Space>
              {connectionStatus.icon}
              <Text type="secondary">{connectionStatus.label}</Text>
            </Space>
          }
        />
      </Space>

      <Title level={3}>
        Upgrade Job
        {jobDetail?.dryRun && (
          <Tag color="orange" style={{ marginLeft: 8 }}>
            DRY RUN
          </Tag>
        )}
      </Title>

      {jobDetail && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Job ID">
                <Text copyable code style={{ fontSize: 11 }}>
                  {jobDetail.id}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Badge status={statusCfg.color as any} text={statusCfg.label} />
              </Descriptions.Item>
              <Descriptions.Item label="Target Version">
                <Tag color="blue">{jobDetail.targetVersion}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {new Date(jobDetail.createdAt).toLocaleString()}
              </Descriptions.Item>
              {jobDetail.startedAt && (
                <Descriptions.Item label="Started">
                  {new Date(jobDetail.startedAt).toLocaleString()}
                </Descriptions.Item>
              )}
              {jobDetail.completedAt && (
                <Descriptions.Item label="Completed">
                  {new Date(jobDetail.completedAt).toLocaleString()}
                </Descriptions.Item>
              )}
            </Descriptions>

            {!isTerminal && (
              <>
                <Divider />
                <Progress
                  percent={getProgress()}
                  status={jobDetail.status === 'STALLED' ? 'exception' : 'active'}
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />
              </>
            )}

            {jobDetail.status === 'STALLED' && (
              <Alert
                type="warning"
                showIcon
                message="Upgrade appears stalled"
                description="The upgrade has not progressed in 30 minutes. This may indicate an issue with the cluster or AWS service. Check the AWS Console for more details."
                style={{ marginTop: 12 }}
              />
            )}

            {jobDetail.status === 'COMPLETED' && (
              <Alert type="success" showIcon message="Upgrade completed successfully" style={{ marginTop: 12 }} />
            )}

            {jobDetail.status === 'FAILED' && (
              <Alert type="error" showIcon message="Upgrade failed" style={{ marginTop: 12 }} />
            )}
          </Card>

          <Card
            title={
              <Space>
                <span>Activity Log</span>
                <Tag>{activities.length} events</Tag>
                {!isTerminal && (
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => sendJsonMessage({ event: 'REQUEST_GAP_FILL', data: { jobId, lastSeq: lastSeqRef.current } })}
                  />
                )}
              </Space>
            }
            style={{ maxHeight: 500, overflowY: 'auto' }}
          >
            {activities.length === 0 ? (
              <Text type="secondary">No activity yet. Waiting for events…</Text>
            ) : (
              <Timeline
                mode="left"
                items={activities.map((entry) => ({
                  key: entry.id,
                  color: EVENT_COLOR[entry.type] ?? 'blue',
                  label: new Date(entry.timestamp).toLocaleTimeString(),
                  children: (
                    <div>
                      <Tag color={EVENT_COLOR[entry.type] ?? 'blue'} style={{ fontSize: 11 }}>
                        {entry.type}
                      </Tag>
                      {entry.payload.message && (
                        <Text style={{ display: 'block', marginTop: 4 }}>
                          {String(entry.payload.message)}
                        </Text>
                      )}
                      {entry.payload.awsStatus && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          AWS status: {String(entry.payload.awsStatus)}
                        </Text>
                      )}
                    </div>
                  ),
                }))}
              />
            )}
            <div ref={timelineEndRef} />
          </Card>
        </>
      )}
    </div>
  );
}
