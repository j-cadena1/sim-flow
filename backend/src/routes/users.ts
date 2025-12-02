import { Router } from 'express';
import { getAllUsers, getCurrentUser } from '../controllers/usersController';

const router = Router();

router.get('/', getAllUsers);
router.get('/me', getCurrentUser);

export default router;
