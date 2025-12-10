/**
 * WebSocket Service
 * Manages real-time bidirectional communication for notifications and future features
 *
 * If Redis is available, uses the Redis adapter for multi-instance deployments.
 * This allows notifications to be delivered to users regardless of which
 * backend instance they're connected to.
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import * as cookie from 'cookie';
import { Notification } from '../types/notifications';
import { SESSION_COOKIE_NAME } from '../config/session';
import { validateSession } from './sessionService';
import { createPubSubClients, isRedisConnected } from './redisService';
import { logger } from '../middleware/logger';

let io: SocketIOServer | null = null;
let pubClient: ReturnType<typeof createPubSubClients> extends infer T
  ? T extends { pubClient: infer P } ? P : null
  : null = null;
let subClient: ReturnType<typeof createPubSubClients> extends infer T
  ? T extends { subClient: infer S } ? S : null
  : null = null;

/**
 * Initialize WebSocket server
 * Uses Redis adapter if Redis is available for multi-instance support
 */
export async function initializeWebSocket(httpServer: HTTPServer): Promise<void> {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
    path: '/socket.io/',
  });

  // Attach Redis adapter if Redis is connected
  if (isRedisConnected()) {
    const clients = createPubSubClients();
    if (clients) {
      try {
        pubClient = clients.pubClient;
        subClient = clients.subClient;

        // Register error handlers before connecting
        pubClient.on('error', (err) => {
          logger.error('WebSocket Redis pub client error:', err);
        });
        subClient.on('error', (err) => {
          logger.error('WebSocket Redis sub client error:', err);
        });

        await Promise.all([pubClient.connect(), subClient.connect()]);

        io.adapter(createAdapter(pubClient, subClient));
        logger.info('WebSocket: Using Redis adapter for multi-instance support');
      } catch (error) {
        logger.warn('WebSocket: Failed to connect Redis adapter, using in-memory:', error);
        // Clean up partially connected clients
        if (pubClient) {
          await pubClient.quit().catch(() => {});
        }
        if (subClient) {
          await subClient.quit().catch(() => {});
        }
        pubClient = null;
        subClient = null;
      }
    }
  } else {
    logger.info('WebSocket: Using in-memory adapter (single instance only)');
  }

  io.on('connection', async (socket: Socket) => {
    // Parse session cookie from the handshake headers (not client-provided auth)
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) {
      logger.warn('WebSocket connection rejected: No cookies in handshake');
      socket.disconnect();
      return;
    }

    const cookies = cookie.parse(cookieHeader);
    const sessionId = cookies[SESSION_COOKIE_NAME];

    if (!sessionId) {
      logger.warn('WebSocket connection rejected: No session cookie');
      socket.disconnect();
      return;
    }

    // Validate session against database - this is the critical security check
    const user = await validateSession(sessionId);
    if (!user) {
      logger.warn('WebSocket connection rejected: Invalid or expired session');
      socket.disconnect();
      return;
    }

    const userId = user.userId;
    logger.info(`WebSocket connected: User ${userId}`);

    // Join user-specific room for targeted notifications
    socket.join(`user:${userId}`);

    // Handle client events
    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('disconnect', () => {
      logger.info(`WebSocket disconnected: User ${userId}`);
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Sim RQ notifications',
      userId,
    });
  });

  logger.info('WebSocket service initialized');
}

/**
 * Send notification to a specific user in real-time
 */
export function notifyUser(userId: string, notification: Notification): void {
  if (!io) {
    logger.warn('WebSocket not initialized, cannot send notification');
    return;
  }

  io.to(`user:${userId}`).emit('notification', notification);
}

/**
 * Send notification to multiple users
 */
export function notifyMultipleUsers(userIds: string[], notification: Notification): void {
  if (!io) {
    logger.warn('WebSocket not initialized, cannot send notifications');
    return;
  }

  userIds.forEach(userId => {
    io!.to(`user:${userId}`).emit('notification', notification);
  });
}

/**
 * Broadcast to all connected clients (use sparingly)
 */
export function broadcast(event: string, data: Record<string, unknown>): void {
  if (!io) {
    logger.warn('WebSocket not initialized, cannot broadcast');
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

/**
 * Gracefully shutdown WebSocket server and Redis pub/sub clients
 */
export async function shutdownWebSocket(): Promise<void> {
  // Close Redis pub/sub clients
  const closePromises: Promise<void>[] = [];

  if (pubClient) {
    closePromises.push(
      pubClient.quit().then(() => {
        logger.info('WebSocket Redis pub client closed');
      }).catch((err) => {
        logger.error('Error closing WebSocket Redis pub client:', err);
      })
    );
  }

  if (subClient) {
    closePromises.push(
      subClient.quit().then(() => {
        logger.info('WebSocket Redis sub client closed');
      }).catch((err) => {
        logger.error('Error closing WebSocket Redis sub client:', err);
      })
    );
  }

  await Promise.allSettled(closePromises);

  // Close Socket.IO server
  if (io) {
    io.close();
    logger.info('WebSocket server closed');
  }

  pubClient = null;
  subClient = null;
  io = null;
}
