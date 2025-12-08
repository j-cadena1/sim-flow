import { Router } from 'express';
import { getAllUsers, getCurrentUser } from '../controllers/usersController';
import { authenticate } from '../middleware/authentication';

const router = Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     description: Returns list of all users in the system. Requires authentication.
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
router.get('/', authenticate, getAllUsers);

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     description: Returns the authenticated user's profile information
 *     responses:
 *       200:
 *         description: Current user details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authenticate, getCurrentUser);

export default router;
