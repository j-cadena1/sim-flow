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
router.get('/', getAllProjects);
router.get('/metrics', getAllProjectsWithMetrics); // Get all projects with health metrics
router.get('/near-deadline', getProjectsApproachingDeadline); // Get projects approaching deadline
router.get('/:id', getProjectById);
router.get('/:id/metrics', getProjectHealthMetrics); // Get single project health metrics
router.get('/:id/hours/history', getProjectHourTransactions); // Get hour transaction history
router.get('/:id/transitions', getProjectValidTransitions); // Get valid status transitions
router.get('/:id/history', getProjectHistory); // Get status change history
router.get('/:id/can-accept', checkProjectAcceptance); // Check if project can accept requests

// Manager/Admin only routes
router.post('/', requireRole(['Manager', 'Admin']), createProject);
router.patch('/:id/name', requireRole(['Manager', 'Admin']), updateProjectName);
router.patch('/:id/status', requireRole(['Manager', 'Admin']), updateProjectStatus);
router.patch('/:id/hours', requireRole(['Manager', 'Admin']), updateProjectHours);
router.post('/:id/hours/extend', requireRole(['Manager', 'Admin']), extendProjectBudget); // Extend project budget
router.post('/:id/hours/adjust', requireRole(['Manager', 'Admin']), manualHourAdjustment); // Manual hour adjustment
router.delete('/:id', requireRole(['Admin', 'Manager']), deleteProject);
router.post('/:id/requests/reassign', requireRole(['Admin', 'Manager']), reassignProjectRequests); // Reassign requests to another project
router.delete('/:id/requests', requireRole(['Admin', 'Manager']), deleteProjectRequests); // Delete all project requests

// Admin only routes
router.post('/expire-overdue', requireRole(['Admin']), expireOverdueProjects); // Trigger expiration check

export default router;
