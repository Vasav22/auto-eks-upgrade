import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Space,
  Typography,
  Spin,
  Alert,
  List,
  Tag,
  Collapse,
  Badge,
  Descriptions,
  Table,
  Divider,
  Input,
  Modal,
  Result,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

type CheckStatus = 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';

interface ReadinessCheck {
  name: string;
  description: string;
  status: CheckStatus;
  details?: string;
  remediation?: string;
  blocking: boolean;
}

interface DeprecatedApi {
  apiGroup: string;
  version: string;
  kind: string;
  replacementVersion?: string;
  removedInVersion?: string;
  removed: boolean;
  resourceCount: number;
  namespaces: string[];
}

interface DryRunReport {
  id: string;
  clusterId: string;
  targetVersion: string;
  generatedAt: string;
  overallStatus: 'READY' | 'NOT_READY' | 'WARNINGS';
  checks: ReadinessCheck[];
  deprecatedApis: DeprecatedApi[];
  blockers: string[];
  warnings: string[];
}

const CHECK_ICON: Record<CheckStatus, React.ReactNode> = {
  PASS: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  FAIL: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
  WARNING: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
  SKIPPED: <MinusCircleOutlined style={{ color: '#d9d9d9' }} />,
};

const OVERALL_COLOR: Record<string, 'success' | 'error' | 'warning'> = {
  READY: 'success',
  NOT_READY: 'error',
  WARNINGS: 'warning',
};

export default function DryRunReportPage() {
  const { clusterId } = useParams<{ clusterId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [targetVersion, setTargetVersion] = useState('');
  const [report, setReport] = useState<DryRunReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideModalVisible, setOverrideModalVisible] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overriding, setOverriding] = useState(false);

  const runDryRun = async () => {
    if (!clusterId || !targetVersion) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/clusters/${clusterId}/dryrun`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token ?? ''}`,
        },
        body: JSON.stringify({ targetVersion }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message ?? 'Dry-run failed');
      }
      const data: DryRunReport = await res.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const submitOverride = async () => {
    if (!clusterId || !overrideReason.trim()) return;
    try {
      setOverriding(true);
      await fetch(`/api/clusters/${clusterId}/dryrun/backup-override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token ?? ''}`,
        },
        body: JSON.stringify({ reason: overrideReason }),
      });
      setOverrideModalVisible(false);
    } finally {
      setOverriding(false);
    }
  };

  const deprecatedApiColumns = [
    {
      title: 'API Group / Version / Kind',
      key: 'api',
      render: (_: unknown, api: DeprecatedApi) => (
        <Space>
          <Tag>{api.apiGroup}</Tag>
          <Tag color={api.removed ? 'red' : 'orange'}>{api.version}</Tag>
          <Text>{api.kind}</Text>
        </Space>
      ),
    },
    {
      title: 'Removed In',
      dataIndex: 'removedInVersion',
      key: 'removedIn',
      render: (v: string) => <Tag color="red">{v}</Tag>,
    },
    {
      title: 'Replacement',
      dataIndex: 'replacementVersion',
      key: 'replacement',
      render: (v: string | undefined) =>
        v ? <Tag color="green">{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, api: DeprecatedApi) =>
        api.removed ? (
          <Tag color="red">REMOVED</Tag>
        ) : (
          <Tag color="orange">DEPRECATED</Tag>
        ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Space>

      <Title level={3}>Upgrade Readiness Check (Dry-Run)</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="Target version (e.g. 1.29)"
            value={targetVersion}
            onChange={(e) => setTargetVersion(e.target.value)}
            style={{ width: 200 }}
          />
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={loading}
            disabled={!targetVersion.trim()}
            onClick={runDryRun}
          >
            Run Dry-Run
          </Button>
        </Space>
      </Card>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />}

      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" tip="Running readiness checks…" />
        </div>
      )}

      {report && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Result
              status={OVERALL_COLOR[report.overallStatus]}
              title={
                report.overallStatus === 'READY'
                  ? 'Cluster is ready to upgrade'
                  : report.overallStatus === 'WARNINGS'
                    ? 'Upgrade possible with warnings'
                    : 'Cluster is NOT ready to upgrade'
              }
              subTitle={`Target: ${report.targetVersion} · Generated: ${new Date(report.generatedAt).toLocaleString()}`}
              extra={
                report.overallStatus !== 'READY' && (
                  <Button onClick={() => setOverrideModalVisible(true)}>
                    Record Backup Override
                  </Button>
                )
              }
            />

            {report.blockers.length > 0 && (
              <Alert
                type="error"
                showIcon
                message={`${report.blockers.length} blocker(s) must be resolved`}
                description={report.blockers.join(', ')}
                style={{ marginTop: 8 }}
              />
            )}
            {report.warnings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message={`${report.warnings.length} warning(s)`}
                description={report.warnings.join(', ')}
                style={{ marginTop: 8 }}
              />
            )}
          </Card>

          <Card title="Readiness Checks" style={{ marginBottom: 16 }}>
            <List
              dataSource={report.checks}
              renderItem={(check) => (
                <List.Item
                  key={check.name}
                  extra={
                    check.blocking && check.status === 'FAIL' ? (
                      <Tag color="red">BLOCKER</Tag>
                    ) : null
                  }
                >
                  <List.Item.Meta
                    avatar={CHECK_ICON[check.status]}
                    title={
                      <Space>
                        <Text>{check.description}</Text>
                        <Tag>{check.name}</Tag>
                      </Space>
                    }
                    description={
                      <>
                        {check.details && <Text type="secondary">{check.details}</Text>}
                        {check.remediation && (
                          <Text type="danger" style={{ display: 'block' }}>
                            Fix: {check.remediation}
                          </Text>
                        )}
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          {report.deprecatedApis.length > 0 && (
            <Card title="Deprecated / Removed APIs" style={{ marginBottom: 16 }}>
              <Table
                dataSource={report.deprecatedApis}
                columns={deprecatedApiColumns}
                rowKey={(r) => `${r.apiGroup}/${r.version}/${r.kind}`}
                pagination={false}
                size="small"
                rowClassName={(r) => (r.removed ? 'ant-table-row-danger' : '')}
              />
            </Card>
          )}
        </>
      )}

      <Modal
        title="Record Backup Override"
        open={overrideModalVisible}
        onCancel={() => setOverrideModalVisible(false)}
        onOk={submitOverride}
        confirmLoading={overriding}
        okButtonProps={{ disabled: !overrideReason.trim() }}
      >
        <Alert
          type="warning"
          showIcon
          message="Proceeding without a recent backup is risky"
          description="This override will be permanently recorded in the audit log."
          style={{ marginBottom: 16 }}
        />
        <Input.TextArea
          placeholder="Provide reason for overriding backup requirement…"
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          rows={4}
        />
      </Modal>
    </div>
  );
}
