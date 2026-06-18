import { Router } from 'express';
import chatController from '../controllers/chatController';

const router = Router();

router.post('/chat', chatController.chat);

export default router;
