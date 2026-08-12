import { useEffect, useState, useCallback } from 'react';
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
  Typography,
  Divider,
  Table,
  Popconfirm,
  message,
  Select,
  Input,
  Row,
  Col,
  Tooltip,
  Badge,
  Checkbox,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  StopOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  FilterOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

interface LiveNodeGroup {
  name: string;
  status: string;
  currentVersion: string;
  amiType: string | null;
  instanceTypes: string[];
  desiredSize: number;
  labels: Record<string, string>;
  capacityType: string | null;
}

interface UpgradeJob {
  id: string;
  fromVersion: string;
  toVersion: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

interface EligibleVersion {
  version: string;
  isRecommended: boolean;
  releaseDate: string;
  endOfSupport: string;
  isSupported: boolean;
}

interface ClusterVersionInfo {
  currentVersion: string;
  eligibleVersions: EligibleVersion[];
  recommendedVersion: string | null;
  maxSkip: number;
  canUpgrade: boolean;
  supportStatus: 'supported' | 'deprecated' | 'unsupported';
}

interface ClusterDetail {
  id: string;
  clusterName: string;
  clusterArn: string;
  region: string;
  eksVersion: string;
  status: string;
  endpoint: string | null;
  lastSyncedAt: string;
  createdAt: string;
  account: {
    id: string;
    accountName: string;
    defaultRegion: string;
  };
  versionInfo: ClusterVersionInfo;
}

export default function ClusterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Control plane jobs
  const [jobs, setJobs] = useState<UpgradeJob[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cpTargetVersion, setCpTargetVersion] = useState<string>('');
  const [cpQueuing, setCpQueuing] = useState(false);

  // Node groups (independent section)
  const [nodeGroups, setNodeGroups] = useState<LiveNodeGroup[]>([]);
  const [ngLoading, setNgLoading] = useState(false);
  const [ngLoaded, setNgLoaded] = useState(false);
  const [selectedNGs, setSelectedNGs] = useState<string[]>([]);
  const [ngFilter, setNgFilter] = useState<'all' | 'label' | 'name'>('all');
  const [ngLabelKey, setNgLabelKey] = useState('');
  const [ngLabelValue, setNgLabelValue] = useState('');
  const [ngNameFilter, setNgNameFilter] = useState('');
  const [ngTargetVersion, setNgTargetVersion] = useState<string>('');
  const [ngQueuing, setNgQueuing] = useState(false);

  const [ngResults, setNgResults] = useState<{ name: string; status: string; error?: string }[] | null>(null);

  // Node group jobs
  const [ngJobs, setNgJobs] = useState<UpgradeJob[]>([]);
  const [cancellingNgId, setCancellingNgId] = useState<string | null>(null);

  const fetchCluster = async () => {
    try {
      setLoading(true);
      setError(null);
      const [clusterRes, jobsRes, ngJobsRes] = await Promise.all([
        axios.get(`/api/clusters/${id}`),
        axios.get(`/api/upgrades?clusterId=${id}`),
        axios.get(`/api/node-groups/cluster/${id}/jobs`),
      ]);
      setCluster(clusterRes.data);
      setJobs(jobsRes.data ?? []);
      setNgJobs(ngJobsRes.data ?? []);
      const recommended = clusterRes.data?.versionInfo?.recommendedVersion;
      if (recommended) setCpTargetVersion(recommended);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cluster');
    } finally {
      setLoading(false);
    }
  };

  const refreshNgJobs = async () => {
    try {
      const res = await axios.get(`/api/node-groups/cluster/${id}/jobs`);
      setNgJobs(res.data ?? []);
    } catch { /* silent */ }
  };

  const cancelNgJob = async (jobId: string) => {
    setCancellingNgId(jobId);
    try {
      await axios.delete(`/api/upgrades/${jobId}`);
      message.success('Node group upgrade job cancelled');
      setNgJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: 'cancelled' } : j));
    } catch (err: any) {
      message.error(err.response?.data?.message ?? 'Failed to cancel job');
    } finally {
      setCancellingNgId(null);
    }
  };

  const cancelJob = async (jobId: string) => {
    setCancellingId(jobId);
    try {
      await axios.delete(`/api/upgrades/${jobId}`);
      message.success('Upgrade job cancelled');
      setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: 'cancelled' } : j));
    } catch (err: any) {
      message.error(err.response?.data?.message ?? 'Failed to cancel job');
    } finally {
      setCancellingId(null);
    }
  };

  const handleQueueCpUpgrade = async () => {
    if (!cpTargetVersion) return;
    setCpQueuing(true);
    try {
      await axios.post('/api/upgrades', { clusterId: id, targetVersion: cpTargetVersion });
      message.success(`Control plane upgrade to ${cpTargetVersion} queued`);
      const jobsRes = await axios.get(`/api/upgrades?clusterId=${id}`);
      setJobs(jobsRes.data ?? []);
    } catch (err: any) {
      message.error(err.response?.data?.message ?? 'Failed to queue upgrade');
    } finally {
      setCpQueuing(false);
    }
  };

  const loadNodeGroups = async () => {
    setNgLoading(true);
    setNgResults(null);
    try {
      const res = await axios.get(`/api/node-groups/cluster/${id}/live`);
      const ngs: LiveNodeGroup[] = res.data ?? [];
      setNodeGroups(ngs);
      setSelectedNGs(ngs.map((ng) => ng.name)); // select all by default
      setNgLoaded(true);
      // Default NG target version = cluster current version (user will change it)
      if (cluster?.eksVersion) setNgTargetVersion(cluster.eksVersion);
    } catch (err: any) {
      message.error(err.response?.data?.message ?? 'Failed to load node groups from AWS');
    } finally {
      setNgLoading(false);
    }
  };

  const filteredNGs = useCallback((): LiveNodeGroup[] => {
    if (ngFilter === 'name') {
      const term = ngNameFilter.toLowerCase();
      return nodeGroups.filter((ng) => ng.name.toLowerCase().includes(term));
    }
    if (ngFilter === 'label') {
      return nodeGroups.filter((ng) => {
        if (!ngLabelKey) return true;
        const val = ng.labels?.[ngLabelKey];
        return val !== undefined && (ngLabelValue === '' || val === ngLabelValue);
      });
    }
    return nodeGroups;
  }, [nodeGroups, ngFilter, ngNameFilter, ngLabelKey, ngLabelValue]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedNGs(checked ? filteredNGs().map((ng) => ng.name) : []);
  };

  const handleQueueNodeGroupUpgrades = async () => {
    if (!id || selectedNGs.length === 0 || !ngTargetVersion) return;
    setNgQueuing(true);
    try {
      await axios.post(`/api/node-groups/cluster/${id}/upgrade`, {
        nodeGroupNames: selectedNGs,
        targetVersion: ngTargetVersion,
      });
      message.success(`${selectedNGs.length} node group upgrade job(s) queued`);
      setSelectedNGs([]);
      await refreshNgJobs();
    } catch (err: any) {
      message.error(err.response?.data?.message ?? 'Failed to queue node group upgrades');
    } finally {
      setNgQueuing(false);
    }
  };

  useEffect(() => { fetchCluster(); }, [id]);

  const getStatusTag = (status: string) => {
    const map: Record<string, { color: string; icon: any }> = {
      ACTIVE: { color: 'success', icon: <CheckCircleOutlined /> },
      CREATING: { color: 'processing', icon: <CloudServerOutlined /> },
      UPDATING: { color: 'processing', icon: <CloudServerOutlined /> },
      DELETING: { color: 'error', icon: <CloseCircleOutlined /> },
      FAILED: { color: 'error', icon: <CloseCircleOutlined /> },
    };
    const cfg = map[status] ?? { color: 'default', icon: null };
    return <Tag color={cfg.color} icon={cfg.icon}>{status}</Tag>;
  };

  const getSupportStatusTag = (status: string) => {
    const map: Record<string, { color: string; icon: any }> = {
      supported: { color: 'success', icon: <CheckCircleOutlined /> },
      deprecated: { color: 'warning', icon: <WarningOutlined /> },
      unsupported: { color: 'error', icon: <CloseCircleOutlined /> },
    };
    const cfg = map[status] ?? { color: 'default', icon: null };
    return <Tag color={cfg.color} icon={cfg.icon}>{status.toUpperCase()}</Tag>;
  };

  const jobStatusColor = (s: string) => {
    const u = s?.toUpperCase();
    if (u === 'COMPLETED') return 'success';
    if (u === 'FAILED' || u === 'CANCELLED') return 'error';
    if (u === 'IN_PROGRESS') return 'processing';
    return 'default';
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '100px 0' }}><Spin size="large" /></div>;

  if (error) return (
    <Alert message="Error Loading Cluster" description={error} type="error" showIcon
      action={<Button size="small" danger onClick={fetchCluster}>Retry</Button>} />
  );

  if (!cluster) return (
    <Alert message="Cluster Not Found" description="The requested cluster could not be found." type="warning" showIcon />
  );

  const visibleNGs = filteredNGs();
  const allVisibleSelected = visibleNGs.length > 0 && visibleNGs.every((ng) => selectedNGs.includes(ng.name));
  const someVisibleSelected = visibleNGs.some((ng) => selectedNGs.includes(ng.name)) && !allVisibleSelected;

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clusters')}>Back to Clusters</Button>
            <Title level={2} style={{ margin: 0 }}>{cluster.clusterName}</Title>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={fetchCluster}>Refresh</Button>
        </div>

        {/* Cluster Info */}
        <Card title="Cluster Information">
          <Descriptions column={2} bordered>
            <Descriptions.Item label="Cluster Name">{cluster.clusterName}</Descriptions.Item>
            <Descriptions.Item label="Status">{getStatusTag(cluster.status)}</Descriptions.Item>
            <Descriptions.Item label="EKS Version">
              <Space>
                <Text strong>{cluster.eksVersion || '—'}</Text>
                {cluster.versionInfo && getSupportStatusTag(cluster.versionInfo.supportStatus)}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Region">{cluster.region}</Descriptions.Item>
            <Descriptions.Item label="Account">{cluster.account.accountName}</Descriptions.Item>
            <Descriptions.Item label="Last Synced">{new Date(cluster.lastSyncedAt).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="Cluster ARN" span={2}>
              <Text copyable style={{ fontSize: 12 }}>{cluster.clusterArn}</Text>
            </Descriptions.Item>
            {cluster.endpoint && (
              <Descriptions.Item label="Endpoint" span={2}>
                <Text copyable style={{ fontSize: 12 }}>{cluster.endpoint}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* ── Control Plane Upgrade ── */}
        <Card title={<Space><ThunderboltOutlined /> Control Plane Upgrade</Space>}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {!cluster.versionInfo ? (
              <Alert message="Version information unavailable" type="warning" showIcon
                description="Run a discovery sync to refresh the cluster version." />
            ) : (
              <>
                <Space>
                  <Text strong>Current Version:</Text>
                  <Text>{cluster.versionInfo.currentVersion}</Text>
                  {getSupportStatusTag(cluster.versionInfo.supportStatus)}
                </Space>

                {cluster.versionInfo.supportStatus === 'deprecated' && (
                  <Alert message="Version Deprecation Warning" type="warning" showIcon
                    description="This EKS version will reach end-of-support soon." />
                )}
                {cluster.versionInfo.supportStatus === 'unsupported' && (
                  <Alert message="Unsupported Version" type="error" showIcon
                    description="This EKS version is no longer supported. Upgrade immediately." />
                )}

                <Divider />

                {cluster.versionInfo.canUpgrade ? (
                  <>
                    <Title level={5}>Available Upgrade Paths</Title>
                    <Text type="secondary">Maximum version skip: {cluster.versionInfo.maxSkip}</Text>
                    <Timeline
                      items={cluster.versionInfo.eligibleVersions.map((v) => ({
                        color: v.isRecommended ? 'green' : 'blue',
                        dot: v.isRecommended ? <CheckCircleOutlined /> : undefined,
                        children: (
                          <Space direction="vertical" size={0}>
                            <Space>
                              <Text strong>Version {v.version}</Text>
                              {v.isRecommended && <Tag color="green">Recommended</Tag>}
                              {!v.isSupported && <Tag color="red">End of Support Reached</Tag>}
                            </Space>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Released: {new Date(v.releaseDate).toLocaleDateString()}
                              {' | '}
                              End of Support: {new Date(v.endOfSupport).toLocaleDateString()}
                            </Text>
                          </Space>
                        ),
                      }))}
                    />

                    <Divider />

                    <Row gutter={12} align="middle">
                      <Col>
                        <Text strong>Target Version:</Text>
                      </Col>
                      <Col>
                        <Select
                          value={cpTargetVersion}
                          onChange={setCpTargetVersion}
                          style={{ width: 120 }}
                          options={cluster.versionInfo.eligibleVersions.map((v) => ({
                            value: v.version,
                            label: v.isRecommended ? `${v.version} ★` : v.version,
                          }))}
                        />
                      </Col>
                      <Col>
                        <Tooltip title="Queues a control plane upgrade job — execution is disabled until you're ready to run real upgrades">
                          <Button
                            type="primary"
                            icon={<ThunderboltOutlined />}
                            loading={cpQueuing}
                            onClick={handleQueueCpUpgrade}
                            disabled={!cpTargetVersion}
                          >
                            Queue Control Plane Upgrade
                          </Button>
                        </Tooltip>
                      </Col>
                    </Row>
                  </>
                ) : (
                  <Alert message="No Upgrades Available"
                    description="This cluster is already running the latest available version."
                    type="success" showIcon />
                )}
              </>
            )}
          </Space>
        </Card>

        {/* ── Control Plane Job History ── */}
        <Card
          title="Control Plane Upgrade Jobs"
          extra={<Button size="small" icon={<ReloadOutlined />} onClick={fetchCluster}>Refresh</Button>}
        >
          {jobs.length === 0 ? (
            <Text type="secondary">No upgrade jobs for this cluster.</Text>
          ) : (
            <Table
              dataSource={jobs}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 5, size: 'small' }}
              columns={[
                {
                  title: 'Job ID', dataIndex: 'id', key: 'id', width: 110,
                  render: (v: string) => <Text code style={{ fontSize: 11 }}>{v.slice(0, 8)}…</Text>,
                },
                {
                  title: 'From', dataIndex: 'fromVersion', key: 'from', width: 90,
                  render: (v: string) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>,
                },
                {
                  title: 'To', dataIndex: 'toVersion', key: 'to', width: 90,
                  render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text>,
                },
                {
                  title: 'Status', dataIndex: 'status', key: 'status', width: 110,
                  render: (s: string) => <Tag color={jobStatusColor(s)}>{s?.toUpperCase()}</Tag>,
                },
                {
                  title: 'Created', dataIndex: 'createdAt', key: 'createdAt',
                  render: (d: string) => new Date(d).toLocaleString(),
                },
                {
                  title: 'Action', key: 'action', width: 90,
                  render: (_: unknown, job: UpgradeJob) =>
                    ['PENDING', 'IN_PROGRESS', 'pending', 'in_progress'].includes(job.status) ? (
                      <Popconfirm
                        title="Cancel this upgrade job?"
                        onConfirm={() => cancelJob(job.id)}
                        okText="Yes, Cancel"
                        cancelText="No"
                        okButtonProps={{ danger: true }}
                      >
                        <Button size="small" danger icon={<StopOutlined />} loading={cancellingId === job.id}>
                          Cancel
                        </Button>
                      </Popconfirm>
                    ) : null,
                },
              ]}
            />
          )}
        </Card>

        {/* ── Node Group Upgrade (independent) ── */}
        <Card
          title={<Space><SyncOutlined /> Node Group Upgrade</Space>}
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={loadNodeGroups}
              loading={ngLoading}
            >
              {ngLoaded ? 'Reload from AWS' : 'Load Node Groups from AWS'}
            </Button>
          }
        >
          {!ngLoaded ? (
            <Space direction="vertical" align="center" style={{ width: '100%', padding: '24px 0' }}>
              <Text type="secondary">Node groups are fetched live from AWS.</Text>
              <Button type="primary" icon={<SyncOutlined />} loading={ngLoading} onClick={loadNodeGroups}>
                Load Node Groups
              </Button>
            </Space>
          ) : (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>

              {/* Results after upgrade triggered */}
              {ngResults ? (
                <>
                  <Alert type="success" showIcon message="Node group upgrades triggered" />
                  <Table
                    dataSource={ngResults}
                    rowKey="name"
                    size="small"
                    pagination={false}
                    columns={[
                      { title: 'Node Group', dataIndex: 'name', key: 'name' },
                      {
                        title: 'Status', dataIndex: 'status', key: 'status',
                        render: (s: string) => <Tag color={s === 'upgrading' ? 'processing' : 'error'}>{s.toUpperCase()}</Tag>,
                      },
                      {
                        title: 'Error', dataIndex: 'error', key: 'error',
                        render: (e: string) => e ? <Text type="danger" style={{ fontSize: 12 }}>{e}</Text> : null,
                      },
                    ]}
                  />
                  <Button onClick={() => { setNgResults(null); loadNodeGroups(); }}>Back to Selection</Button>
                </>
              ) : (
              <>
                {/* Filter bar */}
                <Card size="small" title={<Space><FilterOutlined />Filter Node Groups</Space>}>
                  <Row gutter={8} align="middle">
                    <Col>
                      <Select
                        value={ngFilter}
                        onChange={(v) => setNgFilter(v as any)}
                        style={{ width: 130 }}
                        options={[
                          { value: 'all', label: 'All groups' },
                          { value: 'name', label: 'By name' },
                          { value: 'label', label: 'By label' },
                        ]}
                      />
                    </Col>
                    {ngFilter === 'name' && (
                      <Col flex="auto">
                        <Input prefix={<SearchOutlined />} placeholder="Filter by name…"
                          value={ngNameFilter} onChange={(e) => setNgNameFilter(e.target.value)} />
                      </Col>
                    )}
                    {ngFilter === 'label' && (
                      <>
                        <Col flex="auto">
                          <Input placeholder="Label key (e.g. env)" value={ngLabelKey} onChange={(e) => setNgLabelKey(e.target.value)} />
                        </Col>
                        <Col flex="auto">
                          <Input placeholder="Label value (optional)" value={ngLabelValue} onChange={(e) => setNgLabelValue(e.target.value)} />
                        </Col>
                      </>
                    )}
                  </Row>
                </Card>

                {/* Select All + count */}
                <Row justify="space-between" align="middle">
                  <Col>
                    <Checkbox checked={allVisibleSelected} indeterminate={someVisibleSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}>
                      Select All ({visibleNGs.length} visible)
                    </Checkbox>
                  </Col>
                  <Col>
                    <Text type="secondary">{selectedNGs.length} of {nodeGroups.length} group(s) selected</Text>
                  </Col>
                </Row>

                {/* NG table */}
                <Table
                  dataSource={visibleNGs} rowKey="name" size="small"
                  pagination={false} scroll={{ y: 300 }}
                  rowSelection={{ selectedRowKeys: selectedNGs, onChange: (keys) => setSelectedNGs(keys as string[]) }}
                  columns={[
                    { title: 'Name', dataIndex: 'name', key: 'name', width: 200,
                      render: (n: string) => <Text strong>{n}</Text> },
                    { title: 'Current Ver.', dataIndex: 'currentVersion', key: 'ver', width: 110,
                      render: (v: string) => <Tag>{v || '—'}</Tag> },
                    { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
                      render: (s: string) => <Badge status={s === 'ACTIVE' ? 'success' : 'processing'} text={s} /> },
                    { title: 'Labels', dataIndex: 'labels', key: 'labels',
                      render: (labels: Record<string, string>) => (
                        <Space size={2} wrap>
                          {Object.entries(labels ?? {}).slice(0, 2).map(([k, v]) => (
                            <Tag key={k} style={{ fontSize: 10 }}>{k}={v}</Tag>
                          ))}
                          {Object.keys(labels ?? {}).length > 2 && (
                            <Tooltip title={Object.entries(labels).map(([k, v]) => `${k}=${v}`).join('\n')}>
                              <Tag style={{ fontSize: 10 }}>+{Object.keys(labels).length - 2} more</Tag>
                            </Tooltip>
                          )}
                        </Space>
                      ) },
                    { title: 'Instances', dataIndex: 'instanceTypes', key: 'inst', width: 120,
                      render: (t: string[]) => t?.[0] ?? '—' },
                    { title: 'Nodes', dataIndex: 'desiredSize', key: 'size', width: 70 },
                  ]}
                />

                {/* Target version + queue button */}
                <Divider style={{ margin: '8px 0' }} />
                <Row gutter={12} align="middle" justify="end">
                  <Col><Text strong>Target Version:</Text></Col>
                  <Col>
                    <Input value={ngTargetVersion} onChange={(e) => setNgTargetVersion(e.target.value)}
                      placeholder="e.g. 1.36" style={{ width: 100 }} />
                  </Col>
                  <Col>
                    <Button type="primary" icon={<ThunderboltOutlined />} loading={ngQueuing}
                      disabled={selectedNGs.length === 0 || !ngTargetVersion}
                      onClick={handleQueueNodeGroupUpgrades}>
                      Queue {selectedNGs.length} Node Group Upgrade(s)
                    </Button>
                  </Col>
                </Row>
              </>
            )}
          </Space>
        )}

        {/* Queued NG jobs */}
        {ngJobs.length > 0 && (
          <Card size="small"
            title={<Space><ThunderboltOutlined /> Queued Node Group Upgrade Jobs</Space>}
            extra={<Button size="small" icon={<ReloadOutlined />} onClick={refreshNgJobs}>Refresh</Button>}
          >
            <Table dataSource={ngJobs} rowKey="id" size="small"
              pagination={{ pageSize: 5, size: 'small' }}
              columns={[
                { title: 'Job ID', dataIndex: 'id', key: 'id', width: 110,
                  render: (v: string) => <Text code style={{ fontSize: 11 }}>{v.slice(0, 8)}…</Text> },
                { title: 'Node Group', key: 'ng', width: 200,
                  render: (_: unknown, job: UpgradeJob) =>
                    <Text>{(job as any).errorDetail?.nodeGroupName ?? '—'}</Text> },
                { title: 'To Version', dataIndex: 'toVersion', key: 'to', width: 90,
                  render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text> },
                { title: 'Status', dataIndex: 'status', key: 'status', width: 110,
                  render: (s: string) => <Tag color={jobStatusColor(s)}>{s?.toUpperCase()}</Tag> },
                { title: 'Created', dataIndex: 'createdAt', key: 'createdAt',
                  render: (d: string) => new Date(d).toLocaleString() },
                { title: 'Action', key: 'action', width: 90,
                  render: (_: unknown, job: UpgradeJob) =>
                    ['PENDING', 'IN_PROGRESS', 'pending', 'in_progress'].includes(job.status) ? (
                      <Popconfirm title="Cancel this node group upgrade job?"
                        onConfirm={() => cancelNgJob(job.id)}
                        okText="Yes, Cancel" cancelText="No" okButtonProps={{ danger: true }}>
                        <Button size="small" danger icon={<StopOutlined />} loading={cancellingNgId === job.id}>
                          Cancel
                        </Button>
                      </Popconfirm>
                    ) : null },
              ]}
            />
          </Card>
        )}
        </Card>

      </Space>
    </div>
  );
}
