import { useEffect, useCallback } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

export interface WebSocketMessage {
  type: string;
  payload: unknown;
}

export interface UseUpgradeStreamOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
}

export interface UseUpgradeStreamReturn {
  sendMessage: (message: WebSocketMessage) => void;
  lastMessage: MessageEvent<string> | null;
  readyState: ReadyState;
  isConnected: boolean;
}

export function useUpgradeStream({
  url,
  onMessage,
}: UseUpgradeStreamOptions): UseUpgradeStreamReturn {
  const { sendJsonMessage, lastMessage, readyState } = useWebSocket(
    url || null,
    {
      reconnectAttempts: 3,
      reconnectInterval: 5000,
      shouldReconnect: () => true,
    },
    !!url,
  );

  const handleMessage = useCallback(
    (message: WebSocketMessage): void => {
      if (onMessage) {
        onMessage(message);
      }
    },
    [onMessage],
  );

  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const parsedMessage = JSON.parse(lastMessage.data) as WebSocketMessage;
        handleMessage(parsedMessage);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    }
  }, [lastMessage, handleMessage]);

  return {
    sendMessage: sendJsonMessage,
    lastMessage,
    readyState,
    isConnected: readyState === ReadyState.OPEN,
  };
}
