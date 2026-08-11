import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Tag, Button, Space, Typography, Progress, Badge,
  Modal, Form, Input, InputNumber, Select, Transfer, Alert, Spin, Statistic, Row, Col,
} from 'antd';
import {
  PlusOutlined, PlayCircleOutlined, PauseCircleOutlined,
  ReloadOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface CampaignTarget {
  id: string;
  status: string;
  cluster: { id: string; clusterName: string; currentVersion: string };
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  targetVersion: string;
  dryRun: boolean;
  createdAt: string;
  targets: CampaignTarget[];
  progressPercent?: number;
  completedTargets?: number;
  totalTargets?: number;
  failedTargets?: number;
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', RUNNING: 'processing', PAUSED: 'warning',
  COMPLETED: 'success', FAILED: 'error', CANCELLED: 'default',
};

export default function CampaignDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clusters, setClusters] = useState<Array<{ id: string; clusterName: string; currentVersion: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedClusterIds, setSelectedClusterIds] = useState<string[]>([]);
  const [form] = Form.useForm();

  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/upgrades`;
  const { readyState } = useWebSocket(wsUrl, {
    onMessage: (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.event === 'campaign_started' || msg.event === 'campaign_progress') {
          void loadCampaigns();
        }
      } catch { /* ignore */ }
    },
    shouldReconnect: () => true,
  });

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns', {
        headers: { Authorization: `Bearer ${user?.token ?? ''}` },
      });
      if (!res.ok) throw new Error('Failed to load campaigns');
      const data = await res.json();
      const withProgress = await Promise.all(
        (data as Campaign[]).map(async (c) => {
          try {
            const pr = await fetch(`/api/campaigns/${c.id}/progress`, {
              headers: { Authorization: `Bearer ${user?.token ?? ''}` },
            });
            if (pr.ok) {
              const pd = await pr.json();
              return { ...c, ...pd };
            }
          } catch { /* ok */ }
          return c;
        }),
      );
      setCampaigns(withProgress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  const loadClusters = useCallback(async () => {
    try {
      const res = await fetch('/api/clusters', {
        headers: { Authorization: `Bearer ${user?.token ?? ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClusters(data.clusters ?? data);
      }
    } catch { /* ignore */ }
  }, [user?.token]);

  useEffect(() => {
    void loadCampaigns();
    void loadClusters();
  }, [loadCampaigns, loadClusters]);

  const handleCreate = async () => {
    try {
      setCreating(true);
      const values = await form.validateFields();
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token ?? ''}`,
        },
        body: JSON.stringify({ ...values, clusterIds: selectedClusterIds }),
      });
      if (!res.ok) throw new Error('Create failed');
      setCreateModalVisible(false);
      form.resetFields();
      setSelectedClusterIds([]);
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (campaignId: string, action: 'start' | 'pause') => {
    try {
      await fetch(`/api/campaigns/${campaignId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token ?? ''}` },
      });
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    }
  };

  const activeCampaigns = campaigns.filter((c) => c.status === 'RUNNING').length;
  const completedCampaigns = campaigns.filter((c) => c.status === 'COMPLETED').length;
  const failedCampaigns = campaigns.filter((c) => c.status === 'FAILED').length;

  const columns = [
    {
      title: 'Campaign',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, c: Campaign) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => navigate(`/campaigns/${c.id}`)}
          >
            {name}
          </Text>
          {c.dryRun && <Tag color="orange" style={{ fontSize: 10 }}>DRY RUN</Tag>}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Badge status={STATUS_COLOR[status] as any} text={status} />,
    },
    {
      title: 'Target Version',
      dataIndex: 'targetVersion',
      key: 'targetVersion',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: unknown, c: Campaign) => {
        const pct = c.progressPercent ?? 0;
        return c.totalTargets ? (
          <Space direction="vertical" size={0} style={{ width: 160 }}>
            <Progress percent={pct} size="small" status={c.status === 'FAILED' ? 'exception' : undefined} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {c.completedTargets ?? 0}/{c.totalTargets} clusters
              {(c.failedTargets ?? 0) > 0 && (
                <Tag color="red" style={{ marginLeft: 4, fontSize: 10 }}>{c.failedTargets} failed</Tag>
              )}
            </Text>
          </Space>
        ) : (
          <Text type="secondary">{(c.targets ?? []).length} clusters</Text>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, c: Campaign) => (
        <Space>
          {(c.status === 'DRAFT' || c.status === 'PAUSED') && (
            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleAction(c.id, 'start')}>
              Start
            </Button>
          )}
          {c.status === 'RUNNING' && (
            <Button size="small" icon={<PauseCircleOutlined />} onClick={() => handleAction(c.id, 'pause')}>
              Pause
            </Button>
          )}
          <Button size="small" onClick={() => navigate(`/campaigns/${c.id}`)}>
            Details
          </Button>
        </Space>
      ),
    },
  ];

  const transferDataSource = clusters.map((c) => ({
    key: c.id,
    title: `${c.clusterName} (${c.currentVersion})`,
    description: c.id,
  }));

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>Upgrade Campaigns</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadCampaigns} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            New Campaign
          </Button>
        </Space>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title="Total Campaigns" value={campaigns.length} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Running" value={activeCampaigns} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Completed" value={completedCampaigns} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Failed" value={failedCampaigns} valueStyle={{ color: '#f5222d' }} /></Card>
        </Col>
      </Row>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : (
        <Card>
          <Table dataSource={campaigns} columns={columns} rowKey="id" pagination={{ pageSize: 20 }} />
        </Card>
      )}

      <Modal
        title="Create Upgrade Campaign"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={creating}
        width={700}
        okButtonProps={{ disabled: selectedClusterIds.length === 0 }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Campaign Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Q1 2026 EKS 1.29 Upgrade" />
          </Form.Item>
          <Form.Item label="Target Version" name="targetVersion" rules={[{ required: true }]}>
            <Input placeholder="e.g. 1.29" style={{ width: 160 }} />
          </Form.Item>
          <Form.Item label="Max Parallel Upgrades" name="maxParallel" initialValue={1}>
            <InputNumber min={1} max={10} />
          </Form.Item>
          <Form.Item label="Dry Run" name="dryRun" valuePropName="checked" initialValue={false}>
            <input type="checkbox" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>

        <div style={{ marginTop: 16 }}>
          <Text strong>Select Target Clusters ({selectedClusterIds.length} selected)</Text>
          <Transfer
            dataSource={transferDataSource}
            targetKeys={selectedClusterIds}
            onChange={(keys) => setSelectedClusterIds(keys as string[])}
            render={(item) => item.title}
            listStyle={{ width: 280, height: 250 }}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </div>
  );
}
