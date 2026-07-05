import { z } from 'zod';

const passwordComplexity = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const signUpSchema = z.object({
  body: z.object({
    name: z.string()
      .min(3, 'Name must be at least 3 characters')
      .max(50, 'Name must be under 50 characters')
      .regex(/^[a-zA-Z0-9\s.\-_]+$/, 'Name contains invalid characters'),
    email: z.string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .trim()
      .toLowerCase(),
    password: passwordComplexity,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
});

export const signInSchema = z.object({
  body: z.object({
    email: z.string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .trim()
      .toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string()
      .min(3, 'Name must be at least 3 characters')
      .max(50, 'Name must be under 50 characters')
      .regex(/^[a-zA-Z0-9\s.\-_]+$/, 'Name contains invalid characters'),
    email: z.string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .trim()
      .toLowerCase(),
    preferredLanguage: z.enum(['en', 'fr', 'es', 'de', 'ja', 'pt', 'it', 'nl', 'zh', 'ru', 'ar', 'hi', 'ko']).default('en'),
  }),
});

export const updatePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordComplexity,
    confirmNewPassword: z.string().min(1, 'Confirm new password is required'),
  }).refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New passwords do not match',
    path: ['confirmNewPassword'],
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .trim()
      .toLowerCase(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordComplexity,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
});

export const verifyEmailSchema = z.object({
  query: z.object({
    token: z.string().min(1, 'Verification token is required'),
  }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .trim()
      .toLowerCase(),
  }),
});

export const onboardingSchema = z.object({
  body: z.object({
    name: z.string()
      .min(3, 'Name must be at least 3 characters')
      .max(50, 'Name must be under 50 characters')
      .regex(/^[a-zA-Z0-9\s.\-_]+$/, 'Name contains invalid characters'),
    preferredLanguage: z.enum(['en', 'fr', 'es', 'de', 'ja', 'pt', 'it', 'nl', 'zh', 'ru', 'ar', 'hi', 'ko']).default('en'),
    defaultSpeakingLanguage: z.enum(['en', 'fr', 'es', 'de', 'ja', 'pcm']).default('en'),
    defaultTranslationLanguage: z.enum(['en', 'fr', 'es', 'de', 'ja', 'pcm']).default('fr'),
    firstProjectName: z.string().min(3, 'Project name must be at least 3 characters').max(50, 'Project name must be under 50 characters').optional(),
    firstProjectDesc: z.string().max(200, 'Project description must be under 200 characters').optional(),
  }),
});
