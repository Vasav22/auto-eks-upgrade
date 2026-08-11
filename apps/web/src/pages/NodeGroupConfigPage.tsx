import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  InputNumber,
  Select,
  Spin,
  Alert,
  Progress,
  Badge,
  Tooltip,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface NodeGroup {
  id: string;
  name: string;
  nodeGroupName: string;
  currentVersion: string;
  targetVersion?: string;
  status: string;
  minSize: number;
  maxSize: number;
  desiredSize: number;
  instanceTypes: string[];
  capacityType: string;
  upgradeOrder?: number;
  upgradeStrategy: string;
  amiType?: string;
}

interface UpgradeStep {
  nodeGroupId: string;
  nodeGroupName: string;
  stepOrder: number;
  fromVersion: string;
  toVersion: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  nodesUpdated?: number;
  nodesTotal?: number;
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green',
  UPDATING: 'processing',
  DEGRADED: 'orange',
  DELETING: 'red',
  PENDING: 'default',
};

export default function NodeGroupConfigPage() {
  const { clusterId, upgradeJobId } = useParams<{ clusterId: string; upgradeJobId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [nodeGroups, setNodeGroups] = useState<NodeGroup[]>([]);
  const [upgradeSteps, setUpgradeSteps] = useState<UpgradeStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<NodeGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!clusterId) return;

    const load = async () => {
      try {
        setLoading(true);
        const ngRes = await fetch(`/api/clusters/${clusterId}/node-groups`, {
          headers: { Authorization: `Bearer ${user?.token ?? ''}` },
        });
        if (!ngRes.ok) throw new Error('Failed to load node groups');
        const ngData = await ngRes.json();
        setNodeGroups(ngData.nodeGroups ?? ngData);

        if (upgradeJobId) {
          const stepsRes = await fetch(`/api/upgrades/${upgradeJobId}/node-group-steps`, {
            headers: { Authorization: `Bearer ${user?.token ?? ''}` },
          });
          if (stepsRes.ok) {
            const stepsData = await stepsRes.json();
            setUpgradeSteps(stepsData.steps ?? []);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Load failed');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [clusterId, upgradeJobId, user?.token]);

  const openEdit = (ng: NodeGroup) => {
    setEditingGroup(ng);
    form.setFieldsValue({
      minSize: ng.minSize,
      maxSize: ng.maxSize,
      desiredSize: ng.desiredSize,
      upgradeOrder: ng.upgradeOrder,
      upgradeStrategy: ng.upgradeStrategy,
    });
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!editingGroup) return;
    try {
      setSaving(true);
      const values = await form.validateFields();
      const res = await fetch(`/api/node-groups/${editingGroup.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token ?? ''}`,
        },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = await res.json();
      setNodeGroups((prev) => prev.map((ng) => (ng.id === updated.id ? updated : ng)));
      setEditModalVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const getStepForGroup = (ng: NodeGroup): UpgradeStep | undefined =>
    upgradeSteps.find((s) => s.nodeGroupId === ng.id);

  const nodeGroupColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, ng: NodeGroup) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {ng.nodeGroupName}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Version',
      key: 'version',
      render: (_: unknown, ng: NodeGroup) => (
        <Space>
          <Tag color="blue">{ng.currentVersion}</Tag>
          {ng.targetVersion && (
            <>
              <Text type="secondary">→</Text>
              <Tag color="orange">{ng.targetVersion}</Tag>
            </>
          )}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={STATUS_COLOR[status] as any ?? 'default'}
          text={status}
        />
      ),
    },
    {
      title: 'Sizing',
      key: 'sizing',
      render: (_: unknown, ng: NodeGroup) => (
        <Text style={{ fontSize: 12 }}>
          {ng.minSize} / {ng.desiredSize} / {ng.maxSize}
          <Text type="secondary"> (min/desired/max)</Text>
        </Text>
      ),
    },
    {
      title: 'Instance Types',
      dataIndex: 'instanceTypes',
      key: 'instanceTypes',
      render: (types: string[]) => types.map((t) => <Tag key={t}>{t}</Tag>),
    },
    {
      title: 'Upgrade Order',
      dataIndex: 'upgradeOrder',
      key: 'upgradeOrder',
      render: (order: number | undefined) =>
        order != null ? <Tag>{order}</Tag> : <Text type="secondary">auto</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, ng: NodeGroup) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => openEdit(ng)}
          disabled={ng.status === 'UPDATING'}
        >
          Configure
        </Button>
      ),
    },
  ];

  const upgradeStepColumns = [
    {
      title: 'Step',
      dataIndex: 'stepOrder',
      key: 'stepOrder',
      render: (order: number) => <Tag color="blue">#{order}</Tag>,
    },
    {
      title: 'Node Group',
      dataIndex: 'nodeGroupName',
      key: 'nodeGroupName',
    },
    {
      title: 'Version',
      key: 'version',
      render: (_: unknown, step: UpgradeStep) => (
        <Space>
          <Tag>{step.fromVersion}</Tag>
          <Text type="secondary">→</Text>
          <Tag color="green">{step.toVersion}</Tag>
        </Space>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: unknown, step: UpgradeStep) => {
        if (step.status === 'PENDING') return <Text type="secondary">Waiting</Text>;
        if (step.status === 'COMPLETED') return <CheckCircleOutlined style={{ color: 'green' }} />;
        if (step.status === 'FAILED') return <CloseCircleOutlined style={{ color: 'red' }} />;
        const pct =
          step.nodesTotal && step.nodesTotal > 0
            ? Math.round(((step.nodesUpdated ?? 0) / step.nodesTotal) * 100)
            : undefined;
        return pct != null ? (
          <Progress percent={pct} size="small" status="active" />
        ) : (
          <SyncOutlined spin />
        );
      },
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Space>

      <Title level={3}>Node Group Configuration</Title>

      {error && (
        <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />
      )}

      {upgradeSteps.length > 0 && (
        <>
          <Card title="Upgrade Sequence" style={{ marginBottom: 16 }}>
            <Table
              dataSource={upgradeSteps}
              columns={upgradeStepColumns}
              rowKey="nodeGroupId"
              pagination={false}
              size="small"
            />
          </Card>
          <Divider />
        </>
      )}

      <Card
        title={`Node Groups (${nodeGroups.length})`}
        extra={
          <Tooltip title="Refresh node group status">
            <Button icon={<SyncOutlined />} size="small" onClick={() => window.location.reload()} />
          </Tooltip>
        }
      >
        <Table
          dataSource={nodeGroups}
          columns={nodeGroupColumns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      <Modal
        title={`Configure Node Group: ${editingGroup?.name}`}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSave}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Min Size" name="minSize" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Desired Size" name="desiredSize" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Max Size" name="maxSize" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Upgrade Order" name="upgradeOrder">
            <InputNumber min={1} placeholder="Leave empty for automatic" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Upgrade Strategy" name="upgradeStrategy">
            <Select>
              <Select.Option value="ROLLING">Rolling</Select.Option>
              <Select.Option value="BLUE_GREEN">Blue/Green</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
