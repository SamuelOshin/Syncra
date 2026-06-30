import { Router } from 'express';
import { ChatController } from './chat.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createChatSchema } from './chat.schema';

const router = Router();
const chatController = new ChatController();

// All chat endpoints require authentication
router.use(requireAuth);

router.post('/', validate(createChatSchema), (req, res, next) => chatController.createChat(req, res, next));
router.get('/', (req, res, next) => chatController.getUserChats(req, res, next));
router.get('/users', (req, res, next) => chatController.searchUsers(req, res, next));
router.get('/:chatId/messages', (req, res, next) => chatController.getChatMessages(req, res, next));
router.post('/:chatId/read', (req, res, next) => chatController.markAsRead(req, res, next));

export default router;
