import { Request, Response, NextFunction } from 'express';
import { ChatRepository } from './chat.repository';
import { createChatSchema, sendMessageSchema } from './chat.schema';
import { successResponse } from '../../utils/response';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../utils/errors';
import { translationManager } from '../../services/translation/translation.manager';
import crypto from 'crypto';

const chatRepository = new ChatRepository();

export class ChatController {

  /**
   * Create a new DM or Group Chat.
   * POST /api/chat
   */
  async createChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { isGroup, name, userIds } = req.body;
      const currentUserId = req.user!.id;

      // Ensure current user is in the participants list
      const allUserIds = Array.from(new Set([currentUserId, ...userIds]));

      // If it's a direct message, check if it already exists
      if (!isGroup && allUserIds.length === 2) {
        const otherUserId = allUserIds.find(id => id !== currentUserId)!;
        const existingChat = await chatRepository.findDirectChat(currentUserId, otherUserId);
        if (existingChat) {
          successResponse(res, 200, 'Chat retrieved successfully', { chat: existingChat });
          return;
        }
      }

      // Generate a new chat ID
      const chatId = crypto.randomUUID();
      const newChat = await chatRepository.createChat({
        id: chatId,
        name: isGroup ? name : null,
        isGroup,
        createdAt: new Date()
      });

      // Add all participants
      const participantPromises = allUserIds.map(userId => {
        return chatRepository.addParticipant({
          id: crypto.randomUUID(),
          chatId,
          userId,
          joinedAt: new Date()
        });
      });
      await Promise.all(participantPromises);

      // Fetch participants details
      const participants = await chatRepository.getParticipants(chatId);

      // Determine display name
      let chatDisplayName = name || 'Chat';
      if (!isGroup) {
        const otherUser = participants.find(p => p.id !== currentUserId);
        chatDisplayName = otherUser ? otherUser.name : 'Direct Message';
      }

      successResponse(res, 201, 'Chat created successfully', {
        chat: {
          id: chatId,
          name: chatDisplayName,
          isGroup,
          participants,
          lastMessage: null,
          createdAt: newChat.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all chats for the logged-in user.
   * GET /api/chat
   */
  async getUserChats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!.id;
      const chats = await chatRepository.getUserChats(currentUserId);
      
      successResponse(res, 200, 'Chats retrieved successfully', { chats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get messages for a specific chat room.
   * GET /api/chat/:chatId/messages
   */
  async getChatMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chatId } = req.params;
      const currentUserId = req.user!.id;
      const currentUserLang = req.user!.preferredLanguage || 'en';

      // 1. Enforce access control (Zero-Trust)
      const isParticipant = await chatRepository.isParticipant(chatId, currentUserId);
      if (!isParticipant) {
        next(new ForbiddenError('You are not a participant in this chat', 'ACCESS_DENIED'));
        return;
      }

      // Update lastReadAt since they are viewing the chat
      await chatRepository.updateLastRead(chatId, currentUserId).catch(err => {
        console.error(`[ChatController] Failed to update lastReadAt for user ${currentUserId} in chat ${chatId}:`, err);
      });

      // 2. Fetch message history
      const messages = await chatRepository.getMessagesByChatId(chatId);
      const participants = await chatRepository.getParticipants(chatId);

      // 3. Perform on-demand, cached translation for messages in different languages
      const translatedMessages = await Promise.all(messages.map(async (msg) => {
        let translatedText = null;

        if (msg.sourceLang.toLowerCase() !== currentUserLang.toLowerCase()) {
          // Check if we already have the translation cached in DB
          translatedText = await chatRepository.getTranslation(msg.id, currentUserLang);

          if (!translatedText) {
            // Translate on the fly and cache it
            translatedText = await translationManager.translate(
              msg.originalText,
              msg.sourceLang,
              currentUserLang,
              msg.senderId
            );

            // Only cache if the translation was successful (i.e. did not just return the original text)
            if (translatedText && translatedText !== msg.originalText) {
              await chatRepository.createTranslation({
                id: crypto.randomUUID(),
                messageId: msg.id,
                targetLang: currentUserLang,
                translatedText,
                createdAt: new Date()
              }).catch(err => console.error(`[ChatController] Failed to cache translation for message ${msg.id}:`, err));
            }
          }
        }

        // Compute read status for messages sent by the current user
        let status = 'sent';
        if (msg.senderId === currentUserId) {
          const otherParticipants = participants.filter(p => p.id !== currentUserId);
          if (otherParticipants.length > 0) {
            const readTimes = otherParticipants.map(p => {
              return p.lastReadAt ? new Date(p.lastReadAt).getTime() : 0;
            });
            const msgTime = new Date(msg.createdAt).getTime();

            const readCount = readTimes.filter(t => t >= msgTime).length;
            if (readCount === otherParticipants.length) {
              status = 'read'; // Read by everyone (double blue ticks)
            } else if (readCount > 0) {
              status = 'delivered'; // Read by some (double gray ticks)
            }
          }
        }

        return {
          id: msg.id,
          chatId: msg.chatId,
          senderId: msg.senderId,
          senderName: msg.senderName,
          originalText: msg.originalText,
          sourceLang: msg.sourceLang,
          translatedText,
          status,
          createdAt: msg.createdAt
        };
      }));

      successResponse(res, 200, 'Messages retrieved successfully', { messages: translatedMessages });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search for users to start a chat with.
   * GET /api/chat/users
   */
  async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUserId = req.user!.id;
      const query = req.query.q as string | undefined;

      const users = await chatRepository.searchUsers(currentUserId, query);
      
      successResponse(res, 200, 'Users retrieved successfully', { users });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a chat session as read for the logged-in user.
   * POST /api/chat/:chatId/read
   */
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chatId } = req.params;
      const currentUserId = req.user!.id;

      // Enforce access control
      const isParticipant = await chatRepository.isParticipant(chatId, currentUserId);
      if (!isParticipant) {
        next(new ForbiddenError('You are not a participant in this chat', 'ACCESS_DENIED'));
        return;
      }

      await chatRepository.updateLastRead(chatId, currentUserId);
      successResponse(res, 200, 'Chat marked as read');
    } catch (error) {
      next(error);
    }
  }
}
export default ChatController;
