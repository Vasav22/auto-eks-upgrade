import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Form,
  Select,
  Button,
  Card,
  Space,
  Alert,
  Descriptions,
  Tag,
  Switch,
  Input,
  Divider,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface ClusterDetail {
  id: string;
  clusterName: string;
  region: string;
  eksVersion: string;
  status: string;
  versionInfo: {
    currentVersion: string;
    eligibleVersions: Array<{
      version: string;
      isRecommended: boolean;
      isSupported: boolean;
    }>;
    recommendedVersion: string | null;
    canUpgrade: boolean;
    supportStatus: string;
  };
}

export function UpgradeForm() {
  const { clusterId } = useParams<{ clusterId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(false);

  useEffect(() => {
    loadCluster();
  }, [clusterId]);

  const loadCluster = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/clusters/${clusterId}`);
      setCluster(response.data);

      if (response.data.versionInfo.recommendedVersion) {
        form.setFieldsValue({
          targetVersion: response.data.versionInfo.recommendedVersion,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cluster');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!cluster) return;

    try {
      setSubmitting(true);
      setError(null);

      const idempotencyKey = uuidv4();

      const response = await axios.post(
        '/api/upgrades',
        {
          clusterId: cluster.id,
          targetVersion: values.targetVersion,
          dryRun,
          notes: values.notes,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        },
      );

      navigate(`/upgrades/${response.data.id}`);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to create upgrade job',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Card loading />;
  }

  if (error && !cluster) {
    return (
      <Alert
        message="Error"
        description={error}
        type="error"
        showIcon
        action={
          <Button onClick={loadCluster}>Retry</Button>
        }
      />
    );
  }

  if (!cluster) {
    return (
      <Alert message="Cluster not found" type="warning" showIcon />
    );
  }

  if (!cluster.versionInfo.canUpgrade) {
    return (
      <Card>
        <Alert
          message="No Upgrades Available"
          description="This cluster is already at the latest version or has no eligible upgrade paths."
          type="info"
          showIcon
        />
        <div style={{ marginTop: '16px' }}>
          <Button onClick={() => navigate(`/clusters/${cluster.id}`)}>
            Back to Cluster Details
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/clusters/${cluster.id}`)}
            style={{ marginBottom: '16px' }}
          >
            Back to Cluster
          </Button>
          <Title level={2}>
            <RocketOutlined /> Create Upgrade Job
          </Title>
        </div>

        <Card title="Cluster Information">
          <Descriptions column={2}>
            <Descriptions.Item label="Cluster Name">
              {cluster.clusterName}
            </Descriptions.Item>
            <Descriptions.Item label="Region">
              {cluster.region}
            </Descriptions.Item>
            <Descriptions.Item label="Current Version">
              <Tag color="blue">{cluster.eksVersion}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={cluster.status === 'ACTIVE' ? 'success' : 'default'}>
                {cluster.status}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {cluster.versionInfo.supportStatus !== 'supported' && (
          <Alert
            message={`Version ${cluster.eksVersion} is ${cluster.versionInfo.supportStatus}`}
            description="Consider upgrading to a supported version for continued security updates and support."
            type="warning"
            showIcon
            icon={<WarningOutlined />}
          />
        )}

        <Card title="Upgrade Configuration">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              targetVersion: cluster.versionInfo.recommendedVersion,
            }}
          >
            <Form.Item
              name="targetVersion"
              label="Target Version"
              rules={[
                { required: true, message: 'Please select a target version' },
              ]}
            >
              <Select
                size="large"
                placeholder="Select target version"
                options={cluster.versionInfo.eligibleVersions.map((v) => ({
                  value: v.version,
                  label: (
                    <Space>
                      <span>{v.version}</span>
                      {v.isRecommended && (
                        <Tag color="green" icon={<CheckCircleOutlined />}>
                          Recommended
                        </Tag>
                      )}
                      {!v.isSupported && (
                        <Tag color="red">End of Support</Tag>
                      )}
                    </Space>
                  ),
                }))}
              />
            </Form.Item>

            <Form.Item label="Dry Run">
              <Space>
                <Switch checked={dryRun} onChange={setDryRun} />
                <Text type="secondary">
                  Validate the upgrade without making actual changes
                </Text>
              </Space>
            </Form.Item>

            <Form.Item name="notes" label="Notes (Optional)">
              <TextArea
                rows={3}
                placeholder="Add any notes about this upgrade..."
              />
            </Form.Item>

            {error && (
              <Alert
                message="Error"
                description={error}
                type="error"
                showIcon
                closable
                onClose={() => setError(null)}
                style={{ marginBottom: '16px' }}
              />
            )}

            <Divider />

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  loading={submitting}
                  icon={<RocketOutlined />}
                >
                  {dryRun ? 'Run Validation' : 'Start Upgrade'}
                </Button>
                <Button
                  size="large"
                  onClick={() => navigate(`/clusters/${cluster.id}`)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        <Alert
          message="Important"
          description="Before starting the upgrade, ensure you have recent backups and have reviewed the upgrade path. The upgrade process may take 30-60 minutes and will cause temporary disruption."
          type="info"
          showIcon
        />
      </Space>
    </div>
  );
}
