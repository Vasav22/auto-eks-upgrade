import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Table, Tag, Button, Space, Typography, Modal, Input, Badge,
  Alert, Spin, Tooltip, Popconfirm,
} from 'antd';
import {
  CheckOutlined, CloseOutlined, PlayCircleOutlined, ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface RemediationProposal {
  id: string;
  findingCategory: string;
  findingTitle: string;
  severity: string;
  proposedAction: string;
  description: string;
  riskLevel: string;
  requiresApproval: boolean;
  autoApproved: boolean;
  status: string;
  approverIds: string[];
  createdAt: string;
}

const RISK_COLOR: Record<string, string> = { LOW: 'green', MEDIUM: 'orange', HIGH: 'red', CRITICAL: 'red' };
const SEVERITY_COLOR: Record<string, string> = { critical: 'red', high: 'orange', warning: 'gold', info: 'blue' };

export default function RemediationApprovalQueue() {
  const { clusterId } = useParams<{ clusterId: string }>();
  const { user } = useAuth();

  const [proposals, setProposals] = useState<RemediationProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clusterId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/remediation/pending/${clusterId}`, {
        headers: { Authorization: `Bearer ${user?.token ?? ''}` },
      });
      if (!res.ok) throw new Error('Failed to load proposals');
      setProposals(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [clusterId, user?.token]);

  useEffect(() => { void load(); }, [load]);

  const handleApprove = async (proposalId: string) => {
    try {
      setProcessing(proposalId);
      const res = await fetch(`/api/remediation/${proposalId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token ?? ''}` },
      });
      if (!res.ok) throw new Error('Approve failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setProcessing(null);
    }
  };

  const openRejectModal = (proposalId: string) => {
    setRejectingId(proposalId);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    try {
      setProcessing(rejectingId);
      const res = await fetch(`/api/remediation/${rejectingId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token ?? ''}`,
        },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) throw new Error('Reject failed');
      setRejectModalVisible(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setProcessing(null);
    }
  };

  const handleExecute = async (proposalId: string) => {
    try {
      setProcessing(proposalId);
      const res = await fetch(`/api/remediation/${proposalId}/execute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token ?? ''}` },
      });
      if (!res.ok) throw new Error('Execute failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execute failed');
    } finally {
      setProcessing(null);
    }
  };

  const columns = [
    {
      title: 'Finding',
      key: 'finding',
      render: (_: unknown, p: RemediationProposal) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Tag color={SEVERITY_COLOR[p.severity] ?? 'default'}>{p.severity.toUpperCase()}</Tag>
            <Text strong>{p.findingTitle}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 11 }}>{p.description}</Text>
        </Space>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'proposedAction',
      key: 'action',
      render: (action: string) => <Tag color="blue">{action.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Risk',
      dataIndex: 'riskLevel',
      key: 'risk',
      render: (risk: string) => <Tag color={RISK_COLOR[risk] ?? 'default'}>{risk}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, p: RemediationProposal) => (
        <Space direction="vertical" size={0}>
          <Badge
            status={status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : 'processing'}
            text={status}
          />
          {p.requiresApproval && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {p.approverIds.length} / {['HIGH', 'CRITICAL'].includes(p.riskLevel) ? 2 : 1} approvals
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, p: RemediationProposal) => (
        <Space>
          {p.status === 'PENDING' && (
            <>
              <Tooltip title="Approve this remediation">
                <Button
                  size="small" type="primary" icon={<CheckOutlined />}
                  loading={processing === p.id}
                  onClick={() => handleApprove(p.id)}
                >
                  Approve
                </Button>
              </Tooltip>
              <Tooltip title="Reject this remediation">
                <Button
                  size="small" danger icon={<CloseOutlined />}
                  onClick={() => openRejectModal(p.id)}
                >
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
          {p.status === 'APPROVED' && (
            <Popconfirm
              title="Execute this remediation?"
              description="This action will be permanently recorded in the audit log."
              icon={<ExclamationCircleOutlined style={{ color: 'orange' }} />}
              onConfirm={() => handleExecute(p.id)}
            >
              <Button
                size="small" type="primary" danger icon={<PlayCircleOutlined />}
                loading={processing === p.id}
              >
                Execute
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>Remediation Approval Queue</Title>
        <Button icon={<ReloadOutlined />} onClick={load} />
      </Space>

      {error && <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      ) : (
        <Card>
          <Table dataSource={proposals} columns={columns} rowKey="id" pagination={{ pageSize: 20 }} />
        </Card>
      )}

      <Modal
        title="Reject Remediation"
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        onOk={handleReject}
        confirmLoading={!!processing}
        okButtonProps={{ danger: true, disabled: !rejectReason.trim() }}
      >
        <Alert type="warning" showIcon message="Rejection will be permanently recorded" style={{ marginBottom: 16 }} />
        <Input.TextArea
          placeholder="Provide reason for rejection…"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={4}
        />
      </Modal>
    </div>
  );
}
