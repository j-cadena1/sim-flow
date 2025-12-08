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
 *                 description: Comment text content
 *               visibleToRequester:
 *                 type: boolean
 *                 default: true
 *                 description: When false, comment is only visible to Engineers, Managers, and Admins (internal notes)
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
 *                 enum: [Submitted, Manager Review, Engineering Review, Discussion, In Progress, Completed, Revision Requested, Revision Approval, Accepted, Denied]
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
/**
 * @swagger
 * /requests/{id}/title-change-requests:
 *   get:
 *     summary: Get all title change requests for a specific request
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
 *         description: List of title change requests
 */
router.get('/:id/title-change-requests', authenticate, getTitleChangeRequestsForRequest);

/**
 * @swagger
 * /requests/{id}/title-change-request:
 *   post:
 *     summary: Request a title change for a request
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
 *             required: [newTitle, reason]
 *             properties:
 *               newTitle:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               reason:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       201:
 *         description: Title change request created
 */
router.post('/:id/title-change-request', authenticate, requestTitleChange);

/**
 * @swagger
 * /requests/title-change-requests/pending:
 *   get:
 *     summary: Get all pending title change requests (Manager/Admin only)
 *     tags: [Requests]
 *     responses:
 *       200:
 *         description: List of pending title change requests
 *       403:
 *         description: Requires Manager or Admin role
 */
router.get('/title-change-requests/pending', requireRole(['Manager', 'Admin']), getPendingTitleChangeRequests);

/**
 * @swagger
 * /requests/{id}/title:
 *   patch:
 *     summary: Update request title (Manager/Admin only)
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
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *     responses:
 *       200:
 *         description: Title updated
 *       403:
 *         description: Requires Manager or Admin role
 */
router.patch('/:id/title', requireRole(['Manager', 'Admin']), updateRequestTitle);

/**
 * @swagger
 * /requests/{id}/description:
 *   patch:
 *     summary: Update request description
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
 *             required: [description]
 *             properties:
 *               description:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       200:
 *         description: Description updated
 */
router.patch('/:id/description', authenticate, updateRequestDescription);

/**
 * @swagger
 * /requests/title-change-requests/{id}/review:
 *   patch:
 *     summary: Review (approve/deny) a title change request (Manager/Admin only)
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
 *             required: [approved]
 *             properties:
 *               approved:
 *                 type: boolean
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Title change request reviewed
 *       403:
 *         description: Requires Manager or Admin role
 */
router.patch('/title-change-requests/:id/review', requireRole(['Manager', 'Admin']), reviewTitleChangeRequest);

// Time tracking routes
/**
 * @swagger
 * /requests/{id}/time:
 *   get:
 *     summary: Get time entries for a request
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
 *         description: List of time entries
 */
router.get('/:id/time', authenticate, getTimeEntries);

/**
 * @swagger
 * /requests/{id}/time:
 *   post:
 *     summary: Add a time entry to a request (Engineer/Admin only)
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
 *             required: [hours, description]
 *             properties:
 *               hours:
 *                 type: number
 *                 minimum: 0.1
 *               description:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       201:
 *         description: Time entry added
 *       403:
 *         description: Requires Engineer or Admin role
 */
router.post('/:id/time', requireRole(['Engineer', 'Admin']), addTimeEntry);

// Discussion routes
/**
 * @swagger
 * /requests/{id}/discussion-requests:
 *   get:
 *     summary: Get all discussion requests for a specific request
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
 *         description: List of discussion requests
 */
router.get('/:id/discussion-requests', authenticate, getDiscussionRequestsForRequest);

/**
 * @swagger
 * /requests/{id}/discussion-request:
 *   post:
 *     summary: Create a discussion request (Engineer/Admin only)
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
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       201:
 *         description: Discussion request created
 *       403:
 *         description: Requires Engineer or Admin role
 */
router.post('/:id/discussion-request', requireRole(['Engineer', 'Admin']), createDiscussionRequest);

/**
 * @swagger
 * /requests/discussion-requests/{id}/review:
 *   patch:
 *     summary: Review (approve/deny) a discussion request (Manager/Admin only)
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
 *             required: [approved]
 *             properties:
 *               approved:
 *                 type: boolean
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Discussion request reviewed
 *       403:
 *         description: Requires Manager or Admin role
 */
router.patch('/discussion-requests/:id/review', requireRole(['Manager', 'Admin']), reviewDiscussionRequest);

// Admin-only route to change request requester
/**
 * @swagger
 * /requests/{id}/requester:
 *   patch:
 *     summary: Change the requester of a request (Admin only)
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
 *             required: [newRequesterId]
 *             properties:
 *               newRequesterId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Requester updated
 *       403:
 *         description: Requires Admin role
 */
router.patch('/:id/requester', requireRole(['Admin']), updateRequestRequester);

export default router;
