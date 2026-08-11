import { Result } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';

export default function CampaignView(): JSX.Element {
  return (
    <Result
      icon={<ThunderboltOutlined />}
      title="Campaign Management"
      subTitle="Bulk upgrade campaigns for coordinated multi-cluster upgrades with eligibility screening"
    />
  );
}
