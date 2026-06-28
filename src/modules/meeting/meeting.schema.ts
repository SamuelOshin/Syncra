import { z } from 'zod';

export const createMeetingSchema = z.object({
  body: z.object({
    title: z.string()
      .min(3, 'Title must be at least 3 characters')
      .max(255, 'Title must be under 255 characters'),
    scheduledAt: z.string()
      .min(1, 'Scheduled date and time is required')
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' })
      .refine((val) => new Date(val) > new Date(Date.now() - 5 * 60 * 1000), { message: 'Meeting must be scheduled in the future' }),
  }),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export default createMeetingSchema;
