/**
 * WebSocket Hook for Real-time Notifications
 *
 * Manages Socket.IO connection and provides real-time notification delivery
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Notification } from '../types';

interface UseWebSocketProps {
  userId?: string;
  onNotification?: (notification: Notification) => void;
  enabled?: boolean;
}

export function useWebSocket({ userId, onNotification, enabled = true }: UseWebSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  // State to trigger re-renders when socket connects/disconnects
  const [connectedSocket, setConnectedSocket] = useState<Socket | null>(null);

  const connect = useCallback(() => {
    if (!userId || !enabled || socketRef.current?.connected) {
      return;
    }

    // Use same origin for WebSocket connection (nginx proxies to backend)
    const wsUrl = window.location.origin;

    console.log('[WebSocket] Connecting to:', wsUrl);

    const socket = io(wsUrl, {
      auth: {
        userId,
      },
      transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('[WebSocket] Connected successfully');
      reconnectAttempts.current = 0;
      // Update state to trigger re-renders in components using this hook
      setConnectedSocket(socket);
    });

    socket.on('notification', (notification: Notification) => {
      console.log('[WebSocket] Received notification:', notification);
      onNotification?.(notification);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      // Clear state to trigger re-renders
      setConnectedSocket(null);
    });

    socket.on('connect_error', (error) => {
      reconnectAttempts.current++;
      console.error('[WebSocket] Connection error:', error.message);

      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached');
        socket.close();
      }
    });

    socketRef.current = socket;
  }, [userId, onNotification, enabled]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[WebSocket] Disconnecting');
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnectedSocket(null);
    }
  }, []);

  useEffect(() => {
    if (enabled && userId) {
      // Small delay to let Vite's proxy fully initialize during hot reload
      const timeoutId = setTimeout(connect, 100);
      return () => {
        clearTimeout(timeoutId);
        disconnect();
      };
    }

    return () => {
      disconnect();
    };
  }, [userId, enabled, connect, disconnect]);

  return {
    /** The Socket.IO socket instance, can be used to listen for custom events */
    socket: connectedSocket,
    isConnected: connectedSocket?.connected ?? false,
    reconnect: connect,
    disconnect,
  };
}

/** Type export for socket instance */
export type { Socket };
