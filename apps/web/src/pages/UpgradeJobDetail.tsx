import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Spin,
  Alert,
  Button,
  Space,
  Timeline,
  Progress,
  Divider,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  StopOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useWebSocketReconnect } from '../hooks/useWebSocketReconnect';

const { Title, Text } = Typography;

interface UpgradeJob {
  id: string;
  cluster: {
    clusterName: string;
    region: string;
  };
  currentVersion: string;
  targetVersion: string;
  status: string;
  dryRun: boolean;
  initiatedBy: string;
  validationWarnings: string[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface ActivityEvent {
  id: string;
  eventType: string;
  eventData: any;
  sequenceNumber: number;
  timestamp: string;
}

export default function UpgradeJobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<UpgradeJob | null>(null);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const { connectionStatus, lastMessage } = useWebSocketReconnect(
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/upgrades`,
    {
      onOpen: (socket) => {
        socket.emit('subscribe', { upgradeJobId: id });
      },
    },
  );

  useEffect(() => {
    fetchJob();
    fetchActivities();
  }, [id]);

  useEffect(() => {
    if (lastMessage) {
      handleWebSocketEvent(lastMessage);
    }
  }, [lastMessage]);

  const fetchJob = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/upgrades/${id}`);
      setJob(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load upgrade job');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await axios.get(`/api/upgrades/${id}/activity-log`);
      setActivities(response.data.events);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    }
  };

  const handleWebSocketEvent = (event: any) => {
    if (event.eventType === 'upgrade_status_changed') {
      setJob((prev) => prev ? { ...prev, status: event.data.status } : null);
    }

    if (event.eventType === 'upgrade_progress') {
      setActivities((prev) => [
        ...prev,
        {
          id: event.messageId,
          eventType: event.eventType,
          eventData: event.data,
          sequenceNumber: prev.length + 1,
          timestamp: new Date(event.timestamp).toISOString(),
        },
      ]);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this upgrade?')) {
      return;
    }

    try {
      setCancelling(true);
      await axios.delete(`/api/upgrades/${id}`);
      await fetchJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel upgrade');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; icon: any }> = {
      PENDING: { color: 'default', icon: <ClockCircleOutlined /> },
      IN_PROGRESS: { color: 'processing', icon: <SyncOutlined spin /> },
      COMPLETED: { color: 'success', icon: <CheckCircleOutlined /> },
      FAILED: { color: 'error', icon: <CloseCircleOutlined /> },
      CANCELLED: { color: 'warning', icon: <StopOutlined /> },
      DRY_RUN: { color: 'blue', icon: <ClockCircleOutlined /> },
    };

    const config = statusMap[status] || { color: 'default', icon: null };
    return (
      <Tag color={config.color} icon={config.icon} style={{ fontSize: '14px' }}>
        {status}
      </Tag>
    );
  };

  const getProgressPercent = () => {
    if (!job) return 0;
    if (job.status === 'COMPLETED') return 100;
    if (job.status === 'FAILED' || job.status === 'CANCELLED') return 0;
    if (job.status === 'IN_PROGRESS') return 50;
    return 0;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error && !job) {
    return (
      <Alert
        message="Error Loading Upgrade Job"
        description={error}
        type="error"
        showIcon
        action={
          <Button size="small" danger onClick={fetchJob}>
            Retry
          </Button>
        }
      />
    );
  }

  if (!job) {
    return (
      <Alert
        message="Upgrade Job Not Found"
        type="warning"
        showIcon
      />
    );
  }

  const canCancel = job.status === 'PENDING' || job.status === 'IN_PROGRESS';

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/upgrades')}
            >
              Back to Upgrades
            </Button>
            <Title level={2} style={{ margin: 0 }}>
              Upgrade Job Details
            </Title>
          </Space>
          <Space>
            <Tag color={connectionStatus === 'connected' ? 'success' : 'default'}>
              {connectionStatus === 'connected' ? 'Live' : 'Disconnected'}
            </Tag>
            <Button icon={<ReloadOutlined />} onClick={fetchJob}>
              Refresh
            </Button>
            {canCancel && (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={handleCancel}
                loading={cancelling}
              >
                Cancel Upgrade
              </Button>
            )}
          </Space>
        </div>

        <Card title="Upgrade Information">
          <Descriptions column={2} bordered>
            <Descriptions.Item label="Job ID" span={2}>
              <Text copyable style={{ fontSize: '12px' }}>{job.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Cluster">
              {job.cluster.clusterName}
            </Descriptions.Item>
            <Descriptions.Item label="Region">
              {job.cluster.region}
            </Descriptions.Item>
            <Descriptions.Item label="Current Version">
              <Tag color="blue">{job.currentVersion}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Target Version">
              <Tag color="green">{job.targetVersion}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {getStatusTag(job.status)}
            </Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag color={job.dryRun ? 'blue' : 'default'}>
                {job.dryRun ? 'Dry Run' : 'Production'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {new Date(job.createdAt).toLocaleString()}
            </Descriptions.Item>
            {job.startedAt && (
              <Descriptions.Item label="Started">
                {new Date(job.startedAt).toLocaleString()}
              </Descriptions.Item>
            )}
            {job.completedAt && (
              <Descriptions.Item label="Completed" span={job.startedAt ? 1 : 2}>
                {new Date(job.completedAt).toLocaleString()}
              </Descriptions.Item>
            )}
          </Descriptions>

          {job.status === 'IN_PROGRESS' && (
            <div style={{ marginTop: '16px' }}>
              <Text>Progress:</Text>
              <Progress
                percent={getProgressPercent()}
                status="active"
                strokeColor={{ from: '#108ee9', to: '#87d068' }}
              />
            </div>
          )}

          {job.validationWarnings.length > 0 && (
            <Alert
              message="Validation Warnings"
              description={
                <ul style={{ marginBottom: 0 }}>
                  {job.validationWarnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              }
              type="warning"
              showIcon
              style={{ marginTop: '16px' }}
            />
          )}
        </Card>

        <Card title={`Activity Log (${activities.length} events)`}>
          {activities.length === 0 ? (
            <Text type="secondary">No activity recorded yet</Text>
          ) : (
            <Timeline
              mode="left"
              items={activities.map((activity) => ({
                label: new Date(activity.timestamp).toLocaleTimeString(),
                children: (
                  <Space direction="vertical" size="small">
                    <Text strong>{activity.eventType}</Text>
                    {activity.eventData.message && (
                      <Text>{activity.eventData.message}</Text>
                    )}
                    {activity.eventData.error && (
                      <Text type="danger">{activity.eventData.error}</Text>
                    )}
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Sequence: {activity.sequenceNumber}
                    </Text>
                  </Space>
                ),
              }))}
            />
          )}
        </Card>

        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
          />
        )}
      </Space>
    </div>
  );
}
