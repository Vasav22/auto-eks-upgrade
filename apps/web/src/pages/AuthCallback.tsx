import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, Result } from 'antd';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError(`Authentication failed: ${errorParam}`);
        return;
      }

      if (!code || !state) {
        setError('Missing authorization code or state');
        return;
      }

      try {
        const response = await fetch('/api/v1/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            code,
            state,
            code_verifier: sessionStorage.getItem('pkce_verifier') || '',
          }),
        });

        if (response.ok) {
          sessionStorage.removeItem('pkce_verifier');
          navigate('/');
        } else {
          const data = await response.json();
          setError(data.message || 'Authentication failed');
        }
      } catch (err) {
        setError('Network error during authentication');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Result
          status="error"
          title="Authentication Failed"
          subTitle={error}
          extra={<a href="/login">Try Again</a>}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Spin size="large" tip="Completing authentication..." />
    </div>
  );
}
