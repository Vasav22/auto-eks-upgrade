import { useEffect, useState } from 'react';
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
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;

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

export function ClusterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCluster = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/clusters/${id}`);
      setCluster(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cluster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCluster();
  }, [id]);

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; icon: any }> = {
      ACTIVE: { color: 'success', icon: <CheckCircleOutlined /> },
      CREATING: { color: 'processing', icon: <CloudServerOutlined /> },
      UPDATING: { color: 'processing', icon: <CloudServerOutlined /> },
      DELETING: { color: 'error', icon: <CloseCircleOutlined /> },
      FAILED: { color: 'error', icon: <CloseCircleOutlined /> },
    };

    const config = statusMap[status] || { color: 'default', icon: null };
    return (
      <Tag color={config.color} icon={config.icon}>
        {status}
      </Tag>
    );
  };

  const getSupportStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; icon: any }> = {
      supported: { color: 'success', icon: <CheckCircleOutlined /> },
      deprecated: { color: 'warning', icon: <WarningOutlined /> },
      unsupported: { color: 'error', icon: <CloseCircleOutlined /> },
    };

    const config = statusMap[status] || { color: 'default', icon: null };
    return (
      <Tag color={config.color} icon={config.icon}>
        {status.toUpperCase()}
      </Tag>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error Loading Cluster"
        description={error}
        type="error"
        showIcon
        action={
          <Button size="small" danger onClick={fetchCluster}>
            Retry
          </Button>
        }
      />
    );
  }

  if (!cluster) {
    return (
      <Alert
        message="Cluster Not Found"
        description="The requested cluster could not be found."
        type="warning"
        showIcon
      />
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/clusters')}
            >
              Back to Clusters
            </Button>
            <Title level={2} style={{ margin: 0 }}>
              {cluster.clusterName}
            </Title>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={fetchCluster}>
            Refresh
          </Button>
        </div>

        <Card title="Cluster Information">
          <Descriptions column={2} bordered>
            <Descriptions.Item label="Cluster Name">
              {cluster.clusterName}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              {getStatusTag(cluster.status)}
            </Descriptions.Item>
            <Descriptions.Item label="EKS Version">
              <Space>
                <Text strong>{cluster.eksVersion}</Text>
                {getSupportStatusTag(cluster.versionInfo.supportStatus)}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Region">
              {cluster.region}
            </Descriptions.Item>
            <Descriptions.Item label="Account">
              {cluster.account.accountName}
            </Descriptions.Item>
            <Descriptions.Item label="Last Synced">
              {new Date(cluster.lastSyncedAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Cluster ARN" span={2}>
              <Text copyable style={{ fontSize: '12px' }}>
                {cluster.clusterArn}
              </Text>
            </Descriptions.Item>
            {cluster.endpoint && (
              <Descriptions.Item label="Endpoint" span={2}>
                <Text copyable style={{ fontSize: '12px' }}>
                  {cluster.endpoint}
                </Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        <Card title="Version Information">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>Current Version: </Text>
              <Text>{cluster.versionInfo.currentVersion}</Text>
              {' '}
              {getSupportStatusTag(cluster.versionInfo.supportStatus)}
            </div>

            {cluster.versionInfo.supportStatus === 'deprecated' && (
              <Alert
                message="Version Deprecation Warning"
                description="This EKS version will reach end-of-support soon. Consider upgrading to a newer version."
                type="warning"
                showIcon
              />
            )}

            {cluster.versionInfo.supportStatus === 'unsupported' && (
              <Alert
                message="Unsupported Version"
                description="This EKS version is no longer supported. Upgrade immediately to maintain security and support."
                type="error"
                showIcon
              />
            )}

            <Divider />

            {cluster.versionInfo.canUpgrade ? (
              <>
                <Title level={5}>Available Upgrade Paths</Title>
                <Text type="secondary">
                  Maximum version skip: {cluster.versionInfo.maxSkip}
                </Text>

                <Timeline
                  items={cluster.versionInfo.eligibleVersions.map((v) => ({
                    color: v.isRecommended ? 'green' : 'blue',
                    dot: v.isRecommended ? <CheckCircleOutlined /> : undefined,
                    children: (
                      <Space direction="vertical" size="small">
                        <Space>
                          <Text strong>Version {v.version}</Text>
                          {v.isRecommended && (
                            <Tag color="green">Recommended</Tag>
                          )}
                          {!v.isSupported && (
                            <Tag color="red">End of Support Reached</Tag>
                          )}
                        </Space>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          Released: {new Date(v.releaseDate).toLocaleDateString()}
                          {' | '}
                          End of Support: {new Date(v.endOfSupport).toLocaleDateString()}
                        </Text>
                      </Space>
                    ),
                  }))}
                />

                {cluster.versionInfo.recommendedVersion && (
                  <Alert
                    message="Recommended Upgrade"
                    description={`Upgrade to version ${cluster.versionInfo.recommendedVersion} for the most stable and secure experience.`}
                    type="info"
                    showIcon
                    action={
                      <Button type="primary" size="small">
                        Start Upgrade
                      </Button>
                    }
                  />
                )}
              </>
            ) : (
              <Alert
                message="No Upgrades Available"
                description="This cluster is already running the latest available version."
                type="success"
                showIcon
              />
            )}
          </Space>
        </Card>
      </Space>
    </div>
  );
}
