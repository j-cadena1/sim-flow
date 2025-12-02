import { Router } from 'express';
import {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequestStatus,
  assignEngineer,
  addComment,
} from '../controllers/requestsController';
import {
  validate,
  createRequestSchema,
  updateStatusSchema,
  assignEngineerSchema,
  addCommentSchema,
} from '../middleware/validation';

const router = Router();

router.get('/', getAllRequests);
router.get('/:id', getRequestById);
router.post('/', validate(createRequestSchema), createRequest);
router.patch('/:id/status', validate(updateStatusSchema), updateRequestStatus);
router.patch('/:id/assign', validate(assignEngineerSchema), assignEngineer);
router.post('/:id/comments', validate(addCommentSchema), addComment);

export default router;
