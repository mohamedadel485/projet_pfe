import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import incidentController from '../controllers/incidentController';

const router = Router();

router.get('/', authenticate, incidentController.list);

export default router;
