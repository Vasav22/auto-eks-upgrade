import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const REFRESH_INTERVAL = 13 * 60 * 1000; // 13 minutes (before 15-min expiry)

export function useTokenRefresh() {
  const { isAuthenticated, refreshAuth } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isAuthenticated) {
      intervalRef.current = setInterval(() => {
        refreshAuth();
      }, REFRESH_INTERVAL);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isAuthenticated, refreshAuth]);
}
