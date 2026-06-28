import { z } from 'zod';

export const createTMSchema = z.object({
  body: z.object({
    sourceText: z.string()
      .min(1, 'Source text cannot be empty')
      .transform(val => val.trim()),
    targetText: z.string()
      .min(1, 'Target text cannot be empty')
      .transform(val => val.trim()),
    sourceLang: z.string()
      .min(2, 'Source language is required')
      .max(10)
      .transform(val => val.toLowerCase()),
    targetLang: z.string()
      .min(2, 'Target language is required')
      .max(10)
      .transform(val => val.toLowerCase()),
  }),
});

export type CreateTMInput = z.infer<typeof createTMSchema>;
export default createTMSchema;
