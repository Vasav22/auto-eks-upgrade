import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, message } from 'antd';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { isAuthenticated, login, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const devLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: 'dev', state: 'dev' }),
      });
      if (res.ok) {
        await refreshAuth();
        navigate('/');
      } else {
        const data = await res.json();
        message.error(data.message || 'Login failed');
      }
    } catch {
      message.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const isDev = window.location.hostname !== 'production-host';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400, textAlign: 'center' }}>
        <h1>EKS Upgrade Control Plane</h1>
        <p>Sign in with your corporate identity provider</p>
        <Button type="primary" size="large" onClick={login} block style={{ marginBottom: 12 }}>
          Sign In with SSO
        </Button>
        {isDev && (
          <Button size="large" onClick={devLogin} loading={loading} block>
            Dev Login (bypass SSO)
          </Button>
        )}
      </Card>
    </div>
  );
}
