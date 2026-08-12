import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Tag, Button, Space, Typography, Popconfirm,
  Select, message, Tooltip, Badge,
} from 'antd';
import {
  ReloadOutlined, StopOutlined, LinkOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

interface UpgradeJob {
  id: string;
  fromVersion: string;
  toVersion: string;
  status: string;
  jobType: string;
  createdAt: string;
  completedAt: string | null;
  cluster?: {
    id: string;
    clusterName: string;
    region: string;
    account?: { accountName: string };
  };
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'default',
  in_progress: 'processing',
  PENDING: 'default',
  IN_PROGRESS: 'processing',
  completed: 'success',
  COMPLETED: 'success',
  failed: 'error',
  FAILED: 'error',
  cancelled: 'error',
  CANCELLED: 'error',
  dry_run: 'warning',
  DRY_RUN: 'warning',
};

const ACTIVE_STATUSES = ['pending', 'in_progress', 'PENDING', 'IN_PROGRESS'];

export default function UpgradeJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<UpgradeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/upgrades');
      setJobs(res.data ?? []);
    } catch {
      message.error('Failed to load upgrade jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const cancelJob = async (jobId: string) => {
    setCancellingId(jobId);
    try {
      await axios.delete(`/api/upgrades/${jobId}`);
      message.success('Job cancelled');
      setJobs((prev) =>
        prev.map((j) => j.id === jobId ? { ...j, status: 'cancelled' } : j),
      );
    } catch (err: any) {
      message.error(err.response?.data?.message ?? 'Failed to cancel job');
    } finally {
      setCancellingId(null);
    }
  };

  const filtered = jobs.filter((j) => {
    if (statusFilter === 'active') return ACTIVE_STATUSES.includes(j.status);
    if (statusFilter === 'all') return true;
    return j.status?.toLowerCase() === statusFilter;
  });

  const activeCount = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status)).length;

  const columns = [
    {
      title: 'Job ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => (
        <Tooltip title={id}>
          <Text code style={{ fontSize: 11 }}>{id.slice(0, 8)}…</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Cluster',
      key: 'cluster',
      width: 200,
      render: (_: unknown, job: UpgradeJob) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            style={{ padding: 0, height: 'auto' }}
            onClick={() => navigate(`/clusters/${job.cluster?.id}`)}
          >
            {job.cluster?.clusterName ?? '—'}
          </Button>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {job.cluster?.account?.accountName ?? ''}{job.cluster?.region ? ` · ${job.cluster.region}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: 'From',
      dataIndex: 'fromVersion',
      key: 'from',
      width: 90,
      render: (v: string) => v ? <Tag color="default">{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'To',
      dataIndex: 'toVersion',
      key: 'to',
      width: 90,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: string) => (
        <Badge
          status={STATUS_COLORS[s] as any ?? 'default'}
          text={<Tag color={STATUS_COLORS[s] ?? 'default'}>{s?.toUpperCase()}</Tag>}
        />
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      render: (_: unknown, job: UpgradeJob) =>
        ACTIVE_STATUSES.includes(job.status) ? (
          <Popconfirm
            title="Cancel this upgrade job?"
            description="The job will be marked as cancelled."
            onConfirm={() => cancelJob(job.id)}
            okText="Yes, Cancel"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              loading={cancellingId === job.id}
            >
              Cancel
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Space align="center">
          <Title level={4} style={{ margin: 0 }}>Upgrade Jobs</Title>
          {activeCount > 0 && (
            <Tag color="processing">{activeCount} active</Tag>
          )}
        </Space>
        <Space>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            options={[
              { value: 'active', label: 'Active (Pending / In Progress)' },
              { value: 'all', label: 'All Jobs' },
              { value: 'pending', label: 'Pending' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'failed', label: 'Failed' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchJobs}>Refresh</Button>
        </Space>
      </Space>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 870 }}
        locale={{ emptyText: statusFilter === 'active' ? 'No active upgrade jobs' : 'No jobs found' }}
      />
    </Space>
  );
}
