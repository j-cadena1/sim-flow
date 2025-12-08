import { Router } from 'express';
import { authenticate } from '../middleware/authorization';
import {
  getNotificationsController,
  getUnreadCountController,
  markAsReadController,
  markAllAsReadController,
  deleteNotificationController,
  deleteAllNotificationsController,
  getPreferencesController,
  updatePreferencesController,
} from '../controllers/notificationController';

const router = Router();

// All notification endpoints require authentication

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get user's notifications
 *     tags: [Notifications]
 *     description: Retrieve paginated list of notifications for the current user
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Only return unread notifications
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 100
 *         description: Number of notifications to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Pagination offset
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [REQUEST_ASSIGNED, REQUEST_STATUS_CHANGED, REQUEST_COMMENT_ADDED, APPROVAL_NEEDED, TIME_LOGGED, PROJECT_UPDATED, ADMIN_ACTION]
 *         description: Filter by notification type
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       type:
 *                         type: string
 *                       title:
 *                         type: string
 *                       message:
 *                         type: string
 *                       link:
 *                         type: string
 *                       read:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       triggeredByName:
 *                         type: string
 *                 total:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 */
router.get('/', authenticate, getNotificationsController);

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     description: Returns the count of unread notifications for the current user
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 */
router.get('/unread-count', authenticate, getUnreadCountController);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     description: Marks a specific notification as read
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Notification not found
 */
router.patch('/:id/read', authenticate, markAsReadController);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     description: Marks all unread notifications as read for the current user
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       401:
 *         description: Not authenticated
 */
router.patch('/read-all', authenticate, markAllAsReadController);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     description: Permanently delete a specific notification
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification deleted
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Notification not found
 */
router.delete('/:id', authenticate, deleteNotificationController);

/**
 * @swagger
 * /notifications:
 *   delete:
 *     summary: Delete all notifications
 *     tags: [Notifications]
 *     description: Permanently delete all notifications for the current user (Clear All)
 *     responses:
 *       200:
 *         description: All notifications deleted
 *       401:
 *         description: Not authenticated
 */
router.delete('/', authenticate, deleteAllNotificationsController);

/**
 * @swagger
 * /notifications/preferences:
 *   get:
 *     summary: Get notification preferences
 *     tags: [Notifications]
 *     description: Retrieve notification preferences for the current user
 *     responses:
 *       200:
 *         description: User notification preferences
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inAppEnabled:
 *                   type: boolean
 *                 emailEnabled:
 *                   type: boolean
 *                 emailDigestFrequency:
 *                   type: string
 *                   enum: [instant, hourly, daily, weekly, never]
 *                 requestAssigned:
 *                   type: boolean
 *                 requestStatusChanged:
 *                   type: boolean
 *                 requestCommentAdded:
 *                   type: boolean
 *                 approvalNeeded:
 *                   type: boolean
 *                 timeLogged:
 *                   type: boolean
 *                 projectUpdated:
 *                   type: boolean
 *                 adminAction:
 *                   type: boolean
 *                 retentionDays:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 */
router.get('/preferences', authenticate, getPreferencesController);

/**
 * @swagger
 * /notifications/preferences:
 *   patch:
 *     summary: Update notification preferences
 *     tags: [Notifications]
 *     description: Update notification preferences for the current user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inAppEnabled:
 *                 type: boolean
 *               emailEnabled:
 *                 type: boolean
 *               emailDigestFrequency:
 *                 type: string
 *                 enum: [instant, hourly, daily, weekly, never]
 *               requestAssigned:
 *                 type: boolean
 *               requestStatusChanged:
 *                 type: boolean
 *               requestCommentAdded:
 *                 type: boolean
 *               approvalNeeded:
 *                 type: boolean
 *               timeLogged:
 *                 type: boolean
 *               projectUpdated:
 *                 type: boolean
 *               adminAction:
 *                 type: boolean
 *               retentionDays:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *     responses:
 *       200:
 *         description: Preferences updated
 *       400:
 *         description: Invalid preferences
 *       401:
 *         description: Not authenticated
 */
router.patch('/preferences', authenticate, updatePreferencesController);

export default router;
