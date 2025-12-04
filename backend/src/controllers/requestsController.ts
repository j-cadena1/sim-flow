import { Request, Response } from 'express';
import { query } from '../db';
import { logger } from '../middleware/logger';
import { toCamelCase } from '../utils/caseConverter';
import { logRequestAudit, AuditAction, EntityType } from '../services/auditService';

// Get all requests
export const getAllRequests = async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT
        r.*,
        p.name as project_name,
        p.code as project_code
      FROM requests r
      LEFT JOIN projects p ON r.project_id = p.id
      ORDER BY r.created_at DESC
    `);

    res.json({ requests: toCamelCase(result.rows) });
  } catch (error) {
    logger.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
};

// Get single request with comments
export const getRequestById = async (req: Request, res: Response) => {
  try {
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
      return res.status(404).json({ error: 'Request not found' });
    }

    const commentsResult = await query(
      'SELECT * FROM comments WHERE request_id = $1 ORDER BY created_at ASC',
      [id]
    );

    res.json({
      request: toCamelCase(requestResult.rows[0]),
      comments: toCamelCase(commentsResult.rows),
    });
  } catch (error) {
    logger.error('Error fetching request:', error);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
};

// Create new request
export const createRequest = async (req: Request, res: Response) => {
  try {
    const { title, description, vendor, priority, projectId } = req.body;
    const userId = req.headers['x-user-id'] as string;
    const userName = req.headers['x-user-name'] as string || 'qAdmin';

    const result = await query(`
      INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, project_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [title, description, vendor, priority, 'Submitted', userId || null, userName, projectId || null]);

    // Log activity
    if (userId) {
      await query(`
        INSERT INTO activity_log (request_id, user_id, action, details)
        VALUES ($1, $2, $3, $4)
      `, [result.rows[0].id, userId, 'created', { title }]);
    }

    // Log audit trail
    await logRequestAudit(
      req,
      AuditAction.CREATE_REQUEST,
      EntityType.REQUEST,
      result.rows[0].id,
      { title, vendor, priority, projectId }
    );

    res.status(201).json({ request: toCamelCase(result.rows[0]) });
  } catch (error) {
    logger.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
};

// Update request title (for admins/managers/owners only)
export const updateRequestTitle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!title || title.trim().length < 3) {
      return res.status(400).json({ error: 'Title must be at least 3 characters' });
    }

    const result = await query(`
      UPDATE requests
      SET title = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [title.trim(), id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Log activity
    if (userId) {
      await query(`
        INSERT INTO activity_log (request_id, user_id, action, details)
        VALUES ($1, $2, $3, $4::jsonb)
      `, [id, userId, 'title_changed', JSON.stringify({ title })]);
    }

    res.json({ request: toCamelCase(result.rows[0]) });
  } catch (error) {
    logger.error('Error updating request title:', error);
    res.status(500).json({ error: 'Failed to update request title' });
  }
};

// Request title change (for engineers - requires approval)
export const requestTitleChange = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { proposedTitle } = req.body;
    const userId = req.headers['x-user-id'] as string;
    const userName = req.headers['x-user-name'] as string || 'Unknown';

    if (!proposedTitle || proposedTitle.trim().length < 3) {
      return res.status(400).json({ error: 'Title must be at least 3 characters' });
    }

    // Get current request
    const requestResult = await query('SELECT * FROM requests WHERE id = $1', [id]);
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const currentTitle = requestResult.rows[0].title;

    // Create title change request
    const result = await query(`
      INSERT INTO title_change_requests
        (request_id, requested_by, requested_by_name, current_title, proposed_title, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [id, userId, userName, currentTitle, proposedTitle.trim(), 'Pending']);

    res.status(201).json({ titleChangeRequest: toCamelCase(result.rows[0]) });
  } catch (error) {
    logger.error('Error requesting title change:', error);
    res.status(500).json({ error: 'Failed to request title change' });
  }
};

// Get pending title change requests
export const getPendingTitleChangeRequests = async (req: Request, res: Response) => {
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

// Get title change requests for a specific request
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

// Approve or deny title change request
export const reviewTitleChangeRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    const userId = req.headers['x-user-id'] as string;
    const userName = req.headers['x-user-name'] as string || 'Unknown';

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
    `, [status, userId, userName, id]);

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

    res.json({ message: `Title change ${status.toLowerCase()}` });
  } catch (error) {
    logger.error('Error reviewing title change request:', error);
    res.status(500).json({ error: 'Failed to review title change request' });
  }
};

// Update request status
export const updateRequestStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.headers['x-user-id'] as string;

    const result = await query(`
      UPDATE requests
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
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
  } catch (error) {
    logger.error('Error updating request status:', error);
    res.status(500).json({ error: 'Failed to update request status' });
  }
};

// Assign engineer
export const assignEngineer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { engineerId, estimatedHours } = req.body;
    const userId = req.headers['x-user-id'] as string;

    // Get engineer name
    const engineerResult = await query(
      'SELECT name FROM users WHERE id = $1',
      [engineerId]
    );

    if (engineerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Engineer not found' });
    }

    const engineerName = engineerResult.rows[0].name;

    const result = await query(`
      UPDATE requests
      SET assigned_to = $1, assigned_to_name = $2, estimated_hours = $3,
          allocated_hours = $3, status = 'Engineering Review', updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [engineerId, engineerName, estimatedHours, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
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
  } catch (error) {
    logger.error('Error assigning engineer:', error);
    res.status(500).json({ error: 'Failed to assign engineer' });
  }
};

// Add comment
export const addComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.headers['x-user-id'] as string;
    const userName = req.headers['x-user-name'] as string || 'qAdmin';
    const userRole = req.headers['x-user-role'] as string || 'Admin';

    const result = await query(`
      INSERT INTO comments (request_id, author_id, author_name, author_role, content)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, userId || null, userName, userRole, content]);

    res.status(201).json({ comment: toCamelCase(result.rows[0]) });
  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

// Delete request (admins/managers only)
export const deleteRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // First delete related comments
    await query('DELETE FROM comments WHERE request_id = $1', [id]);

    // Then delete the request
    const result = await query('DELETE FROM requests WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ message: 'Request deleted successfully', id: result.rows[0].id });
  } catch (error) {
    logger.error('Error deleting request:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
};

// Get time entries for a request
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

// Add time entry to a request
export const addTimeEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { hours, description } = req.body;
    const userId = req.headers['x-user-id'] as string;
    const userName = req.headers['x-user-name'] as string || 'Unknown';

    const result = await query(`
      INSERT INTO time_entries (request_id, engineer_id, engineer_name, hours, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, userId || null, userName, hours, description || '']);

    res.status(201).json({ timeEntry: toCamelCase(result.rows[0]) });
  } catch (error) {
    logger.error('Error adding time entry:', error);
    res.status(500).json({ error: 'Failed to add time entry' });
  }
};

// Create discussion request (engineer requests discussion with revised hours)
export const createDiscussionRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, suggestedHours } = req.body;
    const userId = req.headers['x-user-id'] as string;
    const userName = req.headers['x-user-name'] as string || 'Unknown';

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: 'Reason must be at least 5 characters' });
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
    `, [id, userId, 'discussion_requested', JSON.stringify({ reason, suggestedHours })]);

    res.status(201).json({ discussionRequest: toCamelCase(result.rows[0]) });
  } catch (error) {
    logger.error('Error creating discussion request:', error);
    res.status(500).json({ error: 'Failed to create discussion request' });
  }
};

// Get discussion requests for a specific request
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

// Review discussion request (manager approves/denies/overrides)
export const reviewDiscussionRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, managerResponse, allocatedHours } = req.body; // action: 'approve', 'deny', 'override'
    const userId = req.headers['x-user-id'] as string;
    const userName = req.headers['x-user-name'] as string || 'Unknown';

    // Get the discussion request
    const drResult = await query(
      'SELECT * FROM discussion_requests WHERE id = $1',
      [id]
    );

    if (drResult.rows.length === 0) {
      return res.status(404).json({ error: 'Discussion request not found' });
    }

    const discussionRequest = drResult.rows[0];
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

    res.json({ message: `Discussion request ${action}ed`, allocatedHours: finalHours });
  } catch (error) {
    logger.error('Error reviewing discussion request:', error);
    res.status(500).json({ error: 'Failed to review discussion request' });
  }
};
