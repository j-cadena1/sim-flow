import { Request, Response } from 'express';
import { getAuditLogs, getAuditLogCount } from '../services/auditService';
import { logger } from '../middleware/logger';

interface AuditLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Get audit logs with filtering and pagination
 * Admin only
 */
export const getAuditLogsController = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      action,
      entityType,
      entityId,
      startDate,
      endDate,
      limit = '100',
      offset = '0',
    } = req.query;

    const filters: AuditLogFilters = {};

    if (userId) filters.userId = userId as string;
    if (action) filters.action = action as string;
    if (entityType) filters.entityType = entityType as string;
    if (entityId) filters.entityId = parseInt(entityId as string);
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (limit) filters.limit = parseInt(limit as string);
    if (offset) filters.offset = parseInt(offset as string);

    const [logs, total] = await Promise.all([
      getAuditLogs(filters),
      getAuditLogCount(filters),
    ]);

    res.json({
      logs,
      pagination: {
        total,
        limit: filters.limit || 100,
        offset: filters.offset || 0,
        hasMore: (filters.offset || 0) + (filters.limit || 100) < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

/**
 * Export audit logs to CSV
 * Admin only
 */
export const exportAuditLogsCSV = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      action,
      entityType,
      entityId,
      startDate,
      endDate,
    } = req.query;

    const filters: AuditLogFilters = {};

    if (userId) filters.userId = userId as string;
    if (action) filters.action = action as string;
    if (entityType) filters.entityType = entityType as string;
    if (entityId) filters.entityId = parseInt(entityId as string);
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    // Limit export to prevent excessive memory usage and DoS
    const MAX_CSV_RECORDS = 10000;
    filters.limit = MAX_CSV_RECORDS;

    const logs = await getAuditLogs(filters);

    // Generate CSV
    const headers = [
      'ID',
      'Timestamp',
      'User Email',
      'User Name',
      'Action',
      'Entity Type',
      'Entity ID',
      'IP Address',
      'User Agent',
      'Details',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.timestamp,
      log.user_email,
      log.user_name,
      log.action,
      log.entity_type,
      log.entity_id || '',
      log.ip_address || '',
      log.user_agent || '',
      log.details ? JSON.stringify(log.details) : '',
    ]);

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => {
          // Escape quotes and wrap in quotes if contains comma
          const cellStr = String(cell).replace(/"/g, '""');
          return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')
            ? `"${cellStr}"`
            : cellStr;
        }).join(',')
      ),
    ].join('\n');

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    logger.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
};

/**
 * Get audit log statistics
 * Admin only
 */
export const getAuditStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const filters: AuditLogFilters = {};
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    // Get all logs for stats
    const logs = await getAuditLogs(filters);

    // Calculate statistics
    const stats = {
      totalEvents: logs.length,
      eventsByAction: {} as Record<string, number>,
      eventsByEntityType: {} as Record<string, number>,
      topUsers: [] as Array<{ email: string; name: string; count: number }>,
      recentEvents: logs.slice(0, 10), // Latest 10 events
    };

    // Group by action
    logs.forEach((log) => {
      stats.eventsByAction[log.action] = (stats.eventsByAction[log.action] || 0) + 1;
      stats.eventsByEntityType[log.entity_type] =
        (stats.eventsByEntityType[log.entity_type] || 0) + 1;
    });

    // Calculate top users
    const userCounts: Record<string, { name: string; count: number }> = {};
    logs.forEach((log) => {
      if (!userCounts[log.user_email]) {
        userCounts[log.user_email] = { name: log.user_name, count: 0 };
      }
      userCounts[log.user_email].count++;
    });

    stats.topUsers = Object.entries(userCounts)
      .map(([email, data]) => ({ email, name: data.name, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 users

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching audit stats:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
};
