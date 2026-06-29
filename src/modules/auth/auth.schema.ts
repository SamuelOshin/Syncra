import { z } from 'zod';

export const signUpSchema = z.object({
  body: z.object({
    name: z.string()
      .min(3, 'Name must be at least 3 characters')
      .max(50, 'Name must be under 50 characters'),
    email: z.string()
      .min(1, 'Email is required')
      .email('Invalid email format'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters'),
  }),
});

export const signInSchema = z.object({
  body: z.object({
    email: z.string()
      .min(1, 'Email is required')
      .email('Invalid email format'),
    password: z.string()
      .min(1, 'Password is required'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string()
      .min(3, 'Name must be at least 3 characters')
      .max(50, 'Name must be under 50 characters'),
    email: z.string()
      .min(1, 'Email is required')
      .email('Invalid email format'),
  }),
});

export const updatePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  }),
});
