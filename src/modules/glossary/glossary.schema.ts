import { z } from 'zod';

export const createGlossarySchema = z.object({
  body: z.object({
    sourceText: z.string()
      .min(1, 'Source text cannot be empty')
      .max(255, 'Source text must be under 255 characters')
      .transform(val => val.trim()),
    targetText: z.string()
      .min(1, 'Target text cannot be empty')
      .max(255, 'Target text must be under 255 characters')
      .transform(val => val.trim()),
    sourceLang: z.string()
      .min(2, 'Source language is required')
      .max(10, 'Source language code is too long')
      .transform(val => val.toLowerCase()),
    targetLang: z.string()
      .min(2, 'Target language is required')
      .max(10, 'Target language code is too long')
      .transform(val => val.toLowerCase()),
    projectId: z.string().optional().nullable(),
  }),
});

export type CreateGlossaryInput = z.infer<typeof createGlossarySchema>;
export default createGlossarySchema;
