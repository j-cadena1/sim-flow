import { query } from '../db';
import { logger } from '../middleware/logger';

interface Metrics {
  // HTTP request metrics
  httpRequestsTotal: Map<string, number>;
  httpRequestDurationSeconds: Map<string, number[]>;

  // Application metrics
  activeUsers: number;
  totalRequests: number;
  requestsByStatus: Map<string, number>;

  // System metrics
  uptimeSeconds: number;
  nodeVersion: string;
}

// In-memory metrics storage
const metrics: Metrics = {
  httpRequestsTotal: new Map(),
  httpRequestDurationSeconds: new Map(),
  activeUsers: 0,
  totalRequests: 0,
  requestsByStatus: new Map(),
  uptimeSeconds: 0,
  nodeVersion: process.version,
};

const startTime = Date.now();

/**
 * Record an HTTP request
 */
export function recordHttpRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number
): void {
  // Normalize path to avoid high cardinality
  const normalizedPath = normalizePath(path);
  const key = `${method}:${normalizedPath}:${statusCode}`;

  // Increment request counter
  const current = metrics.httpRequestsTotal.get(key) || 0;
  metrics.httpRequestsTotal.set(key, current + 1);

  // Record duration
  const durations = metrics.httpRequestDurationSeconds.get(key) || [];
  durations.push(durationMs / 1000);
  // Keep only last 1000 samples per endpoint
  if (durations.length > 1000) durations.shift();
  metrics.httpRequestDurationSeconds.set(key, durations);
}

/**
 * Normalize URL paths to reduce cardinality
 */
function normalizePath(path: string): string {
  // Replace UUIDs with placeholder
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Replace numeric IDs with placeholder
    .replace(/\/\d+/g, '/:id')
    // Remove query strings
    .split('?')[0];
}

/**
 * Get database metrics
 */
async function getDatabaseMetrics(): Promise<{
  activeConnections: number;
  totalUsers: number;
  totalSimRequests: number;
  requestsByStatus: Record<string, number>;
}> {
  try {
    // Get user count
    const usersResult = await query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(usersResult.rows[0].count, 10);

    // Get request counts by status
    const requestsResult = await query(
      'SELECT status, COUNT(*) as count FROM requests GROUP BY status'
    );
    const requestsByStatus: Record<string, number> = {};
    let totalSimRequests = 0;
    for (const row of requestsResult.rows) {
      requestsByStatus[row.status] = parseInt(row.count, 10);
      totalSimRequests += parseInt(row.count, 10);
    }

    // Get active refresh tokens as proxy for active sessions
    const sessionsResult = await query(
      'SELECT COUNT(*) as count FROM refresh_tokens WHERE revoked_at IS NULL AND expires_at > NOW()'
    );
    const activeConnections = parseInt(sessionsResult.rows[0].count, 10);

    return {
      activeConnections,
      totalUsers,
      totalSimRequests,
      requestsByStatus,
    };
  } catch (error) {
    logger.error('Error fetching database metrics:', error);
    return {
      activeConnections: 0,
      totalUsers: 0,
      totalSimRequests: 0,
      requestsByStatus: {},
    };
  }
}

/**
 * Calculate histogram percentiles
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Generate Prometheus-format metrics output
 */
export async function generatePrometheusMetrics(): Promise<string> {
  const dbMetrics = await getDatabaseMetrics();
  const uptimeSeconds = (Date.now() - startTime) / 1000;

  const lines: string[] = [];

  // Add header
  lines.push('# Sim-Flow Application Metrics');
  lines.push('');

  // Node.js info
  lines.push('# HELP nodejs_version_info Node.js version info');
  lines.push('# TYPE nodejs_version_info gauge');
  lines.push(`nodejs_version_info{version="${process.version}"} 1`);
  lines.push('');

  // Process uptime
  lines.push('# HELP process_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${uptimeSeconds.toFixed(2)}`);
  lines.push('');

  // Memory usage
  const memUsage = process.memoryUsage();
  lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes');
  lines.push('# TYPE process_resident_memory_bytes gauge');
  lines.push(`process_resident_memory_bytes ${memUsage.rss}`);
  lines.push('');

  lines.push('# HELP process_heap_bytes Heap memory size in bytes');
  lines.push('# TYPE process_heap_bytes gauge');
  lines.push(`process_heap_bytes{type="used"} ${memUsage.heapUsed}`);
  lines.push(`process_heap_bytes{type="total"} ${memUsage.heapTotal}`);
  lines.push('');

  // HTTP request totals
  lines.push('# HELP http_requests_total Total number of HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  for (const [key, count] of metrics.httpRequestsTotal) {
    const [method, path, status] = key.split(':');
    lines.push(`http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`);
  }
  lines.push('');

  // HTTP request duration histogram
  lines.push('# HELP http_request_duration_seconds HTTP request latency in seconds');
  lines.push('# TYPE http_request_duration_seconds summary');
  for (const [key, durations] of metrics.httpRequestDurationSeconds) {
    if (durations.length === 0) continue;
    const [method, path] = key.split(':');
    const p50 = calculatePercentile(durations, 50);
    const p90 = calculatePercentile(durations, 90);
    const p99 = calculatePercentile(durations, 99);
    lines.push(`http_request_duration_seconds{method="${method}",path="${path}",quantile="0.5"} ${p50.toFixed(6)}`);
    lines.push(`http_request_duration_seconds{method="${method}",path="${path}",quantile="0.9"} ${p90.toFixed(6)}`);
    lines.push(`http_request_duration_seconds{method="${method}",path="${path}",quantile="0.99"} ${p99.toFixed(6)}`);
  }
  lines.push('');

  // Application metrics
  lines.push('# HELP simflow_active_sessions Number of active user sessions');
  lines.push('# TYPE simflow_active_sessions gauge');
  lines.push(`simflow_active_sessions ${dbMetrics.activeConnections}`);
  lines.push('');

  lines.push('# HELP simflow_users_total Total number of users');
  lines.push('# TYPE simflow_users_total gauge');
  lines.push(`simflow_users_total ${dbMetrics.totalUsers}`);
  lines.push('');

  lines.push('# HELP simflow_requests_total Total number of simulation requests');
  lines.push('# TYPE simflow_requests_total gauge');
  lines.push(`simflow_requests_total ${dbMetrics.totalSimRequests}`);
  lines.push('');

  lines.push('# HELP simflow_requests_by_status Simulation requests by status');
  lines.push('# TYPE simflow_requests_by_status gauge');
  for (const [status, count] of Object.entries(dbMetrics.requestsByStatus)) {
    lines.push(`simflow_requests_by_status{status="${status}"} ${count}`);
  }

  return lines.join('\n');
}
