import { z } from 'zod';

export const createProjectSchema = z.object({
  body: z.object({
    name: z.string()
      .min(1, 'Project name is required')
      .max(100, 'Project name must be 100 characters or less')
      .transform(val => val.trim()),
    description: z.string()
      .max(500, 'Description must be 500 characters or less')
      .optional()
      .transform(val => val ? val.trim() : ''),
  }),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export default createProjectSchema;
