/**
 * @fileoverview Project Controller
 *
 * Handles project management including CRUD operations, hour budgets,
 * lifecycle status transitions, and health metrics.
 *
 * Project Lifecycle States:
 * - Pending: Awaiting approval
 * - Approved/Active: Can accept requests
 * - On Hold: Temporarily paused
 * - Suspended: Blocked due to issues
 * - Completed: All work finished
 * - Cancelled: Terminated before completion
 * - Expired: Past deadline
 * - Archived: Historical record
 *
 * Hour Management:
 * - total_hours: Budget allocated to project
 * - used_hours: Hours currently allocated to requests
 * - available = total_hours - used_hours
 *
 * @module controllers/projectsController
 */

import { Request, Response } from 'express';
import { query, getClient } from '../db';
import { logger } from '../middleware/logger';
import { toCamelCase } from '../utils/caseConverter';
import { logRequestAudit, AuditAction, EntityType } from '../services/auditService';
import {
  getProjectHourHistory,
  extendProjectHours,
  adjustProjectHours,
} from '../services/projectHoursService';
import {
  transitionProjectStatus,
  getProjectStatusHistory,
  getValidNextStates,
  requiresReason,
  checkAndExpireProjects,
  getProjectsNearDeadline,
  canProjectAcceptRequests,
} from '../services/projectLifecycleService';
import { ProjectStatus } from '../types';
import { sendNotification } from '../services/notificationHelpers';

/**
 * Get all projects with optional status filter
 *
 * @param req.query.status - Optional filter by project status
 * @returns projects - Array of projects ordered by creation date (newest first)
 */
export const getAllProjects = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let queryText = 'SELECT * FROM projects';
    const params: string[] = [];

    if (status) {
      queryText += ' WHERE status = $1';
      params.push(status as string);
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await query(queryText, params.length > 0 ? params : undefined);
    const projects = toCamelCase(result.rows);

    logger.info(`Retrieved ${result.rows.length} projects`);
    res.json({ projects });
  } catch (error) {
    logger.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

/**
 * Get a single project by ID
 *
 * @param req.params.id - The project UUID
 * @returns project - The project details
 */
export const getProjectById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM projects WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = toCamelCase(result.rows[0]);
    logger.info(`Retrieved project ${id}`);
    res.json({ project });
  } catch (error) {
    logger.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

/**
 * Create a new project
 *
 * Auto-generates a project code in format: NNNNNN-YYYY (e.g., 100001-2025)
 *
 * @param req.body.name - Project name (required)
 * @param req.body.totalHours - Hour budget for the project (required)
 * @param req.body.createdBy - Creator user ID (required)
 * @param req.body.createdByName - Creator name (required)
 * @param req.body.status - Initial status (default: 'Pending')
 * @param req.body.description - Optional project description
 * @param req.body.priority - 'Low' | 'Medium' | 'High' (default: 'Medium')
 * @param req.body.category - Optional category
 * @param req.body.startDate - Optional start date
 * @param req.body.endDate - Optional end date
 * @param req.body.deadline - Optional deadline
 * @param req.body.ownerId - Optional project owner ID
 * @param req.body.ownerName - Optional project owner name
 * @returns project - The created project with auto-generated code
 */
export const createProject = async (req: Request, res: Response) => {
  try {
    const {
      name,
      totalHours,
      createdBy,
      createdByName,
      status,
      description,
      priority,
      category,
      startDate,
      endDate,
      deadline,
      ownerId,
      ownerName,
    } = req.body;

    // Validation
    if (!name || !totalHours || !createdBy || !createdByName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (totalHours < 0) {
      return res.status(400).json({ error: 'Total hours must be non-negative' });
    }

    // Auto-generate project code
    const currentYear = new Date().getFullYear();

    // Get all codes for this year and find the highest numeric one
    const codePattern = `%-${currentYear}`;
    const codesResult = await query(`
      SELECT code FROM projects
      WHERE code LIKE $1
    `, [codePattern]);

    let nextNumber = 100001; // Starting number

    // Find the highest numeric code
    for (const row of codesResult.rows) {
      const numericPart = parseInt(row.code.split('-')[0]);
      if (!isNaN(numericPart) && numericPart >= nextNumber) {
        nextNumber = numericPart + 1;
      }
    }

    const code = `${nextNumber}-${currentYear}`;

    // Default status based on user role:
    // - Managers/Admins can create Active projects directly
    // - End-Users/Engineers create Pending projects that require approval
    const userRole = req.user?.role;
    const projectStatus = status ||
      (['Manager', 'Admin'].includes(userRole || '') ? 'Active' : 'Pending');
    const projectPriority = priority || 'Medium';

    const result = await query(
      `INSERT INTO projects (
        name, code, description, total_hours, used_hours, status, priority, category,
        start_date, end_date, deadline, owner_id, owner_name,
        created_by, created_by_name
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        name, code, description || null, totalHours, 0, projectStatus, projectPriority, category || null,
        startDate || null, endDate || null, deadline || null, ownerId || null, ownerName || null,
        createdBy, createdByName
      ]
    );

    const project = toCamelCase<{ id: string }>(result.rows[0]);
    logger.info(`Created project ${project.id} with auto-generated code ${code}`);

    // Audit log
    await logRequestAudit(
      req,
      AuditAction.CREATE_PROJECT,
      EntityType.PROJECT,
      project.id,
      { name, code, totalHours, status: projectStatus }
    );

    res.status(201).json({ project });
  } catch (error) {
    logger.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

/**
 * Update project name (Manager/Admin only)
 *
 * @param req.params.id - The project UUID
 * @param req.body.name - New project name
 * @returns project - The updated project
 */
export const updateProjectName = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = await query(
      'UPDATE projects SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = toCamelCase(result.rows[0]);
    logger.info(`Updated project ${id} name to "${name}"`);

    // Audit log
    await logRequestAudit(
      req,
      AuditAction.UPDATE_PROJECT,
      EntityType.PROJECT,
      parseInt(id),
      { name }
    );

    res.json({ project });
  } catch (error) {
    logger.error('Error updating project name:', error);
    res.status(500).json({ error: 'Failed to update project name' });
  }
};

/**
 * Update project status with lifecycle management
 *
 * Uses the project lifecycle service to ensure valid state transitions.
 * Some transitions require a reason (e.g., On Hold, Suspended, Cancelled).
 *
 * @param req.params.id - The project UUID
 * @param req.body.status - Target status
 * @param req.body.reason - Required for certain transitions
 * @param req.body.completionNotes - Notes when completing
 * @param req.body.cancellationReason - Reason when cancelling
 * @returns project - Updated project
 * @returns transition.validNextStates - Valid next states from new status
 */
export const updateProjectStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason, completionNotes, cancellationReason } = req.body;
    const userId = req.user?.userId;
    const userName = req.user?.name || 'Unknown';

    // Validate status is a known value
    const validStatuses: ProjectStatus[] = [
      'Pending', 'Active', 'On Hold', 'Suspended',
      'Completed', 'Cancelled', 'Expired', 'Archived'
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses
      });
    }

    // Use the lifecycle service for transition
    const result = await transitionProjectStatus({
      projectId: id,
      toStatus: status as ProjectStatus,
      reason,
      changedById: userId,
      changedByName: userName,
      completionNotes,
      cancellationReason,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const project = toCamelCase(result.project);
    logger.info(`Updated project ${id} status to ${status}`);

    // Audit log - use specific action based on status
    let auditAction = AuditAction.UPDATE_PROJECT;
    if (status === 'Archived') {
      auditAction = AuditAction.ARCHIVE_PROJECT;
    }

    await logRequestAudit(
      req,
      auditAction,
      EntityType.PROJECT,
      id,
      { status, reason, historyId: result.historyId }
    );

    // Notify project owner and team about significant status changes
    const projectData = result.project;
    if (projectData && ['Active', 'Suspended', 'Completed', 'Cancelled'].includes(status)) {
      const notifications = [];
      const ownerId = projectData.owner_id as string | undefined;
      const projectName = projectData.name as string;

      // Notify project owner
      if (ownerId && ownerId !== userId) {
        notifications.push(
          sendNotification({
            userId: ownerId,
            type: 'PROJECT_UPDATED',
            title: `Project Status Changed`,
            message: `Project "${projectName}" status changed to ${status}`,
            link: `/projects`,
            entityType: 'Project',
            entityId: id,
            triggeredBy: userId,
          })
        );
      }

      // Get all engineers assigned to requests in this project and notify them
      const engineersResult = await query(
        `SELECT DISTINCT assigned_to
         FROM requests
         WHERE project_id = $1 AND assigned_to IS NOT NULL`,
        [id]
      );

      engineersResult.rows.forEach(row => {
        if (row.assigned_to && row.assigned_to !== userId && row.assigned_to !== ownerId) {
          notifications.push(
            sendNotification({
              userId: row.assigned_to,
              type: 'PROJECT_UPDATED',
              title: `Project Status Changed`,
              message: `Project "${projectName}" status changed to ${status}`,
              link: `/projects`,
              entityType: 'Project',
              entityId: id,
              triggeredBy: userId,
            })
          );
        }
      });

      // Send all notifications
      await Promise.all(notifications).catch(err =>
        logger.error('Failed to send project status change notifications:', err)
      );
    }

    res.json({
      project,
      transition: {
        historyId: result.historyId,
        validNextStates: getValidNextStates(status as ProjectStatus),
      }
    });
  } catch (error) {
    logger.error('Error updating project status:', error);
    res.status(500).json({ error: 'Failed to update project status' });
  }
};

/**
 * Get valid next states for a project's current status
 *
 * @param req.params.id - The project UUID
 * @returns currentStatus - Current project status
 * @returns validNextStates - Array of valid target statuses
 * @returns requiresReason - Which states require a reason
 */
export const getProjectValidTransitions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT status FROM projects WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const currentStatus = result.rows[0].status as ProjectStatus;
    const validNextStates = getValidNextStates(currentStatus);

    res.json({
      currentStatus,
      validNextStates,
      requiresReason: validNextStates.filter(s => requiresReason(s)),
    });
  } catch (error) {
    logger.error('Error fetching valid transitions:', error);
    res.status(500).json({ error: 'Failed to fetch valid transitions' });
  }
};

/**
 * Get project status change history
 *
 * @param req.params.id - The project UUID
 * @param req.query.limit - Max records to return (default: 50)
 * @param req.query.offset - Records to skip for pagination (default: 0)
 * @returns history - Array of status change records
 * @returns pagination - Pagination metadata
 */
export const getProjectHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await getProjectStatusHistory(id, limit, offset);

    res.json({
      history: toCamelCase(result.history),
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.history.length < result.total,
      },
    });
  } catch (error) {
    logger.error('Error fetching project status history:', error);
    res.status(500).json({ error: 'Failed to fetch status history' });
  }
};

/**
 * Check and expire overdue projects (Admin/scheduled job)
 *
 * Finds active projects past their deadline and transitions them to 'Expired'.
 *
 * @returns message - Summary of expired projects
 * @returns expiredProjects - Array of project IDs that were expired
 */
export const expireOverdueProjects = async (_req: Request, res: Response) => {
  try {
    const result = await checkAndExpireProjects();

    res.json({
      message: `${result.expired} project(s) expired`,
      expiredProjects: result.projects,
    });
  } catch (error) {
    logger.error('Error expiring overdue projects:', error);
    res.status(500).json({ error: 'Failed to expire overdue projects' });
  }
};

/**
 * Get projects approaching their deadline
 *
 * @param req.query.days - Number of days ahead to check (default: 7)
 * @returns projects - Projects with deadlines within the specified window
 */
export const getProjectsApproachingDeadline = async (req: Request, res: Response) => {
  try {
    const daysAhead = req.query.days ? parseInt(req.query.days as string, 10) : 7;

    const projects = await getProjectsNearDeadline(daysAhead);

    res.json({
      projects: toCamelCase(projects),
      daysAhead,
    });
  } catch (error) {
    logger.error('Error fetching projects near deadline:', error);
    res.status(500).json({ error: 'Failed to fetch projects near deadline' });
  }
};

/**
 * Check if a project can accept new requests
 *
 * Validates project status and available hours.
 *
 * @param req.params.id - The project UUID
 * @returns canAccept - Whether project can accept requests
 * @returns reason - If cannot accept, the reason why
 */
export const checkProjectAcceptance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await canProjectAcceptRequests(id);

    res.json(result);
  } catch (error) {
    logger.error('Error checking project acceptance:', error);
    res.status(500).json({ error: 'Failed to check project acceptance' });
  }
};

/**
 * Update project used hours (internal use for request allocation)
 *
 * Uses database row locking to prevent race conditions.
 * Validates that hours don't exceed budget or go negative.
 *
 * @param req.params.id - The project UUID
 * @param req.body.hoursToAdd - Hours to add (positive) or remove (negative)
 * @returns project - The updated project
 */
export const updateProjectHours = async (req: Request, res: Response) => {
  const client = await getClient();

  try {
    const { id } = req.params;
    const { hoursToAdd } = req.body;

    if (typeof hoursToAdd !== 'number') {
      return res.status(400).json({ error: 'hoursToAdd must be a number' });
    }

    // Start transaction
    await client.query('BEGIN');

    // Lock the project row for update to prevent concurrent modifications
    const projectResult = await client.query(
      'SELECT * FROM projects WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (projectResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Project not found' });
    }

    const currentProject = projectResult.rows[0];
    const newUsedHours = currentProject.used_hours + hoursToAdd;

    // Check if we have enough hours
    if (newUsedHours > currentProject.total_hours) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Insufficient hours in project bucket',
        available: currentProject.total_hours - currentProject.used_hours,
        requested: hoursToAdd
      });
    }

    // Cannot have negative used hours
    if (newUsedHours < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Cannot deallocate more hours than currently used',
        currentUsed: currentProject.used_hours,
        requested: hoursToAdd
      });
    }

    // Update the hours
    const result = await client.query(
      'UPDATE projects SET used_hours = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [newUsedHours, id]
    );

    // Commit transaction
    await client.query('COMMIT');

    const project = toCamelCase(result.rows[0]);
    logger.info(`Updated project ${id} hours: ${currentProject.used_hours}h -> ${newUsedHours}h (${hoursToAdd >= 0 ? '+' : ''}${hoursToAdd}h)`);

    // Audit log
    await logRequestAudit(
      req,
      AuditAction.UPDATE_PROJECT_HOURS,
      EntityType.PROJECT,
      parseInt(id),
      {
        hoursToAdd,
        previousUsedHours: currentProject.used_hours,
        newUsedHours,
      }
    );

    res.json({ project });
  } catch (error) {
    // Rollback on any error
    await client.query('ROLLBACK');
    logger.error('Error updating project hours:', error);
    res.status(500).json({ error: 'Failed to update project hours' });
  } finally {
    // Always release the client back to the pool
    client.release();
  }
};

/**
 * Delete a project (hard delete)
 *
 * Fails if project has associated requests. Use reassignProjectRequests or
 * deleteProjectRequests first.
 *
 * @param req.params.id - The project UUID
 * @returns message, id - Success message and deleted project ID
 */
export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if project has any requests associated with it
    const requestsResult = await query(
      `SELECT id, title, status FROM requests WHERE project_id = $1`,
      [id]
    );

    const requestCount = requestsResult.rows.length;

    if (requestCount > 0) {
      return res.status(409).json({
        error: 'Cannot delete project with associated requests',
        hasRequests: true,
        requestCount,
        requests: toCamelCase(requestsResult.rows),
        message: `This project has ${requestCount} associated request(s). Please delete them or reassign them to another project first.`
      });
    }

    const result = await query(
      'DELETE FROM projects WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    logger.info(`Deleted project ${id}`);

    // Audit log
    await logRequestAudit(
      req,
      AuditAction.DELETE_PROJECT,
      EntityType.PROJECT,
      parseInt(id)
    );

    res.json({ message: 'Project deleted successfully', id: result.rows[0].id });
  } catch (error) {
    logger.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

/**
 * Reassign all requests from one project to another
 *
 * Target project must be in Active or Approved status.
 *
 * @param req.params.id - Source project UUID
 * @param req.body.targetProjectId - Destination project UUID
 * @returns message, reassignedCount - Summary of reassignment
 */
export const reassignProjectRequests = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { targetProjectId } = req.body;

    if (!targetProjectId) {
      return res.status(400).json({ error: 'Target project ID is required' });
    }

    // Verify source project exists
    const sourceProject = await query('SELECT id, name FROM projects WHERE id = $1', [id]);
    if (sourceProject.rows.length === 0) {
      return res.status(404).json({ error: 'Source project not found' });
    }

    // Verify target project exists and is active
    const targetProject = await query(
      `SELECT id, name, status FROM projects WHERE id = $1`,
      [targetProjectId]
    );
    if (targetProject.rows.length === 0) {
      return res.status(404).json({ error: 'Target project not found' });
    }
    if (targetProject.rows[0].status !== 'Active') {
      return res.status(400).json({ error: 'Target project must be active to accept requests' });
    }

    // Reassign all requests
    const result = await query(
      `UPDATE requests
       SET project_id = $1, project_name = $2, project_code = (SELECT code FROM projects WHERE id = $1)
       WHERE project_id = $3
       RETURNING id`,
      [targetProjectId, targetProject.rows[0].name, id]
    );

    logger.info(`Reassigned ${result.rows.length} requests from project ${id} to ${targetProjectId}`);

    res.json({
      message: `Successfully reassigned ${result.rows.length} request(s) to ${targetProject.rows[0].name}`,
      reassignedCount: result.rows.length
    });
  } catch (error) {
    logger.error('Error reassigning project requests:', error);
    res.status(500).json({ error: 'Failed to reassign requests' });
  }
};

/**
 * Delete all requests associated with a project
 *
 * @param req.params.id - The project UUID
 * @returns message, deletedCount - Summary of deletion
 */
export const deleteProjectRequests = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify project exists
    const project = await query('SELECT id, name FROM projects WHERE id = $1', [id]);
    if (project.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Delete all requests for this project
    const result = await query(
      'DELETE FROM requests WHERE project_id = $1 RETURNING id',
      [id]
    );

    logger.info(`Deleted ${result.rows.length} requests from project ${id}`);

    res.json({
      message: `Successfully deleted ${result.rows.length} request(s) from ${project.rows[0].name}`,
      deletedCount: result.rows.length
    });
  } catch (error) {
    logger.error('Error deleting project requests:', error);
    res.status(500).json({ error: 'Failed to delete requests' });
  }
};

/**
 * Get project hour transaction history
 *
 * Shows all hour allocations, deallocations, extensions, and adjustments.
 *
 * @param req.params.id - The project UUID
 * @param req.query.limit - Max records to return (default: 50)
 * @param req.query.offset - Records to skip for pagination (default: 0)
 * @returns transactions - Array of hour transactions
 * @returns pagination - Pagination metadata
 */
export const getProjectHourTransactions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await getProjectHourHistory(id, limit, offset);

    res.json({
      transactions: toCamelCase(result.transactions),
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.transactions.length < result.total,
      },
    });
  } catch (error) {
    logger.error('Error fetching project hour transactions:', error);
    res.status(500).json({ error: 'Failed to fetch hour transactions' });
  }
};

/**
 * Extend project budget (add more hours)
 *
 * Increases total_hours, creating more available capacity.
 *
 * @param req.params.id - The project UUID
 * @param req.body.additionalHours - Hours to add (positive number)
 * @param req.body.reason - Justification for extension (min 3 chars)
 * @returns project - Updated project
 * @returns extension - Details of the extension
 */
export const extendProjectBudget = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { additionalHours, reason } = req.body;
    const userId = req.user?.userId;
    const userName = req.user?.name || 'Unknown';

    if (!additionalHours || typeof additionalHours !== 'number' || additionalHours <= 0) {
      return res.status(400).json({ error: 'Additional hours must be a positive number' });
    }

    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ error: 'Reason is required (minimum 3 characters)' });
    }

    const result = await extendProjectHours(id, additionalHours, userId, userName, reason.trim());

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Get updated project
    const projectResult = await query('SELECT * FROM projects WHERE id = $1', [id]);
    const project = toCamelCase(projectResult.rows[0]);

    // Audit log
    await logRequestAudit(
      req,
      AuditAction.UPDATE_PROJECT_HOURS,
      EntityType.PROJECT,
      id,
      { additionalHours, reason, newTotalHours: projectResult.rows[0].total_hours }
    );

    logger.info(`Extended project ${id} by ${additionalHours}h. Reason: ${reason}`);

    res.json({
      project,
      extension: {
        additionalHours,
        availableHours: result.availableHours,
      },
    });
  } catch (error) {
    logger.error('Error extending project budget:', error);
    res.status(500).json({ error: 'Failed to extend project budget' });
  }
};

/**
 * Manually adjust project used hours (Admin correction)
 *
 * Allows manual correction of used_hours for data fixes.
 * Positive adjustment increases used hours, negative decreases.
 *
 * @param req.params.id - The project UUID
 * @param req.body.adjustment - Hours to adjust (non-zero number)
 * @param req.body.reason - Justification for adjustment (min 3 chars)
 * @returns project - Updated project
 * @returns adjustment - Details of the adjustment
 */
export const manualHourAdjustment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;
    const userId = req.user?.userId;
    const userName = req.user?.name || 'Unknown';

    if (adjustment === undefined || typeof adjustment !== 'number' || adjustment === 0) {
      return res.status(400).json({ error: 'Adjustment must be a non-zero number' });
    }

    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ error: 'Reason is required (minimum 3 characters)' });
    }

    const result = await adjustProjectHours(id, adjustment, userId, userName, reason.trim());

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Get updated project
    const projectResult = await query('SELECT * FROM projects WHERE id = $1', [id]);
    const project = toCamelCase(projectResult.rows[0]);

    // Audit log
    await logRequestAudit(
      req,
      AuditAction.UPDATE_PROJECT_HOURS,
      EntityType.PROJECT,
      id,
      {
        adjustment,
        reason,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
      }
    );

    logger.info(`Manual hour adjustment for project ${id}: ${adjustment >= 0 ? '+' : ''}${adjustment}h. Reason: ${reason}`);

    res.json({
      project,
      adjustment: {
        hours: adjustment,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
        availableHours: result.availableHours,
      },
    });
  } catch (error) {
    logger.error('Error adjusting project hours:', error);
    res.status(500).json({ error: 'Failed to adjust project hours' });
  }
};

/**
 * Get project health metrics
 *
 * Returns computed metrics from the project_health_metrics view.
 *
 * @param req.params.id - The project UUID
 * @returns metrics - Health metrics including utilization, request counts, etc.
 */
export const getProjectHealthMetrics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM project_health_metrics WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ metrics: toCamelCase(result.rows[0]) });
  } catch (error) {
    logger.error('Error fetching project health metrics:', error);
    res.status(500).json({ error: 'Failed to fetch project health metrics' });
  }
};

/**
 * Get all projects with health metrics
 *
 * Returns all projects with computed health metrics, optionally filtered by status.
 * Ordered by deadline (soonest first), then by name.
 *
 * @param req.query.status - Optional filter by project status
 * @returns projects - Array of projects with health metrics
 */
export const getAllProjectsWithMetrics = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let queryText = 'SELECT * FROM project_health_metrics';
    const params: string[] = [];

    if (status) {
      queryText += ' WHERE status = $1';
      params.push(status as string);
    }

    queryText += ' ORDER BY deadline ASC NULLS LAST, name ASC';

    const result = await query(queryText, params.length > 0 ? params : undefined);

    res.json({ projects: toCamelCase(result.rows) });
  } catch (error) {
    logger.error('Error fetching projects with metrics:', error);
    res.status(500).json({ error: 'Failed to fetch projects with metrics' });
  }
};
