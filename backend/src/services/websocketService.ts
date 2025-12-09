/**
 * WebSocket Service
 * Manages real-time bidirectional communication for notifications and future features
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Notification } from '../types/notifications';

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(httpServer: HTTPServer): void {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
    path: '/socket.io/',
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.handshake.auth.userId;

    if (!userId) {
      console.log('WebSocket connection rejected: No userId in auth');
      socket.disconnect();
      return;
    }

    console.log(`WebSocket connected: User ${userId}`);

    // Join user-specific room for targeted notifications
    socket.join(`user:${userId}`);

    // Handle client events
    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('disconnect', () => {
      console.log(`WebSocket disconnected: User ${userId}`);
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Sim RQ notifications',
      userId,
    });
  });

  console.log('WebSocket service initialized');
}

/**
 * Send notification to a specific user in real-time
 */
export function notifyUser(userId: string, notification: Notification): void {
  if (!io) {
    console.warn('WebSocket not initialized, cannot send notification');
    return;
  }

  io.to(`user:${userId}`).emit('notification', notification);
}

/**
 * Send notification to multiple users
 */
export function notifyMultipleUsers(userIds: string[], notification: Notification): void {
  if (!io) {
    console.warn('WebSocket not initialized, cannot send notifications');
    return;
  }

  userIds.forEach(userId => {
    io!.to(`user:${userId}`).emit('notification', notification);
  });
}

/**
 * Broadcast to all connected clients (use sparingly)
 */
export function broadcast(event: string, data: any): void {
  if (!io) {
    console.warn('WebSocket not initialized, cannot broadcast');
    return;
  }

  io.emit(event, data);
}

/**
 * Get Socket.IO instance for advanced usage
 */
export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Get connected user count
 */
export function getConnectedUserCount(): number {
  if (!io) return 0;
  return io.sockets.sockets.size;
}
