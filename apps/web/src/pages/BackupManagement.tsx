import { Result } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';

export default function BackupManagement(): JSX.Element {
  return (
    <Result
      icon={<DatabaseOutlined />}
      title="Backup Management"
      subTitle="Velero backup policies, restore workflows, and backup verification status"
    />
  );
}
