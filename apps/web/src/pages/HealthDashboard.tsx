import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Badge, Button, Space, Typography, List, Tag, Spin,
  Alert, Row, Col, Statistic, Timeline, Collapse, Empty,
} from 'antd';
import {
  CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined,
  PlayCircleOutlined, ReloadOutlined, WifiOutlined,
} from '@ant-design/icons';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface HealthFinding {
  severity: 'critical' | 'high' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  resource: string;
  namespace?: string;
  remediation?: string;
}

interface HealthCheck {
  id: string;
  trigger: string;
  status: string;
  overallHealth?: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  warningCount: number;
  findings: HealthFinding[];
  nodeSummary?: { total: number; ready: number };
  podSummary?: { total: number; running: number };
  createdAt: string;
  completedAt?: string;
}

const SEVERITY_CONFIG = {
  critical: { color: '#f5222d', icon: <CloseCircleOutlined />, order: 0 },
  high: { color: '#fa8c16', icon: <ExclamationCircleOutlined />, order: 1 },
  warning: { color: '#faad14', icon: <ExclamationCircleOutlined />, order: 2 },
  info: { color: '#1890ff', icon: <CheckCircleOutlined />, order: 3 },
};

const HEALTH_STATUS = {
  HEALTHY: { color: 'success' as const, label: 'Healthy', icon: <CheckCircleOutlined /> },
  WARNING: { color: 'warning' as const, label: 'Warning', icon: <ExclamationCircleOutlined /> },
  CRITICAL: { color: 'error' as const, label: 'Critical', icon: <CloseCircleOutlined /> },
};

export default function HealthDashboard() {
  const { clusterId } = useParams<{ clusterId: string }>();
  const { user } = useAuth();

  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [latest, setLatest] = useState<HealthCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveUpdate, setLiveUpdate] = useState<string | null>(null);

  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/upgrades`;
  const { readyState } = useWebSocket(wsUrl, {
    onMessage: (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.event === 'health_check_completed' && msg.data?.clusterId === clusterId) {
          setLiveUpdate('Health check completed. Refreshing…');
          void loadHealthData();
        }
      } catch { /* ignore */ }
    },
    shouldReconnect: () => true,
  });

  const loadHealthData = useCallback(async () => {
    if (!clusterId) { setLoading(false); return; }
    try {
      const [latestRes, listRes] = await Promise.all([
        fetch(`/api/clusters/${clusterId}/health/latest`, {
          headers: { Authorization: `Bearer ${user?.token ?? ''}` },
        }),
        fetch(`/api/clusters/${clusterId}/health`, {
          headers: { Authorization: `Bearer ${user?.token ?? ''}` },
        }),
      ]);

      if (latestRes.ok) setLatest(await latestRes.json());
      if (listRes.ok) setHealthChecks(await listRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [clusterId, user?.token]);

  useEffect(() => { void loadHealthData(); }, [loadHealthData]);

  const triggerCheck = async () => {
    if (!clusterId) return;
    try {
      setTriggering(true);
      const res = await fetch(`/api/clusters/${clusterId}/health/check`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token ?? ''}` },
      });
      if (!res.ok) throw new Error('Health check trigger failed');
      setLiveUpdate('Health check started. Waiting for results…');
      setTimeout(() => void loadHealthData(), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trigger failed');
    } finally {
      setTriggering(false);
    }
  };

  const sortedFindings = (latest?.findings ?? [])
    .slice()
    .sort((a, b) => (SEVERITY_CONFIG[a.severity]?.order ?? 4) - (SEVERITY_CONFIG[b.severity]?.order ?? 4));

  const healthStatus = latest?.overallHealth
    ? HEALTH_STATUS[latest.overallHealth as keyof typeof HEALTH_STATUS]
    : null;

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;
  if (!clusterId) return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="Select a cluster from the Fleet Dashboard to view its health"
      style={{ padding: 48 }}
    />
  );

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>Health Dashboard</Title>
        <Space>
          <Badge
            status={readyState === ReadyState.OPEN ? 'processing' : 'default'}
            text={<Text type="secondary"><WifiOutlined /> Live</Text>}
          />
          <Button icon={<ReloadOutlined />} onClick={loadHealthData} />
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={triggering}
            onClick={triggerCheck}
          >
            Run Health Check
          </Button>
        </Space>
      </Space>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />}
      {liveUpdate && <Alert type="info" message={liveUpdate} closable onClose={() => setLiveUpdate(null)} style={{ marginBottom: 16 }} />}

      {latest && healthStatus && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Overall Health"
                  value={healthStatus.label}
                  valueStyle={{ color: latest.overallHealth === 'CRITICAL' ? '#f5222d' : latest.overallHealth === 'WARNING' ? '#faad14' : '#52c41a' }}
                  prefix={healthStatus.icon}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Critical" value={latest.criticalCount} valueStyle={{ color: '#f5222d' }} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="High" value={latest.highCount} valueStyle={{ color: '#fa8c16' }} /></Card>
            </Col>
            <Col span={6}>
              <Card><Statistic title="Warnings" value={latest.warningCount} valueStyle={{ color: '#faad14' }} /></Card>
            </Col>
          </Row>

          {sortedFindings.length > 0 ? (
            <Card title="Findings" style={{ marginBottom: 16 }}>
              <List
                dataSource={sortedFindings}
                renderItem={(finding) => {
                  const cfg = SEVERITY_CONFIG[finding.severity];
                  return (
                    <List.Item key={`${finding.resource}-${finding.title}`}>
                      <List.Item.Meta
                        avatar={<span style={{ color: cfg.color }}>{cfg.icon}</span>}
                        title={
                          <Space>
                            <Tag color={cfg.color}>{finding.severity.toUpperCase()}</Tag>
                            <Text strong>{finding.title}</Text>
                            <Tag>{finding.category}</Tag>
                            {finding.namespace && <Tag color="blue">{finding.namespace}</Tag>}
                          </Space>
                        }
                        description={
                          <>
                            <Text>{finding.description}</Text>
                            {finding.remediation && (
                              <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                                Fix: {finding.remediation}
                              </Text>
                            )}
                          </>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </Card>
          ) : (
            <Card style={{ marginBottom: 16 }}>
              <Empty description="No findings - cluster is healthy" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          )}
        </>
      )}

      {healthChecks.length > 0 && (
        <Card title="Health Check History">
          <Timeline
            mode="left"
            items={healthChecks.map((hc) => ({
              key: hc.id,
              color: hc.overallHealth === 'CRITICAL' ? 'red' : hc.overallHealth === 'WARNING' ? 'orange' : 'green',
              label: new Date(hc.createdAt).toLocaleString(),
              children: (
                <Space>
                  <Tag>{hc.trigger}</Tag>
                  {hc.overallHealth && (
                    <Tag color={hc.overallHealth === 'CRITICAL' ? 'red' : hc.overallHealth === 'WARNING' ? 'orange' : 'green'}>
                      {hc.overallHealth}
                    </Tag>
                  )}
                  <Text type="secondary">{hc.totalFindings} findings</Text>
                </Space>
              ),
            }))}
          />
        </Card>
      )}
    </div>
  );
}
