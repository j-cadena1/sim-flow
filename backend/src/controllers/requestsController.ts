import { Request, Response } from 'express';
import { query } from '../db';
import { logger } from '../middleware/logger';

// Get all requests
export const getAllRequests = async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT * FROM requests
      ORDER BY created_at DESC
    `);

    res.json({ requests: result.rows });
  } catch (error) {
    logger.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
};

// Get single request with comments
export const getRequestById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const requestResult = await query(
      'SELECT * FROM requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const commentsResult = await query(
      'SELECT * FROM comments WHERE request_id = $1 ORDER BY created_at ASC',
      [id]
    );

    res.json({
      request: requestResult.rows[0],
      comments: commentsResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching request:', error);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
};

// Create new request
export const createRequest = async (req: Request, res: Response) => {
  try {
    const { title, description, vendor, priority } = req.body;
    const userId = req.headers['x-user-id'] as string;
    const userName = req.headers['x-user-name'] as string || 'qAdmin';

    const result = await query(`
      INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [title, description, vendor, priority, 'Submitted', userId || null, userName]);

    // Log activity
    if (userId) {
      await query(`
        INSERT INTO activity_log (request_id, user_id, action, details)
        VALUES ($1, $2, $3, $4)
      `, [result.rows[0].id, userId, 'created', { title }]);
    }

    res.status(201).json({ request: result.rows[0] });
  } catch (error) {
    logger.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to create request' });
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
        VALUES ($1, $2, $3, $4)
      `, [id, userId, 'status_changed', { status }]);
    }

    res.json({ request: result.rows[0] });
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
          status = 'Engineering Review', updated_at = CURRENT_TIMESTAMP
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
        VALUES ($1, $2, $3, $4)
      `, [id, userId, 'assigned', { engineerId, engineerName, estimatedHours }]);
    }

    res.json({ request: result.rows[0] });
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

    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};
