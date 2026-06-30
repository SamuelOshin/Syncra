import { z } from 'zod';

export const createChatSchema = z.object({
  body: z.object({
    isGroup: z.boolean(),
    name: z.string().trim().max(100).optional().nullable(),
    userIds: z.array(z.string().min(1)).min(1, 'At least one participant must be specified')
  }).refine((data) => {
    if (data.isGroup && (!data.name || data.name.trim() === '')) {
      return false;
    }
    return true;
  }, {
    message: 'Group name is required for group chats',
    path: ['name']
  })
});

export const sendMessageSchema = z.object({
  body: z.object({
    originalText: z.string().trim().min(1, 'Message text cannot be empty').max(4000, 'Message is too long'),
    sourceLang: z.string().trim().min(2).max(10),
  })
});

export type CreateChatInput = z.infer<typeof createChatSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
