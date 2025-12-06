/**
 * @fileoverview Request Controller
 *
 * Handles all simulation request operations including CRUD, status transitions,
 * engineer assignment, comments, time tracking, and discussion workflows.
 *
 * Request Lifecycle:
 * 1. Submitted → Feasibility Review (Manager reviews)
 * 2. Feasibility Review → Engineering Review (Manager assigns engineer + hours)
 * 3. Engineering Review → In Progress (Engineer accepts) or Discussion (Engineer requests changes)
 * 4. Discussion → Engineering Review (Manager approves/denies hour changes)
 * 5. In Progress → Ready for Review (Engineer completes)
 * 6. Ready for Review → Completed (End-user accepts) or Revision (End-user requests changes)
 *
 * @module controllers/requestsController
 */

import { Request, Response } from 'express';
import { query, getClient } from '../db';
import { logger } from '../middleware/logger';
import { toCamelCase } from '../utils/caseConverter';
import { logRequestAudit, AuditAction, EntityType } from '../services/auditService';
import {
  allocateHoursToRequest,
  deallocateHoursFromRequest,
  finalizeRequestHours,
  validateHourAvailability,
} from '../services/projectHoursService';
import {
  NotFoundError,
  ValidationError,
  AuthorizationError,
  InternalError,
  ErrorCode,
} from '../utils/errors';
import { asyncHandler } from '../middleware/errorHandler';

/** Maximum number of requests that can be returned in a single query */
const MAX_LIMIT = 1000;

/**
 * Get all simulation requests with optional pagination and filtering
 *
 * @param req.query.limit - Maximum number of requests to return (default: all, max: 1000)
 * @param req.query.offset - Number of requests to skip for pagination (default: 0)
 * @param req.query.status - Filter by request status (e.g., 'Submitted', 'In Progress')
 * @returns {Object} requests - Array of requests with project info
 * @returns {Object} pagination - Pagination metadata (total, limit, offset, hasMore)
 */
export const getAllRequests = async (req: Request, res: Response) => {
  try {
    const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const limit = rawLimit ? Math.min(Math.max(1, rawLimit), MAX_LIMIT) : undefined;
    const offset = req.query.offset ? Math.max(0, parseInt(req.query.offset as string, 10)) : 0;
    const status = req.query.status as string | undefined;

    let queryText = `
      SELECT
        r.*,
        p.name as project_name,
        p.code as project_code
      FROM requests r
      LEFT JOIN projects p ON r.project_id = p.id
    `;

    const params: (string | number)[] = [];
    let paramIndex = 1;

    // Filter by status if provided
    if (status) {
      queryText += ` WHERE r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    queryText += ' ORDER BY r.created_at DESC';

    // Add pagination if limit is specified
    if (limit) {
      queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
    }

    const result = await query(queryText, params.length > 0 ? params : undefined);

    // Get total count for pagination metadata
    let countQuery = 'SELECT COUNT(*) FROM requests';
    const countParams: string[] = [];
    if (status) {
      countQuery += ' WHERE status = $1';
      countParams.push(status);
    }
    const countResult = await query(countQuery, countParams.length > 0 ? countParams : undefined);
    const total = parseInt(countResult.rows[0].count, 10);

    res.json({
      requests: toCamelCase(result.rows),
      pagination: {
        total,
        limit: limit || total,
        offset,
        hasMore: limit ? offset + result.rows.length < total : false,
      },
    });
  } catch (error) {
    logger.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
};

/**
 * Get a single request by ID with its comments
 *
 * @param req.params.id - The request UUID
 * @returns request - The request with project info
 * @returns comments - Array of comments ordered by creation date
 * @throws NotFoundError if request doesn't exist
 */
export const getRequestById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const requestResult = await query(`
    SELECT
      r.*,
      p.name as project_name,
      p.code as project_code
    FROM requests r
    LEFT JOIN projects p ON r.project_id = p.id
    WHERE r.id = $1
  `, [id]);

  if (requestResult.rows.length === 0) {
    throw new NotFoundError('Request', id);
  }

  const commentsResult = await query(
    'SELECT * FROM comments WHERE request_id = $1 ORDER BY created_at ASC',
    [id]
  );

  res.json({
    request: toCamelCase(requestResult.rows[0]),
    comments: toCamelCase(commentsResult.rows),
  });
});

/**
 * Create a new simulation request
 *
 * Admins can create requests on behalf of other users by providing onBehalfOfUserId.
 * Creates activity log and audit trail entries.
 *
 * @param req.body.title - Request title (required)
 * @param req.body.description - Detailed description (required)
 * @param req.body.vendor - Simulation vendor/tool (required)
 * @param req.body.priority - Priority level: 'Low', 'Medium', 'High' (required)
 * @param req.body.projectId - Optional project to associate with
 * @param req.body.onBehalfOfUserId - Optional user ID to create request for (Admin only)
 * @returns request - The newly created request
 */
export const createRequest = async (req: Request, res: Response) => {
  try {
    const { title, description, vendor, priority, projectId, onBehalfOfUserId } = req.body;
    const userId = req.user?.userId;
    const userName = req.user?.name || 'Unknown';
    const userRole = req.user?.role;

    // If onBehalfOfUserId is provided, verify that the current user is an admin
    let effectiveUserId = userId;
    let effectiveUserName = userName;
    let createdByAdminId = null;
    let createdByAdminName = null;

    // Check if onBehalfOfUserId is provided and not empty
    if (onBehalfOfUserId && onBehalfOfUserId.trim() !== '') {
      // Only admins can create requests on behalf of others
      if (userRole !== 'Admin') {
        return res.status(403).json({ error: 'Only admins can create requests on behalf of other users' });
      }

      // Fetch the user we're creating on behalf of
      const userResult = await query('SELECT id, name FROM users WHERE id = $1', [onBehalfOfUserId]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      effectiveUserId = onBehalfOfUserId;
      effectiveUserName = userResult.rows[0].name;
      createdByAdminId = userId;
      createdByAdminName = userName;
    }

    const result = await query(`
      INSERT INTO requests (
        title, description, vendor, priority, status,
        created_by, created_by_name, project_id,
        created_by_admin_id, created_by_admin_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      title, description, vendor, priority, 'Submitted',
      effectiveUserId || null, effectiveUserName, projectId || null,
      createdByAdminId, createdByAdminName
    ]);

    // Log activity for the effective user (the one the request is for)
    if (effectiveUserId) {
      await query(`
        INSERT INTO activity_log (request_id, user_id, action, details)
        VALUES ($1, $2, $3, $4)
      `, [result.rows[0].id, effectiveUserId, 'created', { title, onBehalfOf: !!onBehalfOfUserId }]);
    }

    // Log audit trail
    await logRequestAudit(
      req,
      AuditAction.CREATE_REQUEST,
      EntityType.REQUEST,
      result.rows[0].id,
      {
        title,
        vendor,
        priority,
        projectId,
        onBehalfOf: onBehalfOfUserId ? effectiveUserName : undefined,
        createdBy: onBehalfOfUserId ? userName : undefined,
      }
    );

    res.status(201).json({ request: toCamelCase(result.rows[0]) });
  } catch (error) {
    logger.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
};

/**
 * Update request title directly (Admin/Manager/Owner only)
 *
 * For engineers who need to change titles, use requestTitleChange instead.
 *
 * @param req.params.id - The request UUID
 * @param req.body.title - New title (minimum 3 characters)
 * @throws ValidationError if title is too short
 * @throws NotFoundError if request doesn't exist
 */
export const updateRequestTitle = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title } = req.body;
  const userId = req.user?.userId;

  if (!title || title.trim().length < 3) {
    throw new ValidationError('Title must be at least 3 characters', {
      field: 'title',
      minLength: 3,
    });
  }

  const result = await query(`
    UPDATE requests
    SET title = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `, [title.trim(), id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Request', id);
  }

  // Log activity
  if (userId) {
    await query(`
      INSERT INTO activity_log (request_id, user_id, action, details)
      VALUES ($1, $2, $3, $4::jsonb)
    `, [id, userId, 'title_changed', JSON.stringify({ title })]);
  }

  res.json({ request: toCamelCase(result.rows[0]) });
});

/**
 * Update request description (Admin/Manager/Owner only)
 *
 * Uses database row locking to prevent concurrent modification.
 *
 * @param req.params.id - The request UUID
 * @param req.body.description - New description (minimum 10 characters)
 * @throws ValidationError if description is too short
 * @throws NotFoundError if request doesn't exist
 * @throws AuthorizationError if user lacks permission
 */
export const updateRequestDescription = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { description } = req.body;
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  if (!description || description.trim().length < 10) {
    throw new ValidationError('Description must be at least 10 characters', {
      field: 'description',
      minLength: 10,
    });
  }

  // Use transaction with row locking to prevent race conditions
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock the row and check permissions atomically
    const requestResult = await client.query(
      'SELECT created_by FROM requests WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new NotFoundError('Request', id);
    }

    const request = requestResult.rows[0];

    // Only admins, managers, or the request creator can update description
    if (userRole !== 'Admin' && userRole !== 'Manager' && request.created_by !== userId) {
      await client.query('ROLLBACK');
      throw new AuthorizationError('You do not have permission to edit this request');
    }

    // Update description within the same transaction
    const result = await client.query(`
      UPDATE requests
      SET description = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [description.trim(), id]);

    // Log activity
    if (userId) {
      await client.query(`
        INSERT INTO activity_log (request_id, user_id, action, details)
        VALUES ($1, $2, $3, $4::jsonb)
      `, [id, userId, 'description_changed', JSON.stringify({ description: description.substring(0, 100) })]);
    }

    await client.query('COMMIT');

    // Log audit trail (outside transaction - non-critical)
    await logRequestAudit(
      req,
      AuditAction.UPDATE_REQUEST,
      EntityType.REQUEST,
      id,
      { field: 'description' }
    );

    res.json({ request: toCamelCase(result.rows[0]) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

/**
 * Request a title change (Engineer workflow - requires Manager approval)
 *
 * Creates a pending title change request that must be reviewed by a Manager.
 * Engineers cannot directly edit titles; they must go through this approval process.
 *
 * @param req.params.id - The request UUID
 * @param req.body.proposedTitle - The proposed new title (minimum 3 characters)
 * @returns titleChangeRequest - The created title change request
 * @throws ValidationError if proposed title is too short
 * @throws NotFoundError if request doesn't exist
 */
export const requestTitleChange = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { proposedTitle } = req.body;
  const userId = req.user?.userId;
  const userName = req.user?.name || 'Unknown';

  if (!proposedTitle || proposedTitle.trim().length < 3) {
    throw new ValidationError('Title must be at least 3 characters', {
      field: 'proposedTitle',
      minLength: 3,
    });
  }

  // Get current request
  const requestResult = await query('SELECT * FROM requests WHERE id = $1', [id]);
  if (requestResult.rows.length === 0) {
    throw new NotFoundError('Request', id);
  }

  const currentTitle = requestResult.rows[0].title;

  // Create title change request
  const result = await query(`
    INSERT INTO title_change_requests
      (request_id, requested_by, requested_by_name, current_title, proposed_title, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [id, userId, userName, currentTitle, proposedTitle.trim(), 'Pending']);

  const titleChangeRequest = result.rows[0];

  // Audit log
  await logRequestAudit(
    req,
    AuditAction.REQUEST_TITLE_CHANGE,
    EntityType.TITLE_CHANGE,
    titleChangeRequest.id,
    {
      requestId: parseInt(id),
      currentTitle,
      proposedTitle: proposedTitle.trim(),
    }
  );

  res.status(201).json({ titleChangeRequest: toCamelCase(titleChangeRequest) });
});

/**
 * Get all pending title change requests (Manager view)
 *
 * Returns title change requests awaiting manager review.
 *
 * @returns titleChangeRequests - Array of pending title change requests
 */
export const getPendingTitleChangeRequests = async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT tcr.*, r.title as current_title
      FROM title_change_requests tcr
      JOIN requests r ON tcr.request_id = r.id
      WHERE tcr.status = 'Pending'
      ORDER BY tcr.created_at DESC
    `);

    res.json({ titleChangeRequests: toCamelCase(result.rows) });
  } catch (error) {
    logger.error('Error fetching title change requests:', error);
    res.status(500).json({ error: 'Failed to fetch title change requests' });
  }
};

/**
 * Get title change request history for a specific request
 *
 * @param req.params.id - The request UUID
 * @returns titleChangeRequests - Array of title change requests (all statuses)
 */
export const getTitleChangeRequestsForRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT *
      FROM title_change_requests
      WHERE request_id = $1
      ORDER BY created_at DESC
    `, [id]);

    res.json({ titleChangeRequests: toCamelCase(result.rows) });
  } catch (error) {
    logger.error('Error fetching title change requests for request:', error);
    res.status(500).json({ error: 'Failed to fetch title change requests' });
  }
};

/**
 * Review (approve or deny) a title change request (Manager only)
 *
 * If approved, the request title is updated immediately.
 *
 * @param req.params.id - The title change request UUID
 * @param req.body.approved - Boolean: true to approve, false to deny
 * @returns message - Status message
 */
export const reviewTitleChangeRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    const userId = req.user?.userId;
    const userName = req.user?.name || 'Unknown';

    // Get the title change request
    const tcrResult = await query(
      'SELECT * FROM title_change_requests WHERE id = $1',
      [id]
    );

    if (tcrResult.rows.length === 0) {
      return res.status(404).json({ error: 'Title change request not found' });
    }

    const titleChangeRequest = tcrResult.rows[0];
    const status = approved ? 'Approved' : 'Denied';

    // Update the title change request status
    await query(`
      UPDATE title_change_requests
      SET status = $1, reviewed_by = $2, reviewed_by_name = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [status, userId || null, userName, id]);

    // If approved, update the actual request title
    if (approved) {
      await query(`
        UPDATE requests
        SET title = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [titleChangeRequest.proposed_title, titleChangeRequest.request_id]);

      // Log activity
      await query(`
        INSERT INTO activity_log (request_id, user_id, action, details)
        VALUES ($1, $2, $3, $4::jsonb)
      `, [
        titleChangeRequest.request_id,
        userId,
        'title_change_approved',
        JSON.stringify({ newTitle: titleChangeRequest.proposed_title })
      ]);
    }

    // Audit log
    const auditAction = approved
      ? AuditAction.APPROVE_TITLE_CHANGE
      : AuditAction.REJECT_TITLE_CHANGE;

    await logRequestAudit(
      req,
      auditAction,
      EntityType.TITLE_CHANGE,
      parseInt(id),
      {
        requestId: titleChangeRequest.request_id,
        currentTitle: titleChangeRequest.current_title,
        proposedTitle: titleChangeRequest.proposed_title,
      }
    );

    res.json({ message: `Title change ${status.toLowerCase()}` });
  } catch (error) {
    logger.error('Error reviewing title change request:', error);
    res.status(500).json({ error: 'Failed to review title change request' });
  }
};

/**
 * Update request status
 *
 * Handles hour management automatically:
 * - When denied: deallocates hours back to project
 * - When completed: finalizes hours (returns unused, logs overage)
 *
 * @param req.params.id - The request UUID
 * @param req.body.status - New status value
 * @returns request - The updated request
 * @throws NotFoundError if request doesn't exist
 */
export const updateRequestStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user?.userId;
  const userName = req.user?.name || 'Unknown';

  // Get the current request to check for allocated hours and project
  const currentRequest = await query(
    'SELECT project_id, allocated_hours, status as current_status FROM requests WHERE id = $1',
    [id]
  );

  if (currentRequest.rows.length === 0) {
    throw new NotFoundError('Request', id);
  }

  const { project_id: projectId, allocated_hours: allocatedHours, current_status: currentStatus } = currentRequest.rows[0];

  // Handle hour deallocation when request is denied
  if (status === 'Denied' && projectId && allocatedHours && allocatedHours > 0) {
    const deallocResult = await deallocateHoursFromRequest(
      projectId,
      id,
      allocatedHours,
      userId,
      userName,
      `Request denied. Returning ${allocatedHours}h to project.`
    );

    if (deallocResult.success) {
      logger.info(`Deallocated ${allocatedHours}h from request ${id} back to project ${projectId}`);
    } else {
      logger.warn(`Failed to deallocate hours on denial: ${deallocResult.error}`);
    }
  }

  // Handle hour finalization when request is completed
  if (status === 'Completed' && currentStatus !== 'Completed' && projectId && allocatedHours) {
    // Get total logged hours for this request
    const timeResult = await query(
      'SELECT COALESCE(SUM(hours), 0) as total_logged FROM time_entries WHERE request_id = $1',
      [id]
    );
    const actualHours = parseFloat(timeResult.rows[0].total_logged) || allocatedHours;

    // Finalize - return unused hours or log overage
    const finalizeResult = await finalizeRequestHours(
      projectId,
      id,
      allocatedHours,
      actualHours,
      userId,
      userName
    );

    if (finalizeResult.success) {
      logger.info(`Finalized hours for request ${id}: Allocated ${allocatedHours}h, Actual ${actualHours}h`);
    }
  }

  const result = await query(`
    UPDATE requests
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `, [status, id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Request', id);
  }

  // Log activity
  if (userId) {
    await query(`
      INSERT INTO activity_log (request_id, user_id, action, details)
      VALUES ($1, $2, $3, $4::jsonb)
    `, [id, userId, 'status_changed', JSON.stringify({ status })]);
  }

  // Log audit trail
  await logRequestAudit(
    req,
    AuditAction.UPDATE_REQUEST_STATUS,
    EntityType.REQUEST,
    parseInt(id),
    { status }
  );

  res.json({ request: toCamelCase(result.rows[0]) });
});

/**
 * Assign an engineer to a request with estimated hours (Manager only)
 *
 * Allocates hours from the project budget when assigning. If reassigning with
 * different hours, automatically adjusts the allocation (adds or returns hours).
 *
 * @param req.params.id - The request UUID
 * @param req.body.engineerId - UUID of the engineer to assign
 * @param req.body.estimatedHours - Hours to allocate from project budget
 * @returns request - The updated request
 * @throws ValidationError if insufficient project hours
 * @throws NotFoundError if request or engineer doesn't exist
 */
export const assignEngineer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { engineerId, estimatedHours } = req.body;
  const userId = req.user?.userId;
  const userName = req.user?.name || 'Unknown';

  // Validate estimatedHours is a positive number
  if (estimatedHours !== undefined && (typeof estimatedHours !== 'number' || estimatedHours < 0)) {
    throw new ValidationError('Estimated hours must be a non-negative number', {
      field: 'estimatedHours',
      min: 0,
    });
  }

  // Get engineer name
  const engineerResult = await query(
    'SELECT name FROM users WHERE id = $1',
    [engineerId]
  );

  if (engineerResult.rows.length === 0) {
    throw new NotFoundError('Engineer', engineerId);
  }

  const engineerName = engineerResult.rows[0].name;

  // Get the current request to check for project and existing allocation
  const currentRequest = await query(
    'SELECT project_id, allocated_hours FROM requests WHERE id = $1',
    [id]
  );

  if (currentRequest.rows.length === 0) {
    throw new NotFoundError('Request', id);
  }

  const { project_id: projectId, allocated_hours: currentAllocatedHours } = currentRequest.rows[0];

  // If request has a project and hours are being allocated, handle hour management
  if (projectId && estimatedHours > 0) {
    // Calculate net hours to allocate (may be reassigning with different hours)
    const previouslyAllocated = currentAllocatedHours || 0;
    const netHoursToAllocate = estimatedHours - previouslyAllocated;

    if (netHoursToAllocate !== 0) {
      // Validate availability first
      const availability = await validateHourAvailability(projectId, netHoursToAllocate > 0 ? netHoursToAllocate : 0);

      if (netHoursToAllocate > 0 && !availability.available) {
        throw new ValidationError(
          `Insufficient project hours. Available: ${availability.currentAvailable}h, Requested: ${netHoursToAllocate}h`,
          {
            field: 'estimatedHours',
            availableHours: availability.currentAvailable,
            requestedHours: netHoursToAllocate,
          }
        );
      }

      // Allocate or deallocate the difference
      if (netHoursToAllocate > 0) {
        const allocationResult = await allocateHoursToRequest(
          projectId,
          id,
          netHoursToAllocate,
          userId,
          userName
        );

        if (!allocationResult.success) {
          throw new ValidationError(allocationResult.error || 'Failed to allocate hours', {
            field: 'estimatedHours',
          });
        }

        logger.info(`Allocated ${netHoursToAllocate}h from project ${projectId} to request ${id}`);
      } else if (netHoursToAllocate < 0) {
        // Return hours if reducing allocation
        const deallocResult = await deallocateHoursFromRequest(
          projectId,
          id,
          Math.abs(netHoursToAllocate),
          userId,
          userName,
          'Hours reduced during engineer assignment'
        );

        if (!deallocResult.success) {
          logger.warn(`Failed to deallocate hours: ${deallocResult.error}`);
        }
      }
    }
  }

  const result = await query(`
    UPDATE requests
    SET assigned_to = $1, assigned_to_name = $2, estimated_hours = $3,
        allocated_hours = $3, status = 'Engineering Review', updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING *
  `, [engineerId, engineerName, estimatedHours, id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Request', id);
  }

  // Log activity
  if (userId) {
    await query(`
      INSERT INTO activity_log (request_id, user_id, action, details)
      VALUES ($1, $2, $3, $4::jsonb)
    `, [id, userId, 'assigned', JSON.stringify({ engineerId, engineerName, estimatedHours })]);
  }

  // Log audit trail
  await logRequestAudit(
    req,
    AuditAction.ASSIGN_ENGINEER,
    EntityType.REQUEST,
    parseInt(id),
    { engineerId, engineerName, estimatedHours }
  );

  res.json({ request: toCamelCase(result.rows[0]) });
});

/**
 * Add a comment to a request
 *
 * @param req.params.id - The request UUID
 * @param req.body.content - Comment text content
 * @returns comment - The created comment
 */
export const addComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user?.userId;
    const userName = req.user?.name || 'Unknown';
    const userRole = req.user?.role || 'User';

    const result = await query(`
      INSERT INTO comments (request_id, author_id, author_name, author_role, content)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, userId || null, userName, userRole, content]);

    const comment = result.rows[0];

    // Audit log
    await logRequestAudit(
      req,
      AuditAction.ADD_COMMENT,
      EntityType.COMMENT,
      comment.id,
      { requestId: parseInt(id), content }
    );

    res.status(201).json({ comment: toCamelCase(comment) });
  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

/**
 * Delete a request and its comments (Admin/Manager only)
 *
 * @param req.params.id - The request UUID
 * @returns message, id - Success message and deleted request ID
 * @throws NotFoundError if request doesn't exist
 */
export const deleteRequest = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // First delete related comments
  await query('DELETE FROM comments WHERE request_id = $1', [id]);

  // Then delete the request
  const result = await query('DELETE FROM requests WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Request', id);
  }

  // Audit log
  await logRequestAudit(
    req,
    AuditAction.DELETE_REQUEST,
    EntityType.REQUEST,
    parseInt(id)
  );

  res.json({ message: 'Request deleted successfully', id: result.rows[0].id });
});

/**
 * Get time entries logged against a request
 *
 * @param req.params.id - The request UUID
 * @returns timeEntries - Array of time entries ordered by creation date (newest first)
 */
export const getTimeEntries = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM time_entries WHERE request_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({ timeEntries: toCamelCase(result.rows) });
  } catch (error) {
    logger.error('Error fetching time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
};

/**
 * Add a time entry to a request (Engineer only)
 *
 * Engineers log their work hours against assigned requests.
 *
 * @param req.params.id - The request UUID
 * @param req.body.hours - Hours worked (positive number, required)
 * @param req.body.description - Optional description of work performed
 * @returns timeEntry - The created time entry
 */
export const addTimeEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { hours, description } = req.body;
    const userId = req.user?.userId;
    const userName = req.user?.name || 'Unknown';

    // Validate hours is a positive number
    if (hours === undefined || typeof hours !== 'number' || hours <= 0) {
      return res.status(400).json({
        error: 'Hours must be a positive number',
        details: { field: 'hours', min: 0.01 },
      });
    }

    const result = await query(`
      INSERT INTO time_entries (request_id, engineer_id, engineer_name, hours, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, userId || null, userName, hours, description || '']);

    const timeEntry = result.rows[0];

    // Audit log
    await logRequestAudit(
      req,
      AuditAction.ADD_TIME_ENTRY,
      EntityType.TIME_ENTRY,
      timeEntry.id,
      { requestId: parseInt(id), hours, description }
    );

    res.status(201).json({ timeEntry: toCamelCase(timeEntry) });
  } catch (error) {
    logger.error('Error adding time entry:', error);
    res.status(500).json({ error: 'Failed to add time entry' });
  }
};

/**
 * Create a discussion request (Engineer workflow)
 *
 * When an engineer disagrees with allocated hours, they can request a discussion.
 * This changes the request status to 'Discussion' pending manager review.
 *
 * @param req.params.id - The request UUID
 * @param req.body.reason - Reason for the discussion (minimum 5 characters)
 * @param req.body.suggestedHours - Optional suggested hour adjustment
 * @returns discussionRequest - The created discussion request
 * @throws ValidationError if reason is too short
 */
export const createDiscussionRequest = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason, suggestedHours } = req.body;
  const userId = req.user?.userId;

  if (!reason || reason.trim().length < 5) {
    throw new ValidationError('Reason must be at least 5 characters', {
      field: 'reason',
      minLength: 5,
    });
  }

  // Create discussion request
  const result = await query(`
    INSERT INTO discussion_requests (request_id, engineer_id, reason, suggested_hours, status)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [id, userId, reason.trim(), suggestedHours || null, 'Pending']);

  // Update request status to Discussion
  await query(`
    UPDATE requests
    SET status = 'Discussion', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `, [id]);

  // Log activity
  await query(`
    INSERT INTO activity_log (request_id, user_id, action, details)
    VALUES ($1, $2, $3, $4::jsonb)
  `, [id, userId || null, 'discussion_requested', JSON.stringify({ reason, suggestedHours })]);

  const discussionRequest = result.rows[0];

  // Audit log
  await logRequestAudit(
    req,
    AuditAction.CREATE_DISCUSSION,
    EntityType.DISCUSSION,
    discussionRequest.id,
    { requestId: parseInt(id), reason, suggestedHours }
  );

  res.status(201).json({ discussionRequest: toCamelCase(discussionRequest) });
});

/**
 * Get discussion request history for a specific request
 *
 * @param req.params.id - The request UUID
 * @returns discussionRequests - Array of discussion requests with engineer/reviewer names
 */
export const getDiscussionRequestsForRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT dr.*, u.name as engineer_name, u2.name as reviewed_by_name
      FROM discussion_requests dr
      LEFT JOIN users u ON dr.engineer_id = u.id
      LEFT JOIN users u2 ON dr.reviewed_by = u2.id
      WHERE dr.request_id = $1
      ORDER BY dr.created_at DESC
    `, [id]);

    res.json({ discussionRequests: toCamelCase(result.rows) });
  } catch (error) {
    logger.error('Error fetching discussion requests:', error);
    res.status(500).json({ error: 'Failed to fetch discussion requests' });
  }
};

/**
 * Update the requester of a request (Admin only)
 *
 * Allows admins to reassign ownership of a request to a different user.
 *
 * @param req.params.id - The request UUID
 * @param req.body.newRequesterId - UUID of the new requester
 * @returns request - The updated request
 * @throws ValidationError if newRequesterId is missing
 * @throws NotFoundError if request or user doesn't exist
 */
export const updateRequestRequester = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newRequesterId } = req.body;
  const userId = req.user?.userId;
  const userName = req.user?.name || 'Unknown';

  if (!newRequesterId) {
    throw new ValidationError('New requester ID is required', {
      field: 'newRequesterId',
    });
  }

  // Get the new requester's info
  const userResult = await query('SELECT id, name FROM users WHERE id = $1', [newRequesterId]);
  if (userResult.rows.length === 0) {
    throw new NotFoundError('User', newRequesterId);
  }

  const newRequester = userResult.rows[0];

  // Get the current request to log the change
  const currentRequest = await query('SELECT created_by, created_by_name FROM requests WHERE id = $1', [id]);
  if (currentRequest.rows.length === 0) {
    throw new NotFoundError('Request', id);
  }

  const oldRequesterName = currentRequest.rows[0].created_by_name;

  // Update the request with new requester
  const result = await query(`
    UPDATE requests
    SET created_by = $1, created_by_name = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `, [newRequester.id, newRequester.name, id]);

  // Log activity
  if (userId) {
    await query(`
      INSERT INTO activity_log (request_id, user_id, action, details)
      VALUES ($1, $2, $3, $4::jsonb)
    `, [id, userId, 'requester_changed', JSON.stringify({
      oldRequester: oldRequesterName,
      newRequester: newRequester.name,
      changedBy: userName
    })]);
  }

  // Log audit trail
  await logRequestAudit(
    req,
    AuditAction.UPDATE_REQUEST,
    EntityType.REQUEST,
    parseInt(id),
    {
      field: 'requester',
      oldRequester: oldRequesterName,
      newRequester: newRequester.name,
    }
  );

  res.json({ request: toCamelCase(result.rows[0]) });
});

/**
 * Review a discussion request (Manager only)
 *
 * Manager can approve, deny, or override the engineer's hour suggestion.
 * Handles hour reallocation automatically based on the decision.
 *
 * @param req.params.id - The discussion request UUID
 * @param req.body.action - 'approve' | 'deny' | 'override'
 * @param req.body.managerResponse - Optional response message
 * @param req.body.allocatedHours - Required for 'override' action
 * @returns message, allocatedHours - Result of the review
 * @throws ValidationError if insufficient project hours for approval
 * @throws NotFoundError if discussion request doesn't exist
 */
export const reviewDiscussionRequest = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, managerResponse, allocatedHours } = req.body; // action: 'approve', 'deny', 'override'
  const userId = req.user?.userId;
  const userName = req.user?.name || 'Unknown';

  // Get the discussion request
  const drResult = await query(
    'SELECT * FROM discussion_requests WHERE id = $1',
    [id]
  );

  if (drResult.rows.length === 0) {
    throw new NotFoundError('Discussion request', id);
  }

  const discussionRequest = drResult.rows[0];

  // Get the current request to check project and current allocation
  const requestResult = await query(
    'SELECT project_id, allocated_hours FROM requests WHERE id = $1',
    [discussionRequest.request_id]
  );

  if (requestResult.rows.length === 0) {
    throw new NotFoundError('Request', discussionRequest.request_id);
  }

  const { project_id: projectId, allocated_hours: currentAllocatedHours } = requestResult.rows[0];

  let status = 'Pending';
  let finalHours = discussionRequest.suggested_hours;

  if (action === 'approve') {
    status = 'Approved';
    finalHours = discussionRequest.suggested_hours;
  } else if (action === 'deny') {
    status = 'Denied';
    finalHours = null; // Keep original hours
  } else if (action === 'override') {
    status = 'Override';
    finalHours = allocatedHours;
  }

  // Handle hour adjustments if hours are changing
  if ((action === 'approve' || action === 'override') && projectId && finalHours !== null) {
    const hoursDifference = finalHours - (currentAllocatedHours || 0);

    if (hoursDifference !== 0) {
      if (hoursDifference > 0) {
        // Need more hours - allocate additional
        const availability = await validateHourAvailability(projectId, hoursDifference);
        if (!availability.available) {
          throw new ValidationError(
            `Insufficient project hours for discussion approval. Available: ${availability.currentAvailable}h, Additional needed: ${hoursDifference}h`,
            {
              availableHours: availability.currentAvailable,
              additionalNeeded: hoursDifference,
            }
          );
        }

        const allocResult = await allocateHoursToRequest(
          projectId,
          discussionRequest.request_id,
          hoursDifference,
          userId,
          userName
        );

        if (!allocResult.success) {
          throw new ValidationError(allocResult.error || 'Failed to allocate additional hours');
        }

        logger.info(`Discussion ${action}: Allocated additional ${hoursDifference}h to request ${discussionRequest.request_id}`);
      } else {
        // Returning hours - deallocate
        const deallocResult = await deallocateHoursFromRequest(
          projectId,
          discussionRequest.request_id,
          Math.abs(hoursDifference),
          userId,
          userName,
          `Discussion ${action}: Hours reduced from ${currentAllocatedHours}h to ${finalHours}h`
        );

        if (deallocResult.success) {
          logger.info(`Discussion ${action}: Returned ${Math.abs(hoursDifference)}h from request ${discussionRequest.request_id}`);
        }
      }
    }
  }

  // Update the discussion request
  await query(`
    UPDATE discussion_requests
    SET status = $1, reviewed_by = $2, manager_response = $3,
        allocated_hours = $4, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = $5
  `, [status, userId, managerResponse || null, finalHours, id]);

  // Update the request: set status back to Engineering Review and update hours if approved/override
  if (action === 'approve' || action === 'override') {
    await query(`
      UPDATE requests
      SET estimated_hours = $1, allocated_hours = $1,
          status = 'Engineering Review', updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [finalHours, discussionRequest.request_id]);
  } else if (action === 'deny') {
    // Denied - go back to Engineering Review with original hours
    await query(`
      UPDATE requests
      SET status = 'Engineering Review', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [discussionRequest.request_id]);
  }

  // Log activity
  await query(`
    INSERT INTO activity_log (request_id, user_id, action, details)
    VALUES ($1, $2, $3, $4::jsonb)
  `, [
    discussionRequest.request_id,
    userId,
    `discussion_${action}`,
    JSON.stringify({ allocatedHours: finalHours, response: managerResponse })
  ]);

  // Audit log
  const auditAction = action === 'approve' || action === 'override'
    ? AuditAction.APPROVE_DISCUSSION
    : AuditAction.REJECT_DISCUSSION;

  await logRequestAudit(
    req,
    auditAction,
    EntityType.DISCUSSION,
    parseInt(id),
    {
      requestId: discussionRequest.request_id,
      action,
      allocatedHours: finalHours,
      managerResponse,
    }
  );

  res.json({ message: `Discussion request ${action}ed`, allocatedHours: finalHours });
});
