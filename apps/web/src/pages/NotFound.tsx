import { Result, Button } from 'antd';
import { Link } from 'react-router-dom';

export default function NotFound(): JSX.Element {
  return (
    <Result
      status="404"
      title="404"
      subTitle="Sorry, the page you visited does not exist."
      extra={
        <Button type="primary">
          <Link to="/">Back to Fleet Dashboard</Link>
        </Button>
      }
    />
  );
}
