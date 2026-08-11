import { Result } from 'antd';
import { AuditOutlined } from '@ant-design/icons';

export default function AuditCompliance(): JSX.Element {
  return (
    <Result
      icon={<AuditOutlined />}
      title="Audit & Compliance"
      subTitle="Immutable audit trail of all upgrade activities and compliance reporting"
    />
  );
}
