import express from 'express';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProjectName,
  updateProjectStatus,
  updateProjectHours,
  deleteProject,
  getProjectHourTransactions,
  extendProjectBudget,
  manualHourAdjustment,
  getProjectHealthMetrics,
  getAllProjectsWithMetrics,
  getProjectValidTransitions,
  getProjectHistory,
  expireOverdueProjects,
  getProjectsApproachingDeadline,
  checkProjectAcceptance,
  reassignProjectRequests,
  deleteProjectRequests,
} from '../controllers/projectsController';
import { requireRole } from '../middleware/authorization';

const router = express.Router();

// Public routes (all authenticated users can view)

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: Get all projects
 *     tags: [Projects]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Approved, Active, On Hold, Suspended, Completed, Cancelled, Archived]
 *         description: Filter by project status
 *     responses:
 *       200:
 *         description: List of projects
 */
router.get('/', getAllProjects);

/**
 * @swagger
 * /projects/metrics:
 *   get:
 *     summary: Get all projects with health metrics
 *     tags: [Projects]
 *     description: Returns projects with hour utilization, remaining budget, and deadline status
 *     responses:
 *       200:
 *         description: List of projects with metrics
 */
router.get('/metrics', getAllProjectsWithMetrics);

/**
 * @swagger
 * /projects/near-deadline:
 *   get:
 *     summary: Get projects approaching deadline
 *     tags: [Projects]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 14
 *         description: Number of days threshold
 *     responses:
 *       200:
 *         description: List of projects nearing deadline
 */
router.get('/near-deadline', getProjectsApproachingDeadline);

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get a specific project by ID
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project details
 *       404:
 *         description: Project not found
 */
router.get('/:id', getProjectById);

/**
 * @swagger
 * /projects/{id}/metrics:
 *   get:
 *     summary: Get health metrics for a specific project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project health metrics (utilization, remaining budget, etc.)
 */
router.get('/:id/metrics', getProjectHealthMetrics);

/**
 * @swagger
 * /projects/{id}/hours/history:
 *   get:
 *     summary: Get hour transaction history for a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of hour allocations, extensions, and adjustments
 */
router.get('/:id/hours/history', getProjectHourTransactions);

/**
 * @swagger
 * /projects/{id}/transitions:
 *   get:
 *     summary: Get valid status transitions for a project
 *     tags: [Projects]
 *     description: Returns which status transitions are allowed based on current project state
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of valid status transitions
 */
router.get('/:id/transitions', getProjectValidTransitions);

/**
 * @swagger
 * /projects/{id}/history:
 *   get:
 *     summary: Get status change history for a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of status changes with timestamps and reasons
 */
router.get('/:id/history', getProjectHistory);

/**
 * @swagger
 * /projects/{id}/can-accept:
 *   get:
 *     summary: Check if project can accept new requests
 *     tags: [Projects]
 *     description: Validates project status and hour budget availability
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Boolean indicating if project can accept requests
 */
router.get('/:id/can-accept', checkProjectAcceptance);

// Manager/Admin only routes

/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a new project (Manager/Admin only)
 *     tags: [Projects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, totalHours, priority]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               description:
 *                 type: string
 *               totalHours:
 *                 type: number
 *                 minimum: 1
 *               priority:
 *                 type: string
 *                 enum: [Low, Medium, High]
 *               category:
 *                 type: string
 *               deadline:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Project created
 *       400:
 *         description: Validation error
 *       403:
 *         description: Requires Manager or Admin role
 */
router.post('/', requireRole(['Manager', 'Admin']), createProject);

/**
 * @swagger
 * /projects/{id}/name:
 *   patch:
 *     summary: Update project name (Manager/Admin only)
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *     responses:
 *       200:
 *         description: Project name updated
 *       403:
 *         description: Requires Manager or Admin role
 */
router.patch('/:id/name', requireRole(['Manager', 'Admin']), updateProjectName);

/**
 * @swagger
 * /projects/{id}/status:
 *   patch:
 *     summary: Update project status (Manager/Admin only)
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Pending, Approved, Active, On Hold, Suspended, Completed, Cancelled, Archived]
 *               reason:
 *                 type: string
 *                 description: Required for certain status transitions (e.g., On Hold, Suspended)
 *     responses:
 *       200:
 *         description: Project status updated
 *       400:
 *         description: Invalid status transition or missing reason
 *       403:
 *         description: Requires Manager or Admin role
 */
router.patch('/:id/status', requireRole(['Manager', 'Admin']), updateProjectStatus);

/**
 * @swagger
 * /projects/{id}/hours:
 *   patch:
 *     summary: Update project total hours (Manager/Admin only)
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [totalHours]
 *             properties:
 *               totalHours:
 *                 type: number
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Project hours updated
 *       403:
 *         description: Requires Manager or Admin role
 */
router.patch('/:id/hours', requireRole(['Manager', 'Admin']), updateProjectHours);

/**
 * @swagger
 * /projects/{id}/hours/extend:
 *   post:
 *     summary: Extend project hour budget (Manager/Admin only)
 *     tags: [Projects]
 *     description: Add additional hours to project budget with tracking
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hours, reason]
 *             properties:
 *               hours:
 *                 type: number
 *                 minimum: 1
 *               reason:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       200:
 *         description: Project budget extended
 *       403:
 *         description: Requires Manager or Admin role
 */
router.post('/:id/hours/extend', requireRole(['Manager', 'Admin']), extendProjectBudget);

/**
 * @swagger
 * /projects/{id}/hours/adjust:
 *   post:
 *     summary: Manual hour adjustment (Manager/Admin only)
 *     tags: [Projects]
 *     description: Adjust used hours (can be positive or negative) with audit trail
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hours, reason]
 *             properties:
 *               hours:
 *                 type: number
 *                 description: Positive to add, negative to subtract
 *               reason:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       200:
 *         description: Hours adjusted
 *       403:
 *         description: Requires Manager or Admin role
 */
router.post('/:id/hours/adjust', requireRole(['Manager', 'Admin']), manualHourAdjustment);

/**
 * @swagger
 * /projects/{id}:
 *   delete:
 *     summary: Delete a project (Manager/Admin only)
 *     tags: [Projects]
 *     description: Delete project if no requests are associated, otherwise returns conflict
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project deleted
 *       403:
 *         description: Requires Manager or Admin role
 *       409:
 *         description: Project has associated requests (must reassign or delete first)
 */
router.delete('/:id', requireRole(['Admin', 'Manager']), deleteProject);

/**
 * @swagger
 * /projects/{id}/requests/reassign:
 *   post:
 *     summary: Reassign all requests to another project (Manager/Admin only)
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetProjectId]
 *             properties:
 *               targetProjectId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Requests reassigned
 *       403:
 *         description: Requires Manager or Admin role
 */
router.post('/:id/requests/reassign', requireRole(['Admin', 'Manager']), reassignProjectRequests);

/**
 * @swagger
 * /projects/{id}/requests:
 *   delete:
 *     summary: Delete all requests associated with project (Manager/Admin only)
 *     tags: [Projects]
 *     description: WARNING - Permanently deletes all requests in this project
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: All project requests deleted
 *       403:
 *         description: Requires Manager or Admin role
 */
router.delete('/:id/requests', requireRole(['Admin', 'Manager']), deleteProjectRequests);

// Admin only routes

/**
 * @swagger
 * /projects/expire-overdue:
 *   post:
 *     summary: Trigger expiration check for overdue projects (Admin only)
 *     tags: [Projects]
 *     description: Manually trigger the process to mark overdue projects
 *     responses:
 *       200:
 *         description: Expiration check completed
 *       403:
 *         description: Requires Admin role
 */
router.post('/expire-overdue', requireRole(['Admin']), expireOverdueProjects);

export default router;
