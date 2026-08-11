import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Tag, Button, Space, Typography, Spin, Alert,
  Row, Col, Statistic, Badge, Input, Select, Progress, Tooltip,
} from 'antd';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  ReloadOutlined, SearchOutlined, WifiOutlined,
} from '@ant-design/icons';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface ClusterSummary {
  id: string;
  clusterName: string;
  region: string;
  currentVersion: string;
  status: string;
  accountId: string;
  latestHealthStatus?: string;
  latestHealthFindings?: number;
}

interface FleetStatus {
  totalClusters: number;
  healthyClusters: number;
  warningClusters: number;
  criticalClusters: number;
  unknownClusters: number;
  versionDistribution: Record<string, number>;
  regionDistribution: Record<string, number>;
  generatedAt: string;
}

const HEALTH_COLOR: Record<string, string> = {
  HEALTHY: 'green', WARNING: 'orange', CRITICAL: 'red',
};

export default function FleetDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [fleetStatus, setFleetStatus] = useState<FleetStatus | null>(null);
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [regionFilter, setRegionFilter] = useState<string | undefined>();
  const [liveUpdate, setLiveUpdate] = useState<string | null>(null);

  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/upgrades`;
  const { sendJsonMessage, readyState } = useWebSocket(wsUrl, {
    onOpen: () => sendJsonMessage({ event: 'subscribe', data: { room: 'fleet' } }),
    onMessage: (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.event === 'fleet_status_update') {
          setFleetStatus(msg.data);
          setLiveUpdate(`Fleet status updated at ${new Date().toLocaleTimeString()}`);
        }
      } catch { /* ignore */ }
    },
    shouldReconnect: () => true,
  });

  const loadFleet = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, clustersRes] = await Promise.all([
        fetch('/api/fleet/status', { headers: { Authorization: `Bearer ${user?.token ?? ''}` } }),
        fetch(`/api/fleet/clusters?page=${page}&limit=100`, { headers: { Authorization: `Bearer ${user?.token ?? ''}` } }),
      ]);
      if (statusRes.ok) setFleetStatus(await statusRes.json());
      if (clustersRes.ok) {
        const data = await clustersRes.json();
        setClusters(data.clusters ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [page, user?.token]);

  useEffect(() => { void loadFleet(); }, [loadFleet]);

  const filteredClusters = clusters.filter((c) => {
    const matchText = !searchText ||
      c.clusterName.toLowerCase().includes(searchText.toLowerCase()) ||
      c.accountId.includes(searchText);
    const matchRegion = !regionFilter || c.region === regionFilter;
    return matchText && matchRegion;
  });

  const regions = [...new Set(clusters.map((c) => c.region))];

  const columns = [
    {
      title: 'Cluster', dataIndex: 'clusterName', key: 'clusterName',
      render: (name: string, c: ClusterSummary) => (
        <Button type="link" size="small" onClick={() => navigate(`/clusters/${c.id}`)}>
          {name}
        </Button>
      ),
    },
    { title: 'Region', dataIndex: 'region', key: 'region', render: (r: string) => <Tag>{r}</Tag> },
    { title: 'Version', dataIndex: 'currentVersion', key: 'version', render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: 'Health', key: 'health',
      render: (_: unknown, c: ClusterSummary) => c.latestHealthStatus ? (
        <Badge
          status={c.latestHealthStatus === 'HEALTHY' ? 'success' : c.latestHealthStatus === 'CRITICAL' ? 'error' : 'warning'}
          text={<Space>{c.latestHealthStatus}{c.latestHealthFindings ? <Tag color={HEALTH_COLOR[c.latestHealthStatus]}>{c.latestHealthFindings} findings</Tag> : null}</Space>}
        />
      ) : <Text type="secondary">Unknown</Text>,
    },
    { title: 'Account', dataIndex: 'accountId', key: 'account', render: (a: string) => <Text code style={{ fontSize: 11 }}>{a}</Text> },
    {
      title: 'Actions', key: 'actions',
      render: (_: unknown, c: ClusterSummary) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/clusters/${c.id}`)}>Details</Button>
          <Button size="small" onClick={() => navigate(`/clusters/${c.id}/health`)}>Health</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>Fleet Dashboard</Title>
        <Space>
          <Badge
            status={readyState === ReadyState.OPEN ? 'processing' : 'default'}
            text={<Text type="secondary"><WifiOutlined /> Live</Text>}
          />
          <Button icon={<ReloadOutlined />} onClick={loadFleet} />
        </Space>
      </Space>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />}
      {liveUpdate && <Alert type="info" message={liveUpdate} closable onClose={() => setLiveUpdate(null)} style={{ marginBottom: 8 }} />}

      {fleetStatus && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}><Card><Statistic title="Total" value={fleetStatus.totalClusters} /></Card></Col>
          <Col span={4}><Card><Statistic title="Healthy" value={fleetStatus.healthyClusters} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={4}><Card><Statistic title="Warning" value={fleetStatus.warningClusters} valueStyle={{ color: '#faad14' }} /></Card></Col>
          <Col span={4}><Card><Statistic title="Critical" value={fleetStatus.criticalClusters} valueStyle={{ color: '#f5222d' }} /></Card></Col>
          <Col span={4}><Card><Statistic title="Unknown" value={fleetStatus.unknownClusters} valueStyle={{ color: '#d9d9d9' }} /></Card></Col>
          <Col span={4}>
            <Card>
              <Text type="secondary">Version Distribution</Text>
              {Object.entries(fleetStatus.versionDistribution).slice(0, 3).map(([v, count]) => (
                <div key={v}><Tag color="blue">{v}</Tag><Text>{count}</Text></div>
              ))}
            </Card>
          </Col>
        </Row>
      )}

      <Card
        title={`Clusters (${filteredClusters.length}/${total})`}
        extra={
          <Space>
            <Input
              placeholder="Search clusters…"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
            />
            <Select
              placeholder="Filter by region"
              allowClear
              value={regionFilter}
              onChange={setRegionFilter}
              style={{ width: 150 }}
              options={regions.map((r) => ({ value: r, label: r }))}
            />
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : (
          <Table
            dataSource={filteredClusters}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{
              current: page,
              pageSize: 50,
              total,
              onChange: setPage,
            }}
            scroll={{ y: 500 }}
          />
        )}
      </Card>
    </div>
  );
}
