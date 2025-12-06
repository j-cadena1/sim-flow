/**
 * Project Lifecycle Service
 *
 * Manages project state transitions, validation rules, and lifecycle events.
 * Implements a state machine pattern for project statuses.
 */

import { PoolClient } from 'pg';
import { query, getClient } from '../db';
import { logger } from '../middleware/logger';
import { ProjectStatus } from '../types';

/**
 * Valid state transitions for projects.
 * Key = current state, Value = array of valid target states
 */
export const VALID_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  'Pending': ['Active', 'Cancelled', 'Archived'],
  'Approved': ['Active', 'On Hold', 'Suspended', 'Completed', 'Cancelled', 'Archived'], // Legacy
  'Active': ['On Hold', 'Suspended', 'Completed', 'Cancelled', 'Expired', 'Archived'],
  'On Hold': ['Active', 'Suspended', 'Cancelled', 'Archived'],
  'Suspended': ['Active', 'On Hold', 'Cancelled', 'Archived'],
  'Completed': ['Archived'],
  'Cancelled': ['Archived'],
  'Expired': ['Active', 'Archived'], // Can reactivate expired projects
  'Archived': [], // Terminal state - no transitions out
};

/**
 * States that require a reason when transitioning to them
 */
export const REQUIRES_REASON: ProjectStatus[] = [
  'On Hold',
  'Suspended',
  'Cancelled',
  'Expired',
];

/**
 * States that are considered "active" (can have hours allocated)
 */
export const ACTIVE_STATES: ProjectStatus[] = ['Active', 'Approved'];

/**
 * States that are considered "terminal" (project is finished)
 */
export const TERMINAL_STATES: ProjectStatus[] = ['Completed', 'Cancelled', 'Expired', 'Archived'];

/**
 * States that allow new requests to be created
 */
export const ALLOWS_NEW_REQUESTS: ProjectStatus[] = ['Active', 'Approved'];

export interface TransitionResult {
  success: boolean;
  error?: string;
  project?: any;
  historyId?: string;
}

export interface TransitionParams {
  projectId: string;
  toStatus: ProjectStatus;
  reason?: string;
  changedById?: string;
  changedByName: string;
  completionNotes?: string;
  cancellationReason?: string;
}

/**
 * Validate if a state transition is allowed
 */
export function isValidTransition(fromStatus: ProjectStatus, toStatus: ProjectStatus): boolean {
  const validTargets = VALID_TRANSITIONS[fromStatus];
  return validTargets?.includes(toStatus) ?? false;
}

/**
 * Check if a status requires a reason
 */
export function requiresReason(status: ProjectStatus): boolean {
  return REQUIRES_REASON.includes(status);
}

/**
 * Check if a project status allows hour allocation
 */
export function canAllocateHours(status: ProjectStatus): boolean {
  return ACTIVE_STATES.includes(status);
}

/**
 * Check if a project status allows new requests
 */
export function canCreateRequests(status: ProjectStatus): boolean {
  return ALLOWS_NEW_REQUESTS.includes(status);
}

/**
 * Check if a project status is terminal
 */
export function isTerminalStatus(status: ProjectStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

/**
 * Get list of valid next states from current state
 */
export function getValidNextStates(currentStatus: ProjectStatus): ProjectStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Transition a project to a new status with full validation and history tracking.
 */
export async function transitionProjectStatus(
  params: TransitionParams,
  existingClient?: PoolClient
): Promise<TransitionResult> {
  const client = existingClient || await getClient();
  const shouldReleaseClient = !existingClient;

  try {
    if (!existingClient) {
      await client.query('BEGIN');
    }

    // Get current project state with lock
    const projectResult = await client.query(
      'SELECT * FROM projects WHERE id = $1 FOR UPDATE',
      [params.projectId]
    );

    if (projectResult.rows.length === 0) {
      if (!existingClient) await client.query('ROLLBACK');
      return { success: false, error: 'Project not found' };
    }

    const project = projectResult.rows[0];
    const fromStatus = project.status as ProjectStatus;

    // Validate transition
    if (!isValidTransition(fromStatus, params.toStatus)) {
      if (!existingClient) await client.query('ROLLBACK');
      return {
        success: false,
        error: `Invalid transition from '${fromStatus}' to '${params.toStatus}'. Valid transitions: ${getValidNextStates(fromStatus).join(', ') || 'none'}`
      };
    }

    // Check if reason is required
    if (requiresReason(params.toStatus) && !params.reason) {
      if (!existingClient) await client.query('ROLLBACK');
      return {
        success: false,
        error: `Transition to '${params.toStatus}' requires a reason`
      };
    }

    // Build update query based on target status
    let updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const updateParams: any[] = [params.toStatus];
    let paramIndex = 2;

    // Handle specific status transitions
    if (params.toStatus === 'Completed') {
      updateFields.push(`completed_at = CURRENT_TIMESTAMP`);
      if (params.completionNotes) {
        updateFields.push(`completion_notes = $${paramIndex}`);
        updateParams.push(params.completionNotes);
        paramIndex++;
      }
    }

    if (params.toStatus === 'Cancelled') {
      updateFields.push(`cancelled_at = CURRENT_TIMESTAMP`);
      if (params.cancellationReason || params.reason) {
        updateFields.push(`cancellation_reason = $${paramIndex}`);
        updateParams.push(params.cancellationReason || params.reason);
        paramIndex++;
      }
    }

    // Add project ID as last param
    updateParams.push(params.projectId);

    // Update the project
    const updateResult = await client.query(
      `UPDATE projects SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      updateParams
    );

    // Record status history
    const historyResult = await client.query(`
      INSERT INTO project_status_history (
        project_id, from_status, to_status, changed_by, changed_by_name, reason
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      params.projectId,
      fromStatus,
      params.toStatus,
      params.changedById || null,
      params.changedByName,
      params.reason || null
    ]);

    if (!existingClient) {
      await client.query('COMMIT');
    }

    logger.info(`Project ${params.projectId} transitioned from '${fromStatus}' to '${params.toStatus}' by ${params.changedByName}`);

    return {
      success: true,
      project: updateResult.rows[0],
      historyId: historyResult.rows[0].id
    };
  } catch (error) {
    if (!existingClient) {
      await client.query('ROLLBACK');
    }
    logger.error('Error transitioning project status:', error);
    return { success: false, error: 'Failed to transition project status' };
  } finally {
    if (shouldReleaseClient) {
      client.release();
    }
  }
}

/**
 * Get the status history for a project
 */
export async function getProjectStatusHistory(
  projectId: string,
  limit = 50,
  offset = 0
) {
  try {
    const result = await query(`
      SELECT *
      FROM project_status_history
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [projectId, limit, offset]);

    const countResult = await query(
      'SELECT COUNT(*) FROM project_status_history WHERE project_id = $1',
      [projectId]
    );

    return {
      history: result.rows,
      total: parseInt(countResult.rows[0].count, 10)
    };
  } catch (error) {
    logger.error('Error fetching project status history:', error);
    throw error;
  }
}

/**
 * Check and update expired projects.
 * Projects past their deadline that are still Active become Expired.
 */
export async function checkAndExpireProjects(): Promise<{ expired: number; projects: string[] }> {
  try {
    // Find projects that should be expired
    const result = await query(`
      UPDATE projects
      SET status = 'Expired', updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('Active', 'Approved', 'On Hold')
        AND deadline IS NOT NULL
        AND deadline < CURRENT_DATE
      RETURNING id, name, code
    `);

    const expiredProjects = result.rows;

    // Log history for each expired project
    for (const project of expiredProjects) {
      await query(`
        INSERT INTO project_status_history (
          project_id, from_status, to_status, changed_by_name, reason
        )
        SELECT
          id,
          status,
          'Expired',
          'System',
          'Project deadline has passed'
        FROM projects WHERE id = $1
      `, [project.id]);

      logger.info(`Project ${project.code} (${project.name}) automatically expired due to deadline`);
    }

    return {
      expired: expiredProjects.length,
      projects: expiredProjects.map(p => p.code)
    };
  } catch (error) {
    logger.error('Error checking/expiring projects:', error);
    return { expired: 0, projects: [] };
  }
}

/**
 * Get projects that are approaching their deadline
 */
export async function getProjectsNearDeadline(daysAhead = 7) {
  try {
    const result = await query(`
      SELECT
        p.*,
        (deadline - CURRENT_DATE) as days_until_deadline
      FROM projects p
      WHERE status IN ('Active', 'Approved', 'On Hold')
        AND deadline IS NOT NULL
        AND deadline <= CURRENT_DATE + $1::INTEGER
        AND deadline >= CURRENT_DATE
      ORDER BY deadline ASC
    `, [daysAhead]);

    return result.rows;
  } catch (error) {
    logger.error('Error fetching projects near deadline:', error);
    return [];
  }
}

/**
 * Validate if a project can accept new requests
 */
export async function canProjectAcceptRequests(projectId: string): Promise<{
  canAccept: boolean;
  reason?: string;
  availableHours?: number;
}> {
  try {
    const result = await query(
      'SELECT status, total_hours, used_hours, deadline FROM projects WHERE id = $1',
      [projectId]
    );

    if (result.rows.length === 0) {
      return { canAccept: false, reason: 'Project not found' };
    }

    const project = result.rows[0];
    const status = project.status as ProjectStatus;

    if (!canCreateRequests(status)) {
      return {
        canAccept: false,
        reason: `Project is in '${status}' status and cannot accept new requests`
      };
    }

    const availableHours = project.total_hours - project.used_hours;
    if (availableHours <= 0) {
      return {
        canAccept: false,
        reason: 'Project has no available hours',
        availableHours: 0
      };
    }

    if (project.deadline && new Date(project.deadline) < new Date()) {
      return {
        canAccept: false,
        reason: 'Project deadline has passed',
        availableHours
      };
    }

    return { canAccept: true, availableHours };
  } catch (error) {
    logger.error('Error checking if project can accept requests:', error);
    return { canAccept: false, reason: 'Error checking project status' };
  }
}
