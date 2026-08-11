import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Table, Tag, Button, Space, Typography, Tabs, Badge,
  Alert, Spin, Modal, Descriptions, Popconfirm, Statistic, Row, Col,
} from 'antd';
import {
  CloudUploadOutlined, CloudDownloadOutlined, CheckOutlined,
  ReloadOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface Backup {
  id: string;
  name: string;
  trigger: string;
  status: string;
  phase?: string;
  resourceCount: number;
  sizeBytes: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface Restore {
  id: string;
  backup: { id: string; name: string };
  status: string;
  approvalStatus: string;
  approverIds: string[];
  createdAt: string;
  completedAt?: string;
}

const BACKUP_STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'green', PENDING: 'processing', FAILED: 'error',
};

export default function BackupRestoreManagement() {
  const { clusterId } = useParams<{ clusterId: string }>();
  const { user } = useAuth();

  const [backups, setBackups] = useState<Backup[]>([]);
  const [restores, setRestores] = useState<Restore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    if (!clusterId) return;
    try {
      setLoading(true);
      const [bRes, rRes] = await Promise.all([
        fetch(`/api/clusters/${clusterId}/backups`, { headers: { Authorization: `Bearer ${user?.token ?? ''}` } }),
        fetch(`/api/clusters/${clusterId}/backups/restores`, { headers: { Authorization: `Bearer ${user?.token ?? ''}` } }),
      ]);
      if (bRes.ok) setBackups(await bRes.json());
      if (rRes.ok) setRestores(await rRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [clusterId, user?.token]);

  useEffect(() => { void load(); }, [load]);

  const triggerBackup = async () => {
    if (!clusterId) return;
    try {
      setTriggering(true);
      const res = await fetch(`/api/clusters/${clusterId}/backups`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token ?? ''}` },
      });
      if (!res.ok) throw new Error('Backup trigger failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed');
    } finally {
      setTriggering(false);
    }
  };

  const requestRestore = async () => {
    if (!selectedBackup || !clusterId) return;
    try {
      setRestoring(true);
      const res = await fetch(`/api/clusters/${clusterId}/backups/${selectedBackup.id}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token ?? ''}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Restore request failed');
      setRestoreModalVisible(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const approveRestore = async (restoreId: string) => {
    try {
      await fetch(`/api/restores/${restoreId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token ?? ''}` },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
  };

  const executeRestore = async (restoreId: string) => {
    try {
      await fetch(`/api/restores/${restoreId}/execute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token ?? ''}` },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execute failed');
    }
  };

  const completedBackups = backups.filter((b) => b.status === 'COMPLETED').length;
  const latestBackup = backups.find((b) => b.status === 'COMPLETED');

  const backupColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (n: string) => <Text code>{n}</Text> },
    { title: 'Trigger', dataIndex: 'trigger', key: 'trigger', render: (t: string) => <Tag>{t}</Tag> },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (s: string) => <Badge status={BACKUP_STATUS_COLOR[s] as any ?? 'default'} text={s} />,
    },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', render: (d: string) => new Date(d).toLocaleString() },
    {
      title: 'Actions', key: 'actions',
      render: (_: unknown, b: Backup) => b.status === 'COMPLETED' ? (
        <Button size="small" icon={<CloudDownloadOutlined />}
          onClick={() => { setSelectedBackup(b); setRestoreModalVisible(true); }}>
          Request Restore
        </Button>
      ) : null,
    },
  ];

  const restoreColumns = [
    { title: 'Backup', key: 'backup', render: (_: unknown, r: Restore) => <Text code>{r.backup?.name ?? r.backup?.id}</Text> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Badge status={s === 'COMPLETED' ? 'success' : 'processing'} text={s} /> },
    {
      title: 'Approvals', key: 'approvals',
      render: (_: unknown, r: Restore) => (
        <Text type="secondary">{r.approverIds.length}/2</Text>
      ),
    },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', render: (d: string) => new Date(d).toLocaleString() },
    {
      title: 'Actions', key: 'actions',
      render: (_: unknown, r: Restore) => (
        <Space>
          {r.approvalStatus === 'PENDING' && (
            <Button size="small" icon={<CheckOutlined />} onClick={() => approveRestore(r.id)}>
              Approve
            </Button>
          )}
          {r.approvalStatus === 'APPROVED' && r.status !== 'COMPLETED' && (
            <Popconfirm
              title="Execute restore?"
              description="This will overwrite existing resources!"
              icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
              onConfirm={() => executeRestore(r.id)}
            >
              <Button size="small" danger>Execute</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>Backup & Restore</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button type="primary" icon={<CloudUploadOutlined />} loading={triggering} onClick={triggerBackup}>
            Trigger Backup
          </Button>
        </Space>
      </Space>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card><Statistic title="Total Backups" value={backups.length} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="Completed Backups" value={completedBackups} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Latest Backup"
              value={latestBackup ? new Date(latestBackup.createdAt).toLocaleDateString() : 'None'}
            />
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey="backups" items={[
        {
          key: 'backups',
          label: `Backups (${backups.length})`,
          children: <Table dataSource={backups} columns={backupColumns} rowKey="id" pagination={{ pageSize: 10 }} />,
        },
        {
          key: 'restores',
          label: `Restore Requests (${restores.length})`,
          children: <Table dataSource={restores} columns={restoreColumns} rowKey="id" pagination={{ pageSize: 10 }} />,
        },
      ]} />

      <Modal
        title={`Request Restore from: ${selectedBackup?.name}`}
        open={restoreModalVisible}
        onCancel={() => setRestoreModalVisible(false)}
        onOk={requestRestore}
        confirmLoading={restoring}
        okText="Request Restore"
      >
        <Alert
          type="warning"
          showIcon
          message="Restore requires dual approval (2 admins)"
          description="Once approved and executed, this will overwrite existing cluster resources with the backup state."
          style={{ marginBottom: 16 }}
        />
        {selectedBackup && (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Backup Name"><Text code>{selectedBackup.name}</Text></Descriptions.Item>
            <Descriptions.Item label="Created">{new Date(selectedBackup.createdAt).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="Status"><Tag color="green">{selectedBackup.status}</Tag></Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
