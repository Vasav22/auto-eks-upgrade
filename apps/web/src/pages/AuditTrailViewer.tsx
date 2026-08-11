import React, { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Space, Typography, DatePicker, Select, Input, Button, Alert, Spin,
} from 'antd';
import { DownloadOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface AuditRecord {
  id: string;
  type: string;
  actorId: string;
  targetType?: string;
  targetId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export default function AuditTrailViewer() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [actorFilter, setActorFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (typeFilter) params.set('type', typeFilter);
      if (actorFilter) params.set('actorId', actorFilter);

      const res = await fetch(`/api/audit?${params}`, {
        headers: { Authorization: `Bearer ${user?.token ?? ''}` },
      });
      if (!res.ok) throw new Error('Failed to load audit records');
      const data = await res.json();
      setRecords(data.records ?? data);
      setTotal(data.total ?? (data.records ?? data).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRecords(); }, [page, typeFilter]);

  const exportCsv = async () => {
    try {
      const res = await fetch('/api/audit/export?format=csv', {
        headers: { Authorization: `Bearer ${user?.token ?? ''}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const TYPE_COLOR: Record<string, string> = {
    DATA_MUTATION: 'blue',
    AUTH_SUCCESS: 'green',
    AUTH_FAILURE: 'red',
    ACCESS_DENIAL: 'orange',
  };

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (d: string) => <Text style={{ fontSize: 12 }}>{new Date(d).toLocaleString()}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 160,
      render: (t: string) => <Tag color={TYPE_COLOR[t] ?? 'default'}>{t}</Tag>,
    },
    {
      title: 'Actor',
      dataIndex: 'actorId',
      key: 'actorId',
      width: 120,
      render: (a: string) => <Text code style={{ fontSize: 11 }}>{a?.slice(0, 8)}…</Text>,
    },
    {
      title: 'Target',
      key: 'target',
      width: 180,
      render: (_: unknown, r: AuditRecord) => r.targetType ? (
        <Space size={4}>
          <Tag style={{ fontSize: 10 }}>{r.targetType}</Tag>
          <Text code style={{ fontSize: 10 }}>{r.targetId?.slice(0, 8)}…</Text>
        </Space>
      ) : null,
    },
    {
      title: 'Event',
      key: 'event',
      render: (_: unknown, r: AuditRecord) => (
        <Text style={{ fontSize: 12 }}>{String(r.metadata?.event ?? '—')}</Text>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>Audit Trail</Title>
        <Space>
          <Select
            placeholder="Filter by type"
            allowClear
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 180 }}
            options={[
              { value: 'DATA_MUTATION', label: 'Data Mutation' },
              { value: 'AUTH_SUCCESS', label: 'Auth Success' },
              { value: 'AUTH_FAILURE', label: 'Auth Failure' },
              { value: 'ACCESS_DENIAL', label: 'Access Denial' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadRecords} />
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>Export CSV</Button>
        </Space>
      </Space>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : (
        <Card>
          <Table
            dataSource={records}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{
              current: page,
              pageSize: 50,
              total,
              onChange: setPage,
            }}
            scroll={{ x: 900 }}
          />
        </Card>
      )}
    </div>
  );
}
