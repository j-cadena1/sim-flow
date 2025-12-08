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

// All user management endpoints require Admin role

/**
 * @swagger
 * /user-management:
 *   get:
 *     summary: Get all users with management information (Admin only)
 *     tags: [User Management]
 *     description: Returns list of all users including auth source, sync status, and optionally deactivated users
 *     parameters:
 *       - in: query
 *         name: includeDeactivated
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include soft-deleted users in the response
 *     responses:
 *       200:
 *         description: List of users with management details
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   email:
 *                     type: string
 *                     format: email
 *                   name:
 *                     type: string
 *                   role:
 *                     type: string
 *                     enum: [Admin, Manager, Engineer, User]
 *                   deletedAt:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       403:
 *         description: Requires Admin role
 */
router.get('/', requireRole(['Admin']), getAllUsersManagement);

/**
 * @swagger
 * /user-management/directory:
 *   get:
 *     summary: Get users from Microsoft Entra ID directory (Admin only)
 *     tags: [User Management]
 *     description: Fetches list of users from configured Entra ID tenant with import status
 *     responses:
 *       200:
 *         description: List of directory users with import status
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   displayName:
 *                     type: string
 *                   mail:
 *                     type: string
 *                     format: email
 *                   userPrincipalName:
 *                     type: string
 *                   imported:
 *                     type: boolean
 *                     description: Whether user already exists in SimRQ
 *       400:
 *         description: SSO not configured
 *       403:
 *         description: Requires Admin role
 *       500:
 *         description: Failed to fetch directory users
 */
router.get('/directory', requireRole(['Admin']), getEntraIDDirectoryUsers);

/**
 * @swagger
 * /user-management/deleted/{id}:
 *   get:
 *     summary: Get deleted user information by ID (Admin only)
 *     tags: [User Management]
 *     description: Retrieves archived information about a permanently deleted user (used for tooltips on anonymized records)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Original user ID (before deletion)
 *     responses:
 *       200:
 *         description: Deleted user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 originalEmail:
 *                   type: string
 *                 originalName:
 *                   type: string
 *                 originalRole:
 *                   type: string
 *                 deletedAt:
 *                   type: string
 *                   format: date-time
 *                 deletedBy:
 *                   type: string
 *                   format: uuid
 *       403:
 *         description: Requires Admin role
 *       404:
 *         description: Deleted user not found
 */
router.get('/deleted/:id', requireRole(['Admin']), getDeletedUserInfo);

/**
 * @swagger
 * /user-management/deleted/batch:
 *   post:
 *     summary: Batch lookup deleted users by IDs (Admin only)
 *     tags: [User Management]
 *     description: Retrieves archived information for multiple deleted users at once
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of original user IDs to look up
 *     responses:
 *       200:
 *         description: Map of user IDs to deleted user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties:
 *                   originalEmail:
 *                     type: string
 *                   originalName:
 *                     type: string
 *                   originalRole:
 *                     type: string
 *                   deletedAt:
 *                     type: string
 *                     format: date-time
 *       403:
 *         description: Requires Admin role
 */
router.post('/deleted/batch', requireRole(['Admin']), batchGetDeletedUsers);

/**
 * @swagger
 * /user-management/{id}/role:
 *   patch:
 *     summary: Update user role (Admin only)
 *     tags: [User Management]
 *     description: Changes a user's role (cannot modify qAdmin account)
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
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [Admin, Manager, Engineer, User]
 *     responses:
 *       200:
 *         description: User role updated
 *       400:
 *         description: Invalid role or cannot modify qAdmin
 *       403:
 *         description: Requires Admin role
 *       404:
 *         description: User not found
 */
router.patch('/:id/role', requireRole(['Admin']), updateUserRole);

/**
 * @swagger
 * /user-management/{id}/sync:
 *   post:
 *     summary: Sync user from Microsoft Entra ID directory (Admin only)
 *     tags: [User Management]
 *     description: Updates user's name and email from Entra ID directory
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User synced from directory
 *       400:
 *         description: SSO not configured or user not found in directory
 *       403:
 *         description: Requires Admin role
 *       404:
 *         description: User not found
 */
router.post('/:id/sync', requireRole(['Admin']), syncUserFromEntraID);

/**
 * @swagger
 * /user-management/import:
 *   post:
 *     summary: Bulk import users from Microsoft Entra ID directory (Admin only)
 *     tags: [User Management]
 *     description: Creates new users from Entra ID directory with specified role
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userIds, role]
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of Entra ID user IDs to import
 *               role:
 *                 type: string
 *                 enum: [Admin, Manager, Engineer, User]
 *                 default: User
 *     responses:
 *       201:
 *         description: Users imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imported:
 *                   type: integer
 *                   description: Number of users successfully imported
 *                 skipped:
 *                   type: integer
 *                   description: Number of users skipped (already exist)
 *       400:
 *         description: SSO not configured or invalid request
 *       403:
 *         description: Requires Admin role
 */
router.post('/import', requireRole(['Admin']), bulkImportUsers);

/**
 * @swagger
 * /user-management/{id}/deactivate:
 *   post:
 *     summary: Deactivate user (soft delete) (Admin only)
 *     tags: [User Management]
 *     description: Disables user account while preserving all data (cannot deactivate qAdmin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User deactivated
 *       400:
 *         description: Cannot deactivate qAdmin or already deactivated
 *       403:
 *         description: Requires Admin role
 *       404:
 *         description: User not found
 */
router.post('/:id/deactivate', requireRole(['Admin']), deactivateUser);

/**
 * @swagger
 * /user-management/{id}/restore:
 *   post:
 *     summary: Restore deactivated user (Admin only)
 *     tags: [User Management]
 *     description: Re-enables a previously deactivated user account
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User restored
 *       400:
 *         description: User is not deactivated
 *       403:
 *         description: Requires Admin role
 *       404:
 *         description: User not found
 */
router.post('/:id/restore', requireRole(['Admin']), restoreUser);

/**
 * @swagger
 * /user-management/{id}:
 *   delete:
 *     summary: Permanently delete user (Admin only)
 *     tags: [User Management]
 *     description: Removes user from database, archives identity in deleted_users table (cannot delete qAdmin)
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
 *             required: [confirmEmail]
 *             properties:
 *               confirmEmail:
 *                 type: string
 *                 format: email
 *                 description: User's email address for confirmation
 *               reason:
 *                 type: string
 *                 description: Optional reason for deletion
 *     responses:
 *       200:
 *         description: User permanently deleted
 *       400:
 *         description: Cannot delete qAdmin account or confirmation email mismatch
 *       403:
 *         description: Requires Admin role
 *       404:
 *         description: User not found
 */
router.delete('/:id', requireRole(['Admin']), permanentlyDeleteUser);

/**
 * @swagger
 * /user-management/change-qadmin-password:
 *   post:
 *     summary: Change qAdmin password (Admin only)
 *     tags: [User Management]
 *     description: |
 *       Updates password for the qadmin@simflow.local account.
 *       qAdmin must provide current password; other Admins can change without it.
 *
 *       **Password Requirements:**
 *       - Minimum 12 characters
 *       - At least one uppercase letter (A-Z)
 *       - At least one lowercase letter (a-z)
 *       - At least one number (0-9)
 *       - At least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)
 *       - Cannot contain common weak patterns (password, qwerty, 123456, admin, simflow)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: Required if logged in as qAdmin
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 12
 *                 description: Must meet complexity requirements (see description)
 *     responses:
 *       200:
 *         description: Password updated
 *       400:
 *         description: Current password incorrect or new password does not meet requirements
 *       403:
 *         description: Requires Admin role
 */
router.post('/change-qadmin-password', requireRole(['Admin']), changeQAdminPassword);

export default router;
