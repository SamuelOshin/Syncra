import { Server, Socket } from 'socket.io';
import { ChatRepository } from '../modules/chat/chat.repository';
import { UserRepository } from '../modules/auth/auth.repository';
import { translationManager } from '../services/translation/translation.manager';
import crypto from 'crypto';

const chatRepository = new ChatRepository();
const userRepository = new UserRepository();

export default (io: Server, socket: Socket): void => {
  
  /**
   * Join all chat rooms the user is a participant of.
   */
  socket.on('join-chats', async ({ userId }: { userId: string }) => {
    if (!userId) return;
    try {
      const chats = await chatRepository.getUserChats(userId);
      for (const chat of chats) {
        socket.join(chat.id);
      }
      console.log(`Socket ${socket.id} joined ${chats.length} chat rooms for user ${userId}`);
    } catch (err) {
      console.error(`Failed to join chat rooms for socket ${socket.id}:`, err);
    }
  });

  /**
   * Handle sending a new chat message.
   */
  socket.on('send-chat-message', async (data: {
    chatId: string;
    senderId: string;
    originalText: string;
    sourceLang: string;
  }) => {
    const { chatId, senderId, originalText, sourceLang } = data;

    if (!chatId || !senderId || !originalText || !sourceLang) {
      console.warn(`Socket ${socket.id} sent an invalid chat message payload.`);
      return;
    }

    try {
      // 1. Enforce access control (Zero-Trust)
      const isParticipant = await chatRepository.isParticipant(chatId, senderId);
      if (!isParticipant) {
        socket.emit('chat-error', { message: 'Access denied: You are not in this chat room.' });
        return;
      }

      // 2. Fetch sender details
      const sender = await userRepository.findById(senderId);
      const senderName = sender ? sender.name : 'Participant';

      // 3. Save the original message
      const messageId = crypto.randomUUID();
      const message = await chatRepository.createMessage({
        id: messageId,
        chatId,
        senderId,
        originalText,
        sourceLang,
        createdAt: new Date()
      });

      // 4. Get other participants and find unique target languages
      const participants = await chatRepository.getParticipants(chatId);
      const otherParticipants = participants.filter(p => p.id !== senderId);
      
      const targetLanguages = Array.from(new Set(
        otherParticipants
          .map(p => (p.preferredLanguage || 'en').toLowerCase())
          .filter(lang => lang !== sourceLang.toLowerCase())
      ));

      // 5. Translate in parallel for each unique target language
      const translations: Record<string, string> = {};
      await Promise.all(targetLanguages.map(async (targetLang) => {
        try {
          const translatedText = await translationManager.translate(
            originalText,
            sourceLang,
            targetLang,
            senderId
          );

          // Only cache and return if translation succeeded and is different
          if (translatedText && translatedText !== originalText) {
            translations[targetLang] = translatedText;
            
            await chatRepository.createTranslation({
              id: crypto.randomUUID(),
              messageId,
              targetLang,
              translatedText,
              createdAt: new Date()
            });
          }
        } catch (err: any) {
          console.error(`Failed to translate message ${messageId} to ${targetLang}:`, err.message);
        }
      }));

      // 6. Broadcast the message to the room (includes sender)
      const payload = {
        id: messageId,
        chatId,
        senderId,
        senderName,
        originalText,
        sourceLang,
        translations, // e.g. { fr: "Bonjour", es: "Hola" }
        createdAt: message.createdAt
      };

      io.to(chatId).emit('new-chat-message', payload);

    } catch (err) {
      console.error(`Error processing send-chat-message for chat ${chatId}:`, err);
      socket.emit('chat-error', { message: 'Failed to send message.' });
    }
  });

  /**
   * Handle typing indicators.
   */
  socket.on('chat-typing', (data: {
    chatId: string;
    userId: string;
    isTyping: boolean;
    username: string;
  }) => {
    const { chatId, userId, isTyping, username } = data;
    if (!chatId || !userId) return;

    // Broadcast to everyone else in the chat room
    socket.to(chatId).emit('chat-typing', {
      chatId,
      userId,
      isTyping,
      username
    });
  });

  /**
   * Handle marking a chat as read.
   */
  socket.on('mark-chat-read', async (data: { chatId: string; userId: string }) => {
    const { chatId, userId } = data;
    if (!chatId || !userId) return;

    try {
      // 1. Update lastReadAt in DB
      await chatRepository.updateLastRead(chatId, userId);
      
      // 2. Broadcast to room that this user has read the messages
      const now = new Date().toISOString();
      socket.to(chatId).emit('chat-read', {
        chatId,
        userId,
        readAt: now
      });
    } catch (err) {
      console.error(`Error processing mark-chat-read for chat ${chatId}:`, err);
    }
  });
};
