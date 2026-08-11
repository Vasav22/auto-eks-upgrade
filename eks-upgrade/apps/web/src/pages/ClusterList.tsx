import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Tag,
  Button,
  Space,
  Input,
  Card,
  Typography,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;

interface Cluster {
  id: string;
  clusterName: string;
  region: string;
  eksVersion: string;
  status: string;
  account: {
    accountName: string;
  };
  lastSyncedAt: string;
}

export function ClusterList() {
  const navigate = useNavigate();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const fetchClusters = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/clusters');
      setClusters(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clusters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, []);

  const filteredClusters = clusters.filter(
    (cluster) =>
      cluster.clusterName.toLowerCase().includes(searchText.toLowerCase()) ||
      cluster.region.toLowerCase().includes(searchText.toLowerCase()) ||
      cluster.account.accountName.toLowerCase().includes(searchText.toLowerCase()),
  );

  const columns = [
    {
      title: 'Cluster Name',
      dataIndex: 'clusterName',
      key: 'clusterName',
      sorter: (a: Cluster, b: Cluster) => a.clusterName.localeCompare(b.clusterName),
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: 'Account',
      dataIndex: ['account', 'accountName'],
      key: 'account',
      sorter: (a: Cluster, b: Cluster) =>
        a.account.accountName.localeCompare(b.account.accountName),
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
      sorter: (a: Cluster, b: Cluster) => a.region.localeCompare(b.region),
    },
    {
      title: 'EKS Version',
      dataIndex: 'eksVersion',
      key: 'eksVersion',
      sorter: (a: Cluster, b: Cluster) => a.eksVersion.localeCompare(b.eksVersion),
      render: (version: string) => <Tag color="blue">{version}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color =
          status === 'ACTIVE'
            ? 'success'
            : status === 'FAILED'
              ? 'error'
              : 'processing';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'Last Synced',
      dataIndex: 'lastSyncedAt',
      key: 'lastSyncedAt',
      sorter: (a: Cluster, b: Cluster) =>
        new Date(a.lastSyncedAt).getTime() - new Date(b.lastSyncedAt).getTime(),
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Cluster) => (
        <Button
          type="link"
          onClick={() => navigate(`/clusters/${record.id}`)}
        >
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2} style={{ margin: 0 }}>
              <CloudServerOutlined /> EKS Clusters
            </Title>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchClusters}>
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/clusters/register')}
              >
                Register Account
              </Button>
            </Space>
          </div>

          {error && (
            <Alert
              message="Error Loading Clusters"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
            />
          )}

          <Input
            placeholder="Search clusters by name, region, or account..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />

          <Table
            columns={columns}
            dataSource={filteredClusters}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} clusters`,
            }}
          />
        </Space>
      </Card>
    </div>
  );
}
