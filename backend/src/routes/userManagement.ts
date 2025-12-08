import { Router } from 'express';
import { requireRole } from '../middleware/authorization';
import {
  getAllUsersManagement,
  updateUserRole,
  syncUserFromEntraID,
  getEntraIDDirectoryUsers,
  bulkImportUsers,
  deactivateUser,
  restoreUser,
  permanentlyDeleteUser,
  getDeletedUserInfo,
  batchGetDeletedUsers,
  changeQAdminPassword,
} from '../controllers/userManagementController';

const router = Router();

/**
 * GET /api/users/management
 * Get all users with their auth source and sync status
 * Query params: ?includeDeactivated=true to include soft-deleted users
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
 * GET /api/users/management/deleted/:id
 * Get archived info for a permanently deleted user
 * Used for tooltips on anonymized records
 * Admin only
 */
router.get('/deleted/:id', requireRole(['Admin']), getDeletedUserInfo);

/**
 * POST /api/users/management/deleted/batch
 * Batch lookup archived info for multiple deleted users
 * Body: { ids: string[] }
 * Admin only
 */
router.post('/deleted/batch', requireRole(['Admin']), batchGetDeletedUsers);

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
 * POST /api/users/management/:id/deactivate
 * Soft delete - user cannot login but data is preserved
 * Admin only
 */
router.post('/:id/deactivate', requireRole(['Admin']), deactivateUser);

/**
 * POST /api/users/management/:id/restore
 * Restore a deactivated user
 * Admin only
 */
router.post('/:id/restore', requireRole(['Admin']), restoreUser);

/**
 * DELETE /api/users/management/:id
 * Permanently delete a user (hard delete)
 * Requires body: { confirmEmail: string, reason?: string }
 * Archives user info before deletion for historical reference
 * Admin only
 */
router.delete('/:id', requireRole(['Admin']), permanentlyDeleteUser);

/**
 * POST /api/users/management/change-qadmin-password
 * Change password for qAdmin local account
 * Body: { currentPassword?: string, newPassword: string }
 * - qAdmin must provide currentPassword
 * - Other Admins can change without currentPassword
 * Admin only
 */
router.post('/change-qadmin-password', requireRole(['Admin']), changeQAdminPassword);

export default router;
