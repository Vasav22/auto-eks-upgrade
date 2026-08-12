import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppLayout } from './components/AppLayout';

const SuspenseWrap = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div style={{ textAlign: 'center', padding: 48 }} />}>
    {children}
  </Suspense>
);

const FleetDashboard = lazy(() => import('./pages/FleetDashboard'));
const ClusterList = lazy(() => import('./pages/ClusterList'));
const ClusterDetail = lazy(() => import('./pages/ClusterDetail'));
const HealthDashboard = lazy(() => import('./pages/HealthDashboard'));
const CampaignDashboard = lazy(() => import('./pages/CampaignDashboard'));
const BackupRestoreManagement = lazy(() => import('./pages/BackupRestoreManagement'));
const AuditTrailViewer = lazy(() => import('./pages/AuditTrailViewer'));
const RemediationApprovalQueue = lazy(() => import('./pages/RemediationApprovalQueue'));
const DryRunReport = lazy(() => import('./pages/DryRunReport'));
const NodeGroupConfigPage = lazy(() => import('./pages/NodeGroupConfigPage'));
const UpgradeForm = lazy(() => import('./pages/UpgradeForm'));
const UpgradeProgressView = lazy(() => import('./pages/UpgradeProgressView'));
const UpgradeJobDetail = lazy(() => import('./pages/UpgradeJobDetail'));
const UpgradeJobs = lazy(() => import('./pages/UpgradeJobs'));
const SchedulingPage = lazy(() => import('./pages/SchedulingPage'));
const NotificationConfigPage = lazy(() => import('./pages/NotificationConfigPage'));
const Login = lazy(() => import('./pages/Login'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));
const NotFound = lazy(() => import('./pages/NotFound'));

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <SuspenseWrap><Login /></SuspenseWrap>,
  },
  {
    path: '/auth/callback',
    element: <SuspenseWrap><AuthCallback /></SuspenseWrap>,
  },
  {
    path: '/unauthorized',
    element: <SuspenseWrap><Unauthorized /></SuspenseWrap>,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <FleetDashboard />,
      },
      {
        path: 'clusters',
        element: <ClusterList />,
      },
      {
        path: 'clusters/:id',
        element: <ClusterDetail />,
      },
      {
        path: 'clusters/:clusterId/node-groups',
        element: <NodeGroupConfigPage />,
      },
      {
        path: 'clusters/:clusterId/health',
        element: <HealthDashboard />,
      },
      {
        path: 'clusters/:clusterId/upgrade',
        element: <UpgradeForm />,
      },
      {
        path: 'clusters/:clusterId/upgrade/dry-run',
        element: <DryRunReport />,
      },
      {
        path: 'upgrades/:upgradeJobId/progress',
        element: <UpgradeProgressView />,
      },
      {
        path: 'upgrades/:id',
        element: <UpgradeJobDetail />,
      },
      {
        path: 'health',
        element: <HealthDashboard />,
      },
      {
        path: 'upgrade-jobs',
        element: <SuspenseWrap><UpgradeJobs /></SuspenseWrap>,
      },
      {
        path: 'campaigns',
        element: <CampaignDashboard />,
      },
      {
        path: 'remediation',
        element: <RemediationApprovalQueue />,
      },
      {
        path: 'backups',
        element: <BackupRestoreManagement />,
      },
      {
        path: 'audit',
        element: <AuditTrailViewer />,
      },
      {
        path: 'scheduling',
        element: <SchedulingPage />,
      },
      {
        path: 'notifications',
        element: <NotificationConfigPage />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);
