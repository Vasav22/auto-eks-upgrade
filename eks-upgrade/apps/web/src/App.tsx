import { ConfigProvider } from 'antd';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { themeConfig } from './theme/antd-theme';

export default function App(): JSX.Element {
  return (
    <ConfigProvider theme={themeConfig} direction="ltr">
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}
