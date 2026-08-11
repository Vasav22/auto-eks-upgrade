import { Layout, Menu, Spin } from 'antd';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import {
  DashboardOutlined,
  ClusterOutlined,
  HeartOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  AuditOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content, Footer } = Layout;

export function AppLayout(): JSX.Element {
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">Fleet Dashboard</Link>,
    },
    {
      key: '/clusters',
      icon: <CloudServerOutlined />,
      label: <Link to="/clusters">Clusters</Link>,
    },
    {
      key: '/health',
      icon: <HeartOutlined />,
      label: <Link to="/health">Health Dashboard</Link>,
    },
    {
      key: '/campaigns',
      icon: <ThunderboltOutlined />,
      label: <Link to="/campaigns">Campaigns</Link>,
    },
    {
      key: '/backups',
      icon: <DatabaseOutlined />,
      label: <Link to="/backups">Backup Management</Link>,
    },
    {
      key: '/audit',
      icon: <AuditOutlined />,
      label: <Link to="/audit">Audit & Compliance</Link>,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Header
        role="banner"
        style={{
          display: 'flex',
          alignItems: 'center',
          color: 'white',
          padding: '0 24px',
        }}
      >
        <ClusterOutlined style={{ fontSize: 24, marginRight: 16 }} />
        <h1 style={{ color: 'white', margin: 0, fontSize: 20 }}>
          EKS Upgrade Control Plane
        </h1>
      </Header>
      <Layout>
        <Sider width={250} role="navigation" aria-label="Main navigation">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            id="main-content"
            role="main"
            style={{
              background: 'white',
              padding: 24,
              margin: 0,
              minHeight: 280,
            }}
          >
            <Suspense fallback={<div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>}>
              <Outlet />
            </Suspense>
          </Content>
          <Footer role="contentinfo" style={{ textAlign: 'center' }}>
            EKS Upgrade Control Plane ©2026
          </Footer>
        </Layout>
      </Layout>
    </Layout>
  );
}
