import { ConfigProvider } from 'antd';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { themeConfig } from './theme/antd-theme';
import { AuthProvider } from './contexts/AuthContext';

export default function App(): JSX.Element {
  return (
    <ConfigProvider theme={themeConfig} direction="ltr">
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ConfigProvider>
  );
}
