import React, { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Space, Typography, Button, Modal, Form, Input,
  Select, Alert, Spin, Popconfirm, Tabs, Timeline,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, BellOutlined, ReloadOutlined, CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text, Paragraph } = Typography;

interface NotificationChannel {
  id: string;
  name: string;
  type: 'SLACK' | 'WEBHOOK' | 'EMAIL' | 'PAGERDUTY';
  webhookUrl?: string;
  isActive: boolean;
  createdAt: string;
}

interface NotificationRecord {
  id: string;
  channelId: string;
  channelName?: string;
  event: string;
  payload: Record<string, unknown>;
  status: 'SENT' | 'FAILED' | 'PENDING';
  createdAt: string;
  retryCount: number;
}

export default function NotificationConfigPage() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [history, setHistory] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const authHeader = { Authorization: `Bearer ${user?.token ?? ''}` };

  const loadChannels = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications/channels', { headers: authHeader });
      if (!res.ok) throw new Error('Failed to load channels');
      const data = await res.json();
      setChannels(Array.isArray(data) ? data : data.channels ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/notifications/history?limit=50', { headers: authHeader });
      if (!res.ok) return;
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : data.notifications ?? []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadChannels();
    void loadHistory();
  }, []);

  const deleteChannel = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/channels/${id}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      if (!res.ok) throw new Error('Delete failed');
      await loadChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const createChannel = async (values: {
    name: string;
    type: 'SLACK' | 'WEBHOOK';
    webhookUrl: string;
  }) => {
    try {
      const res = await fetch('/api/notifications/channels', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error('Create failed');
      setCreateModalOpen(false);
      form.resetFields();
      await loadChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const TYPE_COLOR: Record<string, string> = {
    SLACK: 'purple',
    WEBHOOK: 'blue',
    EMAIL: 'green',
    PAGERDUTY: 'red',
  };

  const channelColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => <Tag color={TYPE_COLOR[t] ?? 'default'}>{t}</Tag>,
    },
    {
      title: 'Webhook URL',
      dataIndex: 'webhookUrl',
      key: 'webhookUrl',
      render: (url: string) => url ? (
        <Text code style={{ fontSize: 11 }}>{url.slice(0, 40)}…</Text>
      ) : '—',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (active: boolean) => active ? (
        <Tag color="green">Active</Tag>
      ) : (
        <Tag color="default">Inactive</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, r: NotificationChannel) => (
        <Popconfirm title="Delete this channel?" onConfirm={() => void deleteChannel(r.id)}>
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>
          <BellOutlined style={{ marginRight: 8 }} />
          Notifications
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { void loadChannels(); void loadHistory(); }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Add Channel
          </Button>
        </Space>
      </Space>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />}

      <Tabs
        items={[
          {
            key: 'channels',
            label: 'Channels',
            children: loading ? (
              <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
            ) : (
              <Card>
                <Table
                  dataSource={channels}
                  columns={channelColumns}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            ),
          },
          {
            key: 'history',
            label: 'History',
            children: (
              <Card>
                <Timeline
                  items={history.map(h => ({
                    key: h.id,
                    dot: h.status === 'SENT'
                      ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                    children: (
                      <Space direction="vertical" size={0}>
                        <Text strong style={{ fontSize: 13 }}>{h.event}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {new Date(h.createdAt).toLocaleString()}
                          {h.retryCount > 0 && ` · retried ${h.retryCount}x`}
                        </Text>
                      </Space>
                    ),
                  }))}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="Add Notification Channel"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="Create"
      >
        <Form form={form} layout="vertical" onFinish={createChannel}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. #eks-alerts" />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'SLACK', label: 'Slack' },
                { value: 'WEBHOOK', label: 'Generic Webhook' },
              ]}
            />
          </Form.Item>
          <Form.Item name="webhookUrl" label="Webhook URL" rules={[{ required: true, type: 'url' }]}>
            <Input placeholder="https://hooks.slack.com/…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
