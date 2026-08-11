import React, { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Space, Typography, Button, Modal, Form, Select,
  InputNumber, DatePicker, Alert, Spin, Popconfirm, Badge,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, CalendarOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface UpgradeSchedule {
  id: string;
  clusterId: string;
  clusterName?: string;
  targetVersion: string;
  cronExpression?: string;
  scheduledAt?: string;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  createdAt: string;
}

interface Cluster {
  id: string;
  name: string;
  currentVersion: string;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'blue',
  EXECUTING: 'processing',
  COMPLETED: 'success',
  CANCELLED: 'default',
  FAILED: 'error',
};

export default function SchedulingPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<UpgradeSchedule[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const authHeader = { Authorization: `Bearer ${user?.token ?? ''}` };

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/scheduling', { headers: authHeader });
      if (!res.ok) throw new Error('Failed to load schedules');
      const data = await res.json();
      setSchedules(Array.isArray(data) ? data : data.schedules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  const loadClusters = async () => {
    try {
      const res = await fetch('/api/clusters?limit=200', { headers: authHeader });
      if (!res.ok) return;
      const data = await res.json();
      setClusters(data.clusters ?? data ?? []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadSchedules();
    void loadClusters();
  }, []);

  const cancelSchedule = async (id: string) => {
    try {
      const res = await fetch(`/api/scheduling/${id}/cancel`, {
        method: 'PATCH',
        headers: authHeader,
      });
      if (!res.ok) throw new Error('Cancel failed');
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    }
  };

  const createSchedule = async (values: {
    clusterId: string;
    targetVersion: string;
    cronExpression?: string;
    scheduledAt?: Dayjs;
  }) => {
    try {
      const body: Record<string, unknown> = {
        clusterId: values.clusterId,
        targetVersion: values.targetVersion,
      };
      if (values.cronExpression) body.cronExpression = values.cronExpression;
      if (values.scheduledAt) body.scheduledAt = values.scheduledAt.toISOString();

      const res = await fetch('/api/scheduling', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Create failed');
      setCreateModalOpen(false);
      form.resetFields();
      await loadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const columns = [
    {
      title: 'Cluster',
      dataIndex: 'clusterName',
      key: 'cluster',
      render: (name: string, r: UpgradeSchedule) => (
        <Text>{name ?? r.clusterId.slice(0, 8)}</Text>
      ),
    },
    {
      title: 'Target Version',
      dataIndex: 'targetVersion',
      key: 'targetVersion',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Schedule',
      key: 'schedule',
      render: (_: unknown, r: UpgradeSchedule) => (
        <Space direction="vertical" size={0}>
          {r.cronExpression && <Text code style={{ fontSize: 11 }}>{r.cronExpression}</Text>}
          {r.scheduledAt && <Text style={{ fontSize: 12 }}>{new Date(r.scheduledAt).toLocaleString()}</Text>}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Badge status={STATUS_COLOR[s] as never} text={s} />,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => <Text style={{ fontSize: 12 }}>{new Date(d).toLocaleString()}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, r: UpgradeSchedule) => (
        r.status === 'PENDING' ? (
          <Popconfirm title="Cancel this schedule?" onConfirm={() => void cancelSchedule(r.id)}>
            <Button danger size="small" icon={<DeleteOutlined />}>Cancel</Button>
          </Popconfirm>
        ) : null
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>
          <CalendarOutlined style={{ marginRight: 8 }} />
          Upgrade Schedules
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadSchedules} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            New Schedule
          </Button>
        </Space>
      </Space>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : (
        <Card>
          <Table
            dataSource={schedules}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 20 }}
          />
        </Card>
      )}

      <Modal
        title="Create Upgrade Schedule"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="Create"
      >
        <Form form={form} layout="vertical" onFinish={createSchedule}>
          <Form.Item name="clusterId" label="Cluster" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Select cluster"
              options={clusters.map(c => ({ value: c.id, label: `${c.name} (${c.currentVersion})` }))}
              filterOption={(input, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="targetVersion" label="Target Version" rules={[{ required: true }]}>
            <Select
              placeholder="e.g. 1.30"
              options={['1.28', '1.29', '1.30', '1.31', '1.32'].map(v => ({ value: v, label: v }))}
            />
          </Form.Item>
          <Form.Item name="scheduledAt" label="One-Time Schedule (pick date/time)">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="cronExpression" label="CRON Expression (recurring)">
            <Select
              allowClear
              placeholder="Or choose a cron schedule"
              options={[
                { value: '0 2 * * 0', label: 'Weekly (Sunday 2 AM)' },
                { value: '0 2 * * 6', label: 'Weekly (Saturday 2 AM)' },
                { value: '0 2 1 * *', label: 'Monthly (1st, 2 AM)' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
