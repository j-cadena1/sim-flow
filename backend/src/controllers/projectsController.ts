import { Request, Response } from 'express';
import { query, getClient } from '../db';
import { logger } from '../middleware/logger';
import { toCamelCase } from '../utils/caseConverter';
import { logRequestAudit, AuditAction, EntityType } from '../services/auditService';

// Get all projects
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

// Get project by ID
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

// Create new project
export const createProject = async (req: Request, res: Response) => {
  try {
    const { name, totalHours, createdBy, createdByName, status } = req.body;

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

    // Default status: Manager creates as 'Approved', User creates as 'Pending'
    const projectStatus = status || 'Pending';

    const result = await query(
      `INSERT INTO projects (name, code, total_hours, used_hours, status, created_by, created_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, code, totalHours, 0, projectStatus, createdBy, createdByName]
    );

    const project = toCamelCase(result.rows[0]) as any;
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

// Update project name (managers/admins only)
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

// Update project status (approve/archive)
export const updateProjectStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['Pending', 'Approved', 'Archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await query(
      'UPDATE projects SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = toCamelCase(result.rows[0]);
    logger.info(`Updated project ${id} status to ${status}`);

    // Audit log - use specific action for archiving
    const auditAction = status === 'Archived'
      ? AuditAction.ARCHIVE_PROJECT
      : AuditAction.UPDATE_PROJECT;

    await logRequestAudit(
      req,
      auditAction,
      EntityType.PROJECT,
      parseInt(id),
      { status }
    );

    res.json({ project });
  } catch (error) {
    logger.error('Error updating project status:', error);
    res.status(500).json({ error: 'Failed to update project status' });
  }
};

// Update project hours (when allocating to a request)
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

// Delete project (hard delete)
export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if project has any requests associated with it
    const requestsResult = await query(
      'SELECT COUNT(*) as count FROM requests WHERE project_id = $1',
      [id]
    );

    if (parseInt(requestsResult.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete project with associated requests. Archive it instead.'
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
