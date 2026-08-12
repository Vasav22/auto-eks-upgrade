import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Tag, Button, Space, Typography, Spin, Alert,
  Row, Col, Statistic, Badge, Input, Select, Tooltip,
  Modal, Form, Steps, message, Result, List,
} from 'antd';
import { ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';
import 'react-resizable/css/styles.css';
import {
  ReloadOutlined, SearchOutlined, WifiOutlined, PlusOutlined,
} from '@ant-design/icons';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const ResizableTitle = (
  props: React.HTMLAttributes<HTMLElement> & {
    onResize: (e: React.SyntheticEvent, data: ResizeCallbackData) => void;
    width: number;
  },
) => {
  const { onResize, width, ...restProps } = props;
  if (!width) return <th {...restProps} />;
  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', right: -5, bottom: 0, zIndex: 1, width: 10, height: '100%', cursor: 'col-resize' }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ ...restProps.style, position: 'relative' }} />
    </Resizable>
  );
};

interface ClusterSummary {
  id: string;
  clusterName: string;
  region: string;
  eksVersion: string;
  status: string;
  accountId: string;
  accountName: string;
  lastSyncedAt: string;
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
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    clusterName: 220, account: 110, region: 120, version: 110,
    status: 90, health: 130, lastSynced: 160, actions: 130,
  });

  const handleResize = (key: string) => (_: React.SyntheticEvent, { size }: ResizeCallbackData) => {
    setColWidths((prev) => ({ ...prev, [key]: size.width }));
  };

  // Register account + discover modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addStep, setAddStep] = useState(0);
  const [addLoading, setAddLoading] = useState(false);
  const [registeredAccountId, setRegisteredAccountId] = useState<string | null>(null);
  const [form] = Form.useForm();

  // Bulk upgrade
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkTargetVersion, setBulkTargetVersion] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<any | null>(null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);

  // Fetch available EKS versions when bulk modal opens
  const openBulkModal = async () => {
    // Derive eligible target versions from selected clusters' current versions
    const selected = clusters.filter((c) => selectedRowKeys.includes(c.id));
    const minorSet = new Set(
      selected.map((c) => parseInt((c.eksVersion ?? '1.35').replace('1.', ''), 10)),
    );
    // Show versions higher than the lowest selected version (up to skip=2)
    const min = Math.min(...minorSet);
    const vers = [];
    for (let i = min + 1; i <= min + 2; i++) vers.push(`1.${i}`);
    setAvailableVersions(vers);
    setBulkTargetVersion(vers[0] ?? null);
    setBulkResults(null);
    setBulkModalOpen(true);
  };

  const handleBulkUpgrade = async () => {
    if (!bulkTargetVersion) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/upgrades/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token ?? ''}` },
        body: JSON.stringify({ clusterIds: selectedRowKeys, targetVersion: bulkTargetVersion }),
      });
      const data = await res.json();
      setBulkResults(data);
      if (data.succeeded > 0) message.success(`${data.succeeded} upgrade job(s) queued`);
      if (data.failed > 0) message.warning(`${data.failed} cluster(s) could not be queued`);
      setSelectedRowKeys([]);
    } catch (err: any) {
      message.error(err.message ?? 'Bulk upgrade failed');
    } finally {
      setBulkLoading(false);
    }
  };

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
      c.accountName.toLowerCase().includes(searchText.toLowerCase()) ||
      c.region.toLowerCase().includes(searchText.toLowerCase());
    const matchRegion = !regionFilter || c.region === regionFilter;
    return matchText && matchRegion;
  });

  const regions = [...new Set(clusters.map((c) => c.region))];

  const handleRegisterAccount = async () => {
    try {
      const values = await form.validateFields();
      setAddLoading(true);
      const res = await fetch('/api/clusters/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token ?? ''}` },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Registration failed');
      const account = await res.json();
      setRegisteredAccountId(account.id);
      setAddStep(1);
      form.resetFields();
      message.success(`Account "${account.accountName}" registered`);
    } catch (err: any) {
      message.error(err.message ?? 'Failed to register account');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDiscoverClusters = async () => {
    if (!registeredAccountId) return;
    try {
      const values = await form.validateFields();
      setAddLoading(true);
      const regions_input = values.regions ? values.regions.split(',').map((r: string) => r.trim()).filter(Boolean) : undefined;
      const res = await fetch('/api/clusters/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token ?? ''}` },
        body: JSON.stringify({ accountId: registeredAccountId, regions: regions_input }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Discovery failed');
      const result = await res.json();
      message.success(`Discovered ${result.discovered ?? 0} cluster(s)`);
      setAddModalOpen(false);
      setAddStep(0);
      setRegisteredAccountId(null);
      form.resetFields();
      void loadFleet();
    } catch (err: any) {
      message.error(err.message ?? 'Failed to discover clusters');
    } finally {
      setAddLoading(false);
    }
  };

  const columns = [
    {
      title: 'Cluster Name', dataIndex: 'clusterName', key: 'clusterName',
      width: colWidths.clusterName, ellipsis: { showTitle: false },
      onHeaderCell: () => ({ width: colWidths.clusterName, onResize: handleResize('clusterName') }),
      sorter: (a: ClusterSummary, b: ClusterSummary) => a.clusterName.localeCompare(b.clusterName),
      render: (name: string, c: ClusterSummary) => (
        <Tooltip title={name} placement="topLeft">
          <Button type="link" size="small" style={{ padding: 0, fontWeight: 600, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => navigate(`/clusters/${c.id}`)}>
            {name}
          </Button>
        </Tooltip>
      ),
    },
    {
      title: 'Account', dataIndex: 'accountName', key: 'account',
      width: colWidths.account, ellipsis: { showTitle: true },
      onHeaderCell: () => ({ width: colWidths.account, onResize: handleResize('account') }),
      sorter: (a: ClusterSummary, b: ClusterSummary) => a.accountName.localeCompare(b.accountName),
    },
    {
      title: 'Region', dataIndex: 'region', key: 'region',
      width: colWidths.region,
      onHeaderCell: () => ({ width: colWidths.region, onResize: handleResize('region') }),
      sorter: (a: ClusterSummary, b: ClusterSummary) => a.region.localeCompare(b.region),
      render: (r: string) => <Tag>{r}</Tag>,
    },
    {
      title: 'EKS Version', dataIndex: 'eksVersion', key: 'version',
      width: colWidths.version,
      onHeaderCell: () => ({ width: colWidths.version, onResize: handleResize('version') }),
      sorter: (a: ClusterSummary, b: ClusterSummary) => (a.eksVersion ?? '').localeCompare(b.eksVersion ?? ''),
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      width: colWidths.status,
      onHeaderCell: () => ({ width: colWidths.status, onResize: handleResize('status') }),
      render: (s: string) => {
        const color = s === 'ACTIVE' || s === 'discovered' ? 'success' : s === 'FAILED' ? 'error' : 'processing';
        return <Tag color={color}>{s?.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Health', key: 'health',
      width: colWidths.health,
      onHeaderCell: () => ({ width: colWidths.health, onResize: handleResize('health') }),
      render: (_: unknown, c: ClusterSummary) => c.latestHealthStatus ? (
        <Badge
          status={c.latestHealthStatus === 'HEALTHY' ? 'success' : c.latestHealthStatus === 'CRITICAL' ? 'error' : 'warning'}
          text={<Space>{c.latestHealthStatus}{c.latestHealthFindings ? <Tag color={HEALTH_COLOR[c.latestHealthStatus]}>{c.latestHealthFindings} findings</Tag> : null}</Space>}
        />
      ) : <Text type="secondary">Unknown</Text>,
    },
    {
      title: 'Last Synced', dataIndex: 'lastSyncedAt', key: 'lastSyncedAt',
      width: colWidths.lastSynced,
      onHeaderCell: () => ({ width: colWidths.lastSynced, onResize: handleResize('lastSynced') }),
      sorter: (a: ClusterSummary, b: ClusterSummary) =>
        new Date(a.lastSyncedAt).getTime() - new Date(b.lastSyncedAt).getTime(),
      render: (d: string) => d ? new Date(d).toLocaleString() : '—',
    },
    {
      title: 'Actions', key: 'actions',
      width: colWidths.actions, fixed: 'right' as const,
      onHeaderCell: () => ({ width: colWidths.actions, onResize: handleResize('actions') }),
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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setAddModalOpen(true); setAddStep(0); form.resetFields(); }}>
            Add Cluster
          </Button>
        </Space>
      </Space>

      <Modal
        title="Add AWS Account & Discover Clusters"
        open={addModalOpen}
        onCancel={() => { setAddModalOpen(false); setAddStep(0); setRegisteredAccountId(null); form.resetFields(); }}
        footer={null}
        width={560}
      >
        <Steps current={addStep} style={{ marginBottom: 24 }} items={[
          { title: 'Register Account' },
          { title: 'Discover Clusters' },
        ]} />

        {addStep === 0 && (
          <Form form={form} layout="vertical">
            <Form.Item name="accountName" label="Account Name" rules={[{ required: true, message: 'Account name is required' }]}>
              <Input placeholder="e.g. prod-aws-account" />
            </Form.Item>
            <Form.Item
              name="roleArn"
              label="IAM Role ARN"
              rules={[{ required: true, message: 'Role ARN is required' }]}
              extra="The API pod will assume this role to discover clusters. Grant sts:AssumeRole to the pod's IAM identity in the role's trust policy."
            >
              <Input placeholder="arn:aws:iam::123456789012:role/EKSReadRole" />
            </Form.Item>
            <Form.Item name="externalId" label="External ID (optional)" extra="Recommended for cross-account roles.">
              <Input placeholder="optional-external-id" />
            </Form.Item>
            <Form.Item name="defaultRegion" label="Default Region" rules={[{ required: true, message: 'Region is required' }]}>
              <Input placeholder="us-east-2" />
            </Form.Item>
            <Button type="primary" loading={addLoading} onClick={handleRegisterAccount} block>
              Register Account
            </Button>
          </Form>
        )}

        {addStep === 1 && (
          <Form form={form} layout="vertical">
            <Form.Item
              name="regions"
              label="Regions to scan (optional — leave blank to scan all regions)"
              extra="Comma-separated, e.g. us-east-1, eu-west-1. Defaults to all AWS commercial EKS regions."
            >
              <Input placeholder="us-east-1, us-east-2, eu-west-1" allowClear />
            </Form.Item>
            <Space style={{ width: '100%' }} direction="vertical">
              <Button type="primary" loading={addLoading} onClick={handleDiscoverClusters} block>
                Discover Clusters in All Regions
              </Button>
              <Button onClick={() => { setAddStep(0); setRegisteredAccountId(null); }} block>
                Back
              </Button>
            </Space>
          </Form>
        )}
      </Modal>

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
        title={
          <Space>
            {`Clusters (${filteredClusters.length}/${total})`}
            {selectedRowKeys.length > 0 && (
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={openBulkModal}
                size="small"
              >
                Upgrade {selectedRowKeys.length} Selected
              </Button>
            )}
          </Space>
        }
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
            components={{ header: { cell: ResizableTitle } }}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              getCheckboxProps: (record: ClusterSummary) => ({
                disabled: !record.eksVersion,
                title: !record.eksVersion ? 'Version unknown — cannot upgrade' : '',
              }),
            }}
            pagination={{
              current: page,
              pageSize: 50,
              total,
              onChange: setPage,
            }}
            scroll={{ x: 1100, y: 500 }}
          />
        )}
      </Card>

      {/* Bulk Upgrade Modal */}
      <Modal
        title={<Space><ThunderboltOutlined />Bulk Upgrade {selectedRowKeys.length > 0 ? selectedRowKeys.length : ''} Clusters</Space>}
        open={bulkModalOpen}
        onCancel={() => { setBulkModalOpen(false); setBulkResults(null); }}
        footer={bulkResults ? (
          <Button onClick={() => { setBulkModalOpen(false); setBulkResults(null); }}>Close</Button>
        ) : (
          <Space>
            <Button onClick={() => setBulkModalOpen(false)}>Cancel</Button>
            <Button type="primary" icon={<ThunderboltOutlined />} loading={bulkLoading} onClick={handleBulkUpgrade} disabled={!bulkTargetVersion}>
              Start Upgrade
            </Button>
          </Space>
        )}
        width={560}
      >
        {bulkResults ? (
          <Result
            status={bulkResults.failed === 0 ? 'success' : 'warning'}
            title={`${bulkResults.succeeded} of ${bulkResults.total} upgrade jobs queued`}
            subTitle={bulkResults.failed > 0 ? `${bulkResults.failed} cluster(s) could not be queued` : undefined}
            extra={
              <List
                size="small"
                dataSource={bulkResults.results}
                renderItem={(r: any) => (
                  <List.Item>
                    <Space>
                      {r.status === 'queued'
                        ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        : <CloseCircleOutlined style={{ color: '#f5222d' }} />}
                      <Text>{clusters.find((c) => c.id === r.clusterId)?.clusterName ?? r.clusterId}</Text>
                      {r.error && <Text type="danger" style={{ fontSize: 12 }}>— {r.error}</Text>}
                      {r.jobId && <Text type="secondary" style={{ fontSize: 12 }}>Job: {r.jobId.slice(0, 8)}…</Text>}
                    </Space>
                  </List.Item>
                )}
              />
            }
          />
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              message={`${selectedRowKeys.length} cluster(s) will be scheduled for upgrade`}
              description={
                <List
                  size="small"
                  style={{ marginTop: 8 }}
                  dataSource={clusters.filter((c) => selectedRowKeys.includes(c.id))}
                  renderItem={(c) => (
                    <List.Item style={{ padding: '4px 0' }}>
                      <Space>
                        <Text strong>{c.clusterName}</Text>
                        <Tag>{c.region}</Tag>
                        <Tag color="blue">{c.eksVersion}</Tag>
                        <Text type="secondary">→</Text>
                        <Tag color="green">{bulkTargetVersion}</Tag>
                      </Space>
                    </List.Item>
                  )}
                />
              }
              type="info"
              showIcon
            />
            <div>
              <Text strong>Target Version: </Text>
              <Select
                value={bulkTargetVersion}
                onChange={setBulkTargetVersion}
                style={{ width: 120, marginLeft: 8 }}
                options={availableVersions.map((v) => ({ value: v, label: v }))}
              />
            </div>
            <Alert
              message="Note: Clusters already on the target version or higher will be skipped automatically."
              type="warning"
              showIcon
            />
          </Space>
        )}
      </Modal>
    </div>
  );
}
