import { useEffect, useRef, useState, useCallback } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

interface WebSocketOptions {
  url: string;
  onMessage: (event: MessageEvent) => void;
  onReconnect?: () => void;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
}

export function useWebSocketReconnect({
  url,
  onMessage,
  onReconnect,
  maxReconnectAttempts = 10,
  reconnectInterval = 3000,
}: WebSocketOptions) {
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [missedMessages, setMissedMessages] = useState<any[]>([]);
  const reconnectCount = useRef(0);

  const { sendJsonMessage, lastMessage, readyState } = useWebSocket(url, {
    onOpen: () => {
      console.log('WebSocket connected');
      reconnectCount.current = 0;

      // Request gap fill if we were previously connected
      if (lastMessageId) {
        sendJsonMessage({
          type: 'REQUEST_GAP_FILL',
          lastMessageId,
        });
      }

      onReconnect?.();
    },
    onClose: () => {
      console.log('WebSocket closed');
    },
    onError: (event) => {
      console.error('WebSocket error:', event);
    },
    shouldReconnect: () => {
      if (reconnectCount.current < maxReconnectAttempts) {
        reconnectCount.current++;
        return true;
      }
      return false;
    },
    reconnectInterval,
    reconnectAttempts: maxReconnectAttempts,
  });

  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const data = JSON.parse(lastMessage.data);

        // Handle gap fill response
        if (data.type === 'GAP_FILL') {
          setMissedMessages(data.messages || []);
          // Process missed messages
          data.messages?.forEach((msg: any) => {
            const syntheticEvent = new MessageEvent('message', {
              data: JSON.stringify(msg),
            });
            onMessage(syntheticEvent);
          });
          return;
        }

        // Track message ID for gap detection
        if (data.messageId) {
          setLastMessageId(data.messageId);
        }

        onMessage(lastMessage);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        onMessage(lastMessage);
      }
    }
  }, [lastMessage, onMessage]);

  const connectionStatus = {
    [ReadyState.CONNECTING]: 'Connecting',
    [ReadyState.OPEN]: 'Connected',
    [ReadyState.CLOSING]: 'Closing',
    [ReadyState.CLOSED]: 'Disconnected',
    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
  }[readyState];

  return {
    sendMessage: sendJsonMessage,
    readyState,
    connectionStatus,
    reconnectCount: reconnectCount.current,
    missedMessagesCount: missedMessages.length,
  };
}
