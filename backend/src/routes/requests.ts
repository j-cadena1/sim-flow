import { Router } from 'express';
import {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequestTitle,
  updateRequestDescription,
  requestTitleChange,
  getPendingTitleChangeRequests,
  getTitleChangeRequestsForRequest,
  reviewTitleChangeRequest,
  updateRequestStatus,
  assignEngineer,
  addComment,
  deleteRequest,
  getTimeEntries,
  addTimeEntry,
  createDiscussionRequest,
  getDiscussionRequestsForRequest,
  reviewDiscussionRequest,
  updateRequestRequester,
} from '../controllers/requestsController';
import {
  validate,
  createRequestSchema,
  updateStatusSchema,
  assignEngineerSchema,
  addCommentSchema,
} from '../middleware/validation';
import { authenticate } from '../middleware/authentication';
import { requireRole } from '../middleware/authorization';

const router = Router();

/**
 * @swagger
 * /requests:
 *   get:
 *     summary: Get all simulation requests
 *     tags: [Requests]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by assigned engineer
 *     responses:
 *       200:
 *         description: List of requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Request'
 */
router.get('/', authenticate, getAllRequests);

/**
 * @swagger
 * /requests/{id}:
 *   get:
 *     summary: Get a specific request by ID
 *     tags: [Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Request details with comments and activity
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Request'
 *                 - type: object
 *                   properties:
 *                     comments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Comment'
 *       404:
 *         description: Request not found
 */
router.get('/:id', authenticate, getRequestById);

/**
 * @swagger
 * /requests:
 *   post:
 *     summary: Create a new simulation request
 *     tags: [Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, vendor, priority]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 minLength: 1
 *               vendor:
 *                 type: string
 *                 enum: [FANUC, Siemens, ABB, Yaskawa, KUKA, Other]
 *               priority:
 *                 type: string
 *                 enum: [Low, Medium, High]
 *     responses:
 *       201:
 *         description: Request created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Request'
 *       400:
 *         description: Validation error
 */
router.post('/', authenticate, validate(createRequestSchema), createRequest);

/**
 * @swagger
 * /requests/{id}/comments:
 *   post:
 *     summary: Add a comment to a request
 *     tags: [Requests]
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
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       201:
 *         description: Comment added
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 */
router.post('/:id/comments', authenticate, validate(addCommentSchema), addComment);

/**
 * @swagger
 * /requests/{id}/status:
 *   patch:
 *     summary: Update request status
 *     tags: [Requests]
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
 *                 enum: [Submitted, Feasibility Review, Resource Allocation, Engineering Review, Discussion, In Progress, Completed, Revision Requested, Accepted, Denied]
 *     responses:
 *       200:
 *         description: Status updated
 *       403:
 *         description: Not authorized for this status transition
 */
router.patch('/:id/status', authenticate, validate(updateStatusSchema), updateRequestStatus);

/**
 * @swagger
 * /requests/{id}/assign:
 *   patch:
 *     summary: Assign an engineer to a request
 *     tags: [Requests]
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
 *             required: [engineerId]
 *             properties:
 *               engineerId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Engineer assigned
 *       403:
 *         description: Requires Manager or Admin role
 */
router.patch('/:id/assign', requireRole(['Manager', 'Admin']), validate(assignEngineerSchema), assignEngineer);

/**
 * @swagger
 * /requests/{id}:
 *   delete:
 *     summary: Delete a request
 *     tags: [Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Request deleted
 *       403:
 *         description: Requires Admin or Manager role
 *       404:
 *         description: Request not found
 */
router.delete('/:id', requireRole(['Admin', 'Manager']), deleteRequest);

// Title change routes
router.get('/:id/title-change-requests', authenticate, getTitleChangeRequestsForRequest);
router.post('/:id/title-change-request', authenticate, requestTitleChange);
router.get('/title-change-requests/pending', requireRole(['Manager', 'Admin']), getPendingTitleChangeRequests);
router.patch('/:id/title', requireRole(['Manager', 'Admin']), updateRequestTitle);
router.patch('/:id/description', authenticate, updateRequestDescription);
router.patch('/title-change-requests/:id/review', requireRole(['Manager', 'Admin']), reviewTitleChangeRequest);

// Time tracking routes
router.get('/:id/time', authenticate, getTimeEntries);
router.post('/:id/time', requireRole(['Engineer', 'Admin']), addTimeEntry);

// Discussion routes
router.get('/:id/discussion-requests', authenticate, getDiscussionRequestsForRequest);
router.post('/:id/discussion-request', requireRole(['Engineer', 'Admin']), createDiscussionRequest);
router.patch('/discussion-requests/:id/review', requireRole(['Manager', 'Admin']), reviewDiscussionRequest);

// Admin-only route to change request requester
router.patch('/:id/requester', requireRole(['Admin']), updateRequestRequester);

export default router;
