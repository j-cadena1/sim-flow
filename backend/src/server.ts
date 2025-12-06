import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { apiLimiter } from './middleware/rateLimiter';
import { logger } from './middleware/logger';
import { addRequestId, errorHandler, notFoundHandler } from './middleware/errorHandler';
import { enforceSecureConfig } from './utils/configValidator';
import { cleanupExpiredSessions } from './services/sessionService';
import { recordHttpRequest, generatePrometheusMetrics } from './services/metricsService';
import { swaggerSpec } from './config/swagger';
import authRouter from './routes/auth';
import requestsRouter from './routes/requests';
import usersRouter from './routes/users';
import projectsRouter from './routes/projects';
import ssoRouter from './routes/sso';
import userManagementRouter from './routes/userManagement';
import auditLogsRouter from './routes/auditLogs';
import analyticsRouter from './routes/analytics';
import pool from './db';

// Load environment variables
dotenv.config();

// Validate security configuration before starting
// In production, this will exit if critical settings are missing or insecure
enforceSecureConfig();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Cookie parser for session cookies
app.use(cookieParser());

// General API rate limiting (auth endpoints have stricter limits applied in their routes)
app.use('/api/', apiLimiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request ID to all requests
app.use(addRequestId);

// Request logging and metrics
app.use((req, res, next) => {
  const startTime = Date.now();
  logger.info(`${req.method} ${req.path}`, { requestId: req.requestId });

  // Record metrics after response is sent
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    recordHttpRequest(req.method, req.path, res.statusCode, duration);
  });

  next();
});

// Health check - basic liveness probe
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Readiness check - verifies database connectivity
app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'ready',
      database: 'connected'
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected'
    });
  }
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await generatePrometheusMetrics();
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating metrics:', error);
    res.status(500).send('Error generating metrics');
  }
});

// Swagger API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Sim-Flow API Documentation',
}));

// OpenAPI spec as JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/users', usersRouter);
app.use('/api/users/management', userManagementRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/sso', ssoRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/analytics', analyticsRouter);

// 404 handler - must be before error handler
app.use(notFoundHandler);

// Centralized error handler - must be last
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Sim-Flow API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Schedule periodic cleanup of expired sessions (every hour)
  setInterval(async () => {
    try {
      await cleanupExpiredSessions();
    } catch (error) {
      logger.error('Error during session cleanup:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Run initial cleanup on startup
  cleanupExpiredSessions().catch((error) => {
    logger.error('Error during initial session cleanup:', error);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    logger.info('HTTP server closed');
    await pool.end();
    logger.info('Database pool closed');
    process.exit(0);
  });
});

export default app;
