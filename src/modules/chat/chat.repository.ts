import { db, isPostgres } from '../../db/db.connection';
import { 
  chats as chatsTableRef, 
  chatParticipants as chatParticipantsTableRef, 
  chatMessages as chatMessagesTableRef, 
  messageTranslations as messageTranslationsTableRef, 
  users as usersTableRef
} from '../../db/schema';
import { eq, and, desc, inArray, sql, ne, like, or } from 'drizzle-orm';

const chatsTable = chatsTableRef as any;
const chatParticipantsTable = chatParticipantsTableRef as any;
const chatMessagesTable = chatMessagesTableRef as any;
const messageTranslationsTable = messageTranslationsTableRef as any;
const usersTable = usersTableRef as any;
const dbClient = db as any;

export interface ChatRecord {
  id: string;
  name?: string | null;
  isGroup: boolean;
  createdAt: Date | string;
}

export interface ChatParticipantRecord {
  id: string;
  chatId: string;
  userId: string;
  joinedAt: Date | string;
}

export interface ChatMessageRecord {
  id: string;
  chatId: string;
  senderId: string;
  originalText: string;
  sourceLang: string;
  createdAt: Date | string;
}

export interface MessageTranslationRecord {
  id: string;
  messageId: string;
  targetLang: string;
  translatedText: string;
  createdAt: Date | string;
}

export class ChatRepository {

  /**
   * Find a direct message chat between two users, if it exists.
   */
  async findDirectChat(userAId: string, userBId: string): Promise<ChatRecord | null> {
    // 1. Get all chat IDs for user A
    const userAChats = await dbClient.select({ chatId: chatParticipantsTable.chatId })
      .from(chatParticipantsTable)
      .where(eq(chatParticipantsTable.userId, userAId));

    const userAChatIds = userAChats.map((c: any) => c.chatId);
    if (userAChatIds.length === 0) return null;

    // 2. Find if any of these chats is a DM (not group) that also has user B
    const result = await dbClient.select({
      id: chatsTable.id,
      name: chatsTable.name,
      isGroup: chatsTable.isGroup,
      createdAt: chatsTable.createdAt
    })
      .from(chatParticipantsTable)
      .innerJoin(chatsTable, eq(chatParticipantsTable.chatId, chatsTable.id))
      .where(
        and(
          inArray(chatParticipantsTable.chatId, userAChatIds),
          eq(chatParticipantsTable.userId, userBId),
          eq(chatsTable.isGroup, isPostgres ? false : 0)
        )
      )
      .limit(1);

    return result[0] ? {
      ...result[0],
      isGroup: Boolean(result[0].isGroup)
    } : null;
  }

  /**
   * Create a chat session.
   */
  async createChat(chat: ChatRecord): Promise<ChatRecord> {
    const dbValue = {
      ...chat,
      isGroup: isPostgres ? chat.isGroup : (chat.isGroup ? 1 : 0),
      createdAt: isPostgres ? new Date() : new Date().toISOString()
    };
    await dbClient.insert(chatsTable).values(dbValue);
    return chat;
  }

  /**
   * Add a participant to a chat.
   */
  async addParticipant(participant: ChatParticipantRecord): Promise<ChatParticipantRecord> {
    const dbValue = {
      ...participant,
      joinedAt: isPostgres ? new Date() : new Date().toISOString()
    };
    await dbClient.insert(chatParticipantsTable).values(dbValue);
    return participant;
  }

  /**
   * Check if a user is a participant in a chat room.
   */
  async isParticipant(chatId: string, userId: string): Promise<boolean> {
    const result = await dbClient.select()
      .from(chatParticipantsTable)
      .where(
        and(
          eq(chatParticipantsTable.chatId, chatId),
          eq(chatParticipantsTable.userId, userId)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  /**
   * Get all participants in a chat room.
   */
  async getParticipants(chatId: string): Promise<any[]> {
    return dbClient.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      preferredLanguage: usersTable.preferredLanguage,
      lastReadAt: chatParticipantsTable.lastReadAt
    })
      .from(chatParticipantsTable)
      .innerJoin(usersTable, eq(chatParticipantsTable.userId, usersTable.id))
      .where(eq(chatParticipantsTable.chatId, chatId));
  }

  /**
   * Update the lastReadAt timestamp for a participant in a chat room.
   */
  async updateLastRead(chatId: string, userId: string): Promise<void> {
    const now = isPostgres ? new Date() : new Date().toISOString();
    await dbClient.update(chatParticipantsTable)
      .set({ lastReadAt: now })
      .where(
        and(
          eq(chatParticipantsTable.chatId, chatId),
          eq(chatParticipantsTable.userId, userId)
        )
      );
  }

  /**
   * Get all chats for a specific user, including:
   * - Participant list
   * - Last message details
   * - Unread message counts
   */
  async getUserChats(userId: string): Promise<any[]> {
    // 1. Get all chats the user is in, including their lastReadAt timestamp
    const userChats = await dbClient.select({
      id: chatsTable.id,
      name: chatsTable.name,
      isGroup: chatsTable.isGroup,
      createdAt: chatsTable.createdAt,
      lastReadAt: chatParticipantsTable.lastReadAt
    })
      .from(chatParticipantsTable)
      .innerJoin(chatsTable, eq(chatParticipantsTable.chatId, chatsTable.id))
      .where(eq(chatParticipantsTable.userId, userId))
      .orderBy(desc(chatsTable.createdAt));

    const formattedChats = [];

    for (const chat of userChats) {
      const isGroup = Boolean(chat.isGroup);

      // 2. Get all participants in this chat
      const participants = await this.getParticipants(chat.id);

      // 3. Get the last message in this chat
      const lastMessages = await dbClient.select({
        id: chatMessagesTable.id,
        originalText: chatMessagesTable.originalText,
        sourceLang: chatMessagesTable.sourceLang,
        senderId: chatMessagesTable.senderId,
        createdAt: chatMessagesTable.createdAt,
        senderName: usersTable.name
      })
        .from(chatMessagesTable)
        .innerJoin(usersTable, eq(chatMessagesTable.senderId, usersTable.id))
        .where(eq(chatMessagesTable.chatId, chat.id))
        .orderBy(desc(chatMessagesTable.createdAt))
        .limit(1);

      const lastMessage = lastMessages[0] || null;

      // 4. Count unread messages (sent by others, created after our lastReadAt)
      const lastRead = chat.lastReadAt;
      const unreadResult = await dbClient.select({
        count: sql<number>`count(${chatMessagesTable.id})`
      })
        .from(chatMessagesTable)
        .where(
          and(
            eq(chatMessagesTable.chatId, chat.id),
            ne(chatMessagesTable.senderId, userId),
            sql`${chatMessagesTable.createdAt} > ${lastRead}`
          )
        );
      
      const unreadCount = Number(unreadResult[0]?.count || 0);

      // Determine chat display name (For DMs, it's the OTHER user's name)
      let chatName = chat.name || 'Chat';
      if (!isGroup) {
        const otherUser = participants.find(p => p.id !== userId);
        chatName = otherUser ? otherUser.name : 'Direct Message';
      }

      formattedChats.push({
        id: chat.id,
        name: chatName,
        isGroup,
        participants,
        lastMessage,
        unreadCount,
        createdAt: chat.createdAt
      });
    }

    // Sort by last message date, falling back to chat creation date
    return formattedChats.sort((a, b) => {
      const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
      const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }

  /**
   * Save a chat message.
   */
  async createMessage(message: ChatMessageRecord): Promise<ChatMessageRecord> {
    const dbValue = {
      ...message,
      createdAt: isPostgres ? new Date() : new Date().toISOString()
    };
    await dbClient.insert(chatMessagesTable).values(dbValue);
    return dbValue as unknown as ChatMessageRecord;
  }

  /**
   * Save a message translation.
   */
  async createTranslation(translation: MessageTranslationRecord): Promise<MessageTranslationRecord> {
    const dbValue = {
      ...translation,
      createdAt: isPostgres ? new Date() : new Date().toISOString()
    };
    await dbClient.insert(messageTranslationsTable).values(dbValue);
    return dbValue as unknown as MessageTranslationRecord;
  }

  /**
   * Find a specific translation for a message.
   */
  async getTranslation(messageId: string, targetLang: string): Promise<string | null> {
    const result = await dbClient.select({
      translatedText: messageTranslationsTable.translatedText
    })
      .from(messageTranslationsTable)
      .where(
        and(
          eq(messageTranslationsTable.messageId, messageId),
          eq(messageTranslationsTable.targetLang, targetLang)
        )
      )
      .limit(1);

    return result[0]?.translatedText || null;
  }

  /**
   * Get message history for a chat.
   */
  async getMessagesByChatId(chatId: string): Promise<any[]> {
    return dbClient.select({
      id: chatMessagesTable.id,
      chatId: chatMessagesTable.chatId,
      senderId: chatMessagesTable.senderId,
      originalText: chatMessagesTable.originalText,
      sourceLang: chatMessagesTable.sourceLang,
      createdAt: chatMessagesTable.createdAt,
      senderName: usersTable.name
    })
      .from(chatMessagesTable)
      .innerJoin(usersTable, eq(chatMessagesTable.senderId, usersTable.id))
      .where(eq(chatMessagesTable.chatId, chatId))
      .orderBy(chatMessagesTable.createdAt); // oldest first
  }

  /**
   * List/search all users in the system (excluding the current user) for starting chats.
   */
  async searchUsers(excludeUserId: string, query?: string): Promise<any[]> {
    let whereClause = ne(usersTable.id, excludeUserId);

    if (query && query.trim()) {
      const normalized = `%${query.trim().toLowerCase()}%`;
      whereClause = and(
        whereClause,
        or(
          like(sql`lower(${usersTable.name})`, normalized),
          like(sql`lower(${usersTable.email})`, normalized)
        )
      ) as any;
    }

    return dbClient.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      preferredLanguage: usersTable.preferredLanguage
    })
      .from(usersTable)
      .where(whereClause)
      .orderBy(usersTable.name)
      .limit(30);
  }
}
export default ChatRepository;
