import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from 'antd';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400, textAlign: 'center' }}>
        <h1>EKS Upgrade Control Plane</h1>
        <p>Sign in with your corporate identity provider</p>
        <Button type="primary" size="large" onClick={login} block>
          Sign In with SSO
        </Button>
      </Card>
    </div>
  );
}
