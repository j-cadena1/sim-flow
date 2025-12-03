import { Router } from 'express';
import { requireRole } from '../middleware/authorization';
import {
  getAllUsersManagement,
  updateUserRole,
  syncUserFromEntraID,
  getEntraIDDirectoryUsers,
  bulkImportUsers,
  deleteUser,
} from '../controllers/userManagementController';

const router = Router();

/**
 * GET /api/users/management
 * Get all users with their auth source and sync status
 * Admin only
 */
router.get('/', requireRole(['Admin']), getAllUsersManagement);

/**
 * GET /api/users/management/directory
 * Get all users from Entra ID directory with import status
 * Admin only
 */
router.get('/directory', requireRole(['Admin']), getEntraIDDirectoryUsers);

/**
 * PATCH /api/users/management/:id/role
 * Update a user's role
 * Admin only
 */
router.patch('/:id/role', requireRole(['Admin']), updateUserRole);

/**
 * POST /api/users/management/:id/sync
 * Sync a user's information from Entra ID directory
 * Admin only
 */
router.post('/:id/sync', requireRole(['Admin']), syncUserFromEntraID);

/**
 * POST /api/users/management/import
 * Bulk import users from Entra ID directory
 * Admin only
 */
router.post('/import', requireRole(['Admin']), bulkImportUsers);

/**
 * DELETE /api/users/management/:id
 * Delete a user
 * Admin only
 */
router.delete('/:id', requireRole(['Admin']), deleteUser);

export default router;
