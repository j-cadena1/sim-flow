/**
 * Project Hours Service
 *
 * Handles all hour allocation, deallocation, and tracking for projects.
 * This service ensures:
 * - Atomic hour transactions with proper locking
 * - Complete audit trail in project_hour_transactions table
 * - Consistent hour balance across all operations
 */

import { PoolClient } from 'pg';
import { query, getClient } from '../db';
import { logger } from '../middleware/logger';
import { HourTransactionType } from '../types';

export interface HourTransactionParams {
  projectId: string;
  requestId?: string;
  transactionType: HourTransactionType;
  hours: number; // Positive for allocations, negative for deallocations
  performedById?: string;
  performedByName: string;
  notes?: string;
}

export interface HourTransactionResult {
  success: boolean;
  error?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  transactionId?: string;
  availableHours?: number;
}

/**
 * Record an hour transaction and update project used_hours atomically.
 * Uses row-level locking to prevent race conditions.
 */
export async function recordHourTransaction(
  params: HourTransactionParams,
  existingClient?: PoolClient
): Promise<HourTransactionResult> {
  const client = existingClient || await getClient();
  const shouldReleaseClient = !existingClient;

  try {
    if (!existingClient) {
      await client.query('BEGIN');
    }

    // Lock the project row for update
    const projectResult = await client.query(
      'SELECT id, total_hours, used_hours, status FROM projects WHERE id = $1 FOR UPDATE',
      [params.projectId]
    );

    if (projectResult.rows.length === 0) {
      if (!existingClient) await client.query('ROLLBACK');
      return { success: false, error: 'Project not found' };
    }

    const project = projectResult.rows[0];
    const balanceBefore = project.used_hours;
    const balanceAfter = balanceBefore + params.hours;

    // Validate the transaction
    if (balanceAfter > project.total_hours) {
      if (!existingClient) await client.query('ROLLBACK');
      return {
        success: false,
        error: `Insufficient hours. Available: ${project.total_hours - project.used_hours}, Requested: ${params.hours}`,
        availableHours: project.total_hours - project.used_hours
      };
    }

    if (balanceAfter < 0) {
      if (!existingClient) await client.query('ROLLBACK');
      return {
        success: false,
        error: `Cannot deallocate more hours than used. Currently used: ${project.used_hours}, Attempting to remove: ${Math.abs(params.hours)}`
      };
    }

    // For allocations, check that project is in an active state
    if (params.hours > 0 && !['Active', 'Approved'].includes(project.status)) {
      if (!existingClient) await client.query('ROLLBACK');
      return {
        success: false,
        error: `Cannot allocate hours to project with status '${project.status}'. Project must be Active.`
      };
    }

    // Record the transaction
    const transactionResult = await client.query(`
      INSERT INTO project_hour_transactions (
        project_id, request_id, transaction_type, hours,
        balance_before, balance_after, performed_by, performed_by_name, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      params.projectId,
      params.requestId || null,
      params.transactionType,
      params.hours,
      balanceBefore,
      balanceAfter,
      params.performedById || null,
      params.performedByName,
      params.notes || null
    ]);

    // Update the project's used_hours
    await client.query(
      'UPDATE projects SET used_hours = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [balanceAfter, params.projectId]
    );

    if (!existingClient) {
      await client.query('COMMIT');
    }

    logger.info(`Hour transaction recorded: Project ${params.projectId}, Type: ${params.transactionType}, Hours: ${params.hours >= 0 ? '+' : ''}${params.hours}, Balance: ${balanceBefore} → ${balanceAfter}`);

    return {
      success: true,
      balanceBefore,
      balanceAfter,
      transactionId: transactionResult.rows[0].id,
      availableHours: project.total_hours - balanceAfter
    };
  } catch (error) {
    if (!existingClient) {
      await client.query('ROLLBACK');
    }
    logger.error('Error recording hour transaction:', error);
    return { success: false, error: 'Failed to record hour transaction' };
  } finally {
    if (shouldReleaseClient) {
      client.release();
    }
  }
}

/**
 * Allocate hours from a project to a request.
 * Called when a request is assigned to an engineer.
 */
export async function allocateHoursToRequest(
  projectId: string,
  requestId: string,
  hours: number,
  performedById: string | undefined,
  performedByName: string,
  existingClient?: PoolClient
): Promise<HourTransactionResult> {
  if (hours <= 0) {
    return { success: false, error: 'Hours to allocate must be positive' };
  }

  return recordHourTransaction({
    projectId,
    requestId,
    transactionType: 'allocation',
    hours,
    performedById,
    performedByName,
    notes: `Hours allocated for request assignment`
  }, existingClient);
}

/**
 * Deallocate hours back to a project from a request.
 * Called when a request is denied, cancelled, or has hours reduced.
 */
export async function deallocateHoursFromRequest(
  projectId: string,
  requestId: string,
  hours: number,
  performedById: string | undefined,
  performedByName: string,
  reason: string,
  existingClient?: PoolClient
): Promise<HourTransactionResult> {
  if (hours <= 0) {
    return { success: false, error: 'Hours to deallocate must be positive' };
  }

  return recordHourTransaction({
    projectId,
    requestId,
    transactionType: 'deallocation',
    hours: -hours, // Negative because we're reducing used_hours
    performedById,
    performedByName,
    notes: reason
  }, existingClient);
}

/**
 * Adjust hours on a project (manual adjustment by manager).
 * Can be positive (adding hours) or negative (removing hours).
 */
export async function adjustProjectHours(
  projectId: string,
  hours: number,
  performedById: string | undefined,
  performedByName: string,
  reason: string
): Promise<HourTransactionResult> {
  return recordHourTransaction({
    projectId,
    transactionType: 'adjustment',
    hours,
    performedById,
    performedByName,
    notes: reason
  });
}

/**
 * Finalize hours when a request is completed.
 * This may adjust hours if actual time spent differs from allocated.
 */
export async function finalizeRequestHours(
  projectId: string,
  requestId: string,
  allocatedHours: number,
  actualHours: number,
  performedById: string | undefined,
  performedByName: string
): Promise<HourTransactionResult> {
  const hoursDifference = allocatedHours - actualHours;

  if (hoursDifference === 0) {
    // No adjustment needed
    return { success: true, balanceBefore: 0, balanceAfter: 0 };
  }

  return recordHourTransaction({
    projectId,
    requestId,
    transactionType: 'completion',
    hours: -hoursDifference, // Return excess hours (positive diff) or charge extra (negative diff)
    performedById,
    performedByName,
    notes: `Request completed. Allocated: ${allocatedHours}h, Actual: ${actualHours}h, ${hoursDifference > 0 ? 'Returned' : 'Additional'}: ${Math.abs(hoursDifference)}h`
  });
}

/**
 * Add additional hours to a project budget (extension).
 */
export async function extendProjectHours(
  projectId: string,
  additionalHours: number,
  performedById: string | undefined,
  performedByName: string,
  reason: string
): Promise<HourTransactionResult> {
  if (additionalHours <= 0) {
    return { success: false, error: 'Additional hours must be positive' };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // First, increase the total_hours
    const updateResult = await client.query(`
      UPDATE projects
      SET total_hours = total_hours + $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING total_hours, used_hours
    `, [additionalHours, projectId]);

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Project not found' };
    }

    // Record the extension transaction (doesn't change used_hours, just records the event)
    await client.query(`
      INSERT INTO project_hour_transactions (
        project_id, transaction_type, hours,
        balance_before, balance_after, performed_by, performed_by_name, notes
      )
      VALUES ($1, $2, $3, $4, $4, $5, $6, $7)
    `, [
      projectId,
      'extension',
      additionalHours,
      updateResult.rows[0].used_hours,
      performedById || null,
      performedByName,
      `Project budget extended by ${additionalHours}h. Reason: ${reason}`
    ]);

    await client.query('COMMIT');

    const newTotalHours = updateResult.rows[0].total_hours;
    const usedHours = updateResult.rows[0].used_hours;

    logger.info(`Project ${projectId} extended by ${additionalHours}h. New total: ${newTotalHours}h`);

    return {
      success: true,
      balanceBefore: usedHours,
      balanceAfter: usedHours,
      availableHours: newTotalHours - usedHours
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error extending project hours:', error);
    return { success: false, error: 'Failed to extend project hours' };
  } finally {
    client.release();
  }
}

/**
 * Get hour transaction history for a project.
 */
export async function getProjectHourHistory(projectId: string, limit = 50, offset = 0) {
  try {
    const result = await query(`
      SELECT
        pht.*,
        r.title as request_title
      FROM project_hour_transactions pht
      LEFT JOIN requests r ON pht.request_id = r.id
      WHERE pht.project_id = $1
      ORDER BY pht.created_at DESC
      LIMIT $2 OFFSET $3
    `, [projectId, limit, offset]);

    const countResult = await query(
      'SELECT COUNT(*) FROM project_hour_transactions WHERE project_id = $1',
      [projectId]
    );

    return {
      transactions: result.rows,
      total: parseInt(countResult.rows[0].count, 10)
    };
  } catch (error) {
    logger.error('Error fetching project hour history:', error);
    throw error;
  }
}

/**
 * Get the current allocated hours for a specific request from the project.
 */
export async function getRequestAllocatedHours(projectId: string, requestId: string): Promise<number> {
  try {
    const result = await query(`
      SELECT COALESCE(SUM(hours), 0) as allocated_hours
      FROM project_hour_transactions
      WHERE project_id = $1 AND request_id = $2
    `, [projectId, requestId]);

    return parseInt(result.rows[0].allocated_hours, 10);
  } catch (error) {
    logger.error('Error getting request allocated hours:', error);
    return 0;
  }
}

/**
 * Validate if a project has enough hours for an allocation.
 */
export async function validateHourAvailability(
  projectId: string,
  requestedHours: number
): Promise<{ available: boolean; currentAvailable: number; totalHours: number; usedHours: number }> {
  try {
    const result = await query(
      'SELECT total_hours, used_hours, status FROM projects WHERE id = $1',
      [projectId]
    );

    if (result.rows.length === 0) {
      return { available: false, currentAvailable: 0, totalHours: 0, usedHours: 0 };
    }

    const { total_hours, used_hours, status } = result.rows[0];
    const currentAvailable = total_hours - used_hours;

    return {
      available: currentAvailable >= requestedHours && ['Active', 'Approved'].includes(status),
      currentAvailable,
      totalHours: total_hours,
      usedHours: used_hours
    };
  } catch (error) {
    logger.error('Error validating hour availability:', error);
    return { available: false, currentAvailable: 0, totalHours: 0, usedHours: 0 };
  }
}
