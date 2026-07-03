import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRepository, User } from './auth.repository';
import { successResponse } from '../../utils/response';
import { ConflictError, UnauthorizedError, ForbiddenError, BadRequestError, NotFoundError } from '../../utils/errors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import config from '../../config';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../utils/email';

const userRepository = new UserRepository();

export class AuthController {
  
  // POST /api/auth/signup
  async signUp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password } = req.body;

      // Check if email already exists
      const existingUser = await userRepository.findByEmail(email.toLowerCase());
      if (existingUser) {
        // Return a generic success response to prevent user enumeration
        successResponse(res, 201, config.requireEmailVerification ? 'Registration successful. Please check your email to verify your account.' : 'Registration successful. Your account has been created.', {
          user: {
            id: 'generic-id',
            name,
            email: email.toLowerCase(),
          }
        });
        return;
      }

      // Hash password (async)
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Generate UUID (standard RFC4122 v4)
      const userId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
      const verificationToken = crypto.randomBytes(32).toString('hex');

      const requireVerify = config.requireEmailVerification;
      const newUser: User = {
        id: userId,
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        tokenVersion: 1,
        emailVerified: !requireVerify,
        verificationToken: requireVerify ? verificationToken : null,
      };

      await userRepository.create(newUser);

      // Simulate sending email by logging in console or via Resend SDK if API key is provided
      if (requireVerify) {
        const link = `http://localhost:${config.port}/api/auth/verify-email?token=${verificationToken}`;
        await sendVerificationEmail(newUser.email, newUser.name, link);
      }

      successResponse(res, 201, requireVerify ? 'Registration successful. Please check your email to verify your account.' : 'Registration successful. Your account has been created.', {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/signin
  async signIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      const user = await userRepository.findByEmail(email.toLowerCase());

      // 1. Account Lockout Check
      if (user && user.lockedUntil) {
        const lockTime = new Date(user.lockedUntil).getTime();
        if (lockTime > Date.now()) {
          const waitMinutes = Math.ceil((lockTime - Date.now()) / 60000);
          next(new UnauthorizedError(`Account is temporarily locked due to too many failed attempts. Please wait ${waitMinutes} minutes.`, 'ACCOUNT_LOCKED'));
          return;
        }
      }

      if (!user || !user.password) {
        next(new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS'));
        return;
      }

      // 2. Email Verification Check (only if configured)
      if (config.requireEmailVerification && !user.emailVerified) {
        next(new UnauthorizedError('Please verify your email address before signing in', 'EMAIL_NOT_VERIFIED'));
        return;
      }

      // 3. Compare password hash (async)
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        const failedAttempts = (user.failedAttempts ?? 0) + 1;
        const updateData: Partial<User> = { failedAttempts };
        
        if (failedAttempts >= 5) {
          updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
          updateData.failedAttempts = 0; // Reset counter for next cycle
          await userRepository.update(user.id, updateData);
          next(new UnauthorizedError('Too many failed attempts. Account locked for 15 minutes.', 'ACCOUNT_LOCKED'));
          return;
        }
        
        await userRepository.update(user.id, updateData);
        next(new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS'));
        return;
      }

      // 4. Reset failed attempts counter on success
      if (user.failedAttempts && user.failedAttempts > 0) {
        await userRepository.update(user.id, { failedAttempts: 0, lockedUntil: null });
      }

      const tokenVersion = user.tokenVersion ?? 1;

      // Generate Access Token (15 minutes) - Contains ONLY user ID to eliminate PII leak risk
      const accessToken = jwt.sign(
        { id: user.id },
        config.jwtAccessSecret,
        { expiresIn: config.jwtAccessExpiresIn as any }
      );

      // Generate Refresh Token (7 days)
      const refreshToken = jwt.sign(
        { id: user.id, tokenVersion },
        config.jwtRefreshSecret,
        { expiresIn: config.jwtRefreshExpiresIn as any }
      );

      // Set Access Token Cookie
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      // Set Refresh Token Cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      successResponse(res, 200, 'Login successful', {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          preferredLanguage: user.preferredLanguage || 'en',
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/signout
  async signOut(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        // Increment token version to invalidate all active refresh tokens for this user
        await userRepository.incrementTokenVersion(req.user.id);
      }
      
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
      };
      
      res.clearCookie('accessToken', cookieOptions);
      res.clearCookie('refreshToken', cookieOptions);
      
      successResponse(res, 200, 'Logout successful');
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/me
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.user) {
      next(new UnauthorizedError('You must be logged in to access this resource', 'UNAUTHORIZED'));
      return;
    }

    const isSandbox = req.user.email.endsWith('-sandbox.com');

    successResponse(res, 200, 'Profile retrieved successfully', {
      user: req.user,
      warnedDemoAuth: isSandbox,
    });
  }

  // GET /api/auth/google & /api/auth/microsoft
  async handleOAuthRedirect(req: Request, res: Response, next: NextFunction): Promise<void> {
    const provider = req.path.includes('google') ? 'Google' : 'Microsoft';
    const hasClientId = provider === 'Google' ? !!process.env.GOOGLE_CLIENT_ID : !!process.env.MICROSOFT_CLIENT_ID;

    if (!hasClientId) {
      // In production, forbid sandbox mode
      if (process.env.NODE_ENV === 'production') {
        next(new ForbiddenError(
          `OAuth Sandbox Mode is disabled in production. Please configure ${provider.toUpperCase()}_CLIENT_ID.`, 
          'OAUTH_SANDBOX_DISABLED'
        ));
        return;
      }

      // Dev Sandbox Redirect Fallback
      console.warn(`[Auth] ${provider} Client ID missing. Redirecting to Sandbox callback...`);
      res.redirect(`/api/auth/${provider.toLowerCase()}/callback?code=mock-sandbox-code`);
      return;
    }

    res.status(501).json({ status: 'error', message: 'Real OAuth flow not implemented' });
  }

  // GET /api/auth/google/callback & /api/auth/microsoft/callback
  async handleOAuthCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const provider = req.path.includes('google') ? 'Google' : 'Microsoft';
      const hasClientId = provider === 'Google' ? !!process.env.GOOGLE_CLIENT_ID : !!process.env.MICROSOFT_CLIENT_ID;
      const { code } = req.query;

      if (code === 'mock-sandbox-code') {
        // CLOSE BACKDOOR: Reject sandbox code in production or if oauth credentials are present
        if (process.env.NODE_ENV === 'production' || hasClientId) {
          next(new ForbiddenError('OAuth Sandbox Mode is disabled.', 'OAUTH_SANDBOX_DISABLED'));
          return;
        }

        // Sandbox Login
        const mockEmail = `john.doe@${provider.toLowerCase()}-sandbox.com`;
        let user = await userRepository.findByEmail(mockEmail);

        if (!user) {
          // Create sandbox user
          const userId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
          // Hash simulated OAuth password
          const hashedPassword = await bcrypt.hash('oauth-sandbox-dummy-password', 10);
          user = {
            id: userId,
            name: `John Doe (${provider})`,
            email: mockEmail,
            password: hashedPassword,
            tokenVersion: 1,
            emailVerified: true, // Sandbox accounts are verified by default
          };
          await userRepository.create(user);
        }

        const tokenVersion = user.tokenVersion ?? 1;

        // Generate Access Token (15 minutes) - ONLY user ID payload
        const accessToken = jwt.sign(
          { id: user.id },
          config.jwtAccessSecret,
          { expiresIn: config.jwtAccessExpiresIn as any }
        );

        // Generate Refresh Token (7 days)
        const refreshToken = jwt.sign(
          { id: user.id, tokenVersion },
          config.jwtRefreshSecret,
          { expiresIn: config.jwtRefreshExpiresIn as any }
        );

        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const,
        };

        // Set Access Token Cookie
        res.cookie('accessToken', accessToken, {
          ...cookieOptions,
          maxAge: 15 * 60 * 1000,
        });

        // Set Refresh Token Cookie
        res.cookie('refreshToken', refreshToken, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Redirect to main dashboard
        res.redirect('/');
        return;
      }

      next(new BadRequestError('Invalid authorization code', 'INVALID_AUTH_CODE'));
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/auth/profile
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(new UnauthorizedError('You must be logged in to update your profile', 'UNAUTHORIZED'));
        return;
      }

      const { name, email, preferredLanguage } = req.body;
      const userId = req.user.id;

      // Check if email is already taken by another user
      const existingUser = await userRepository.findByEmail(email.toLowerCase());
      if (existingUser && existingUser.id !== userId) {
        next(new ConflictError('Email is already registered by another user', 'EMAIL_ALREADY_TAKEN'));
        return;
      }

      // Update in database
      await userRepository.update(userId, {
        name,
        email: email.toLowerCase(),
        preferredLanguage: preferredLanguage || 'en',
      });

      // Issue a new Access Token with ONLY the user ID
      const accessToken = jwt.sign(
        { id: userId },
        config.jwtAccessSecret,
        { expiresIn: config.jwtAccessExpiresIn as any }
      );

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

      successResponse(res, 200, 'Profile updated successfully', {
        user: {
          id: userId,
          name,
          email: email.toLowerCase(),
          preferredLanguage: preferredLanguage || 'en',
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/auth/password
  async updatePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(new UnauthorizedError('You must be logged in to update your password', 'UNAUTHORIZED'));
        return;
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Fetch user from database to get password hash
      const user = await userRepository.findById(userId);
      if (!user || !user.password) {
        next(new NotFoundError('User not found', 'USER_NOT_FOUND'));
        return;
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        next(new UnauthorizedError('Incorrect current password', 'INCORRECT_CURRENT_PASSWORD'));
        return;
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const newTokenVersion = (user.tokenVersion ?? 1) + 1;

      // Update database
      await userRepository.update(userId, {
        password: hashedPassword,
        tokenVersion: newTokenVersion,
      });

      // Issue a new Refresh Token with the new tokenVersion so this session remains logged in
      const refreshToken = jwt.sign(
        { id: userId, tokenVersion: newTokenVersion },
        config.jwtRefreshSecret,
        { expiresIn: config.jwtRefreshExpiresIn as any }
      );

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      successResponse(res, 200, 'Password updated successfully. Other devices have been logged out.');
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/verify-email
  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.query;
      const user = await userRepository.findByVerificationToken(token as string);
      if (!user) {
        next(new BadRequestError('Invalid or expired verification token', 'INVALID_VERIFICATION_TOKEN'));
        return;
      }
      
      await userRepository.update(user.id, {
        emailVerified: true,
        verificationToken: null,
      });
      
      res.redirect('/?verified=true');
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/verify-email/resend
  async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const user = await userRepository.findByEmail(email.toLowerCase());
      if (!user) {
        // Return a generic success to prevent user enumeration
        successResponse(res, 200, 'If this email is registered, a new verification link has been sent.');
        return;
      }
      
      if (user.emailVerified) {
        next(new BadRequestError('Email is already verified', 'EMAIL_ALREADY_VERIFIED'));
        return;
      }
      
      const verificationToken = crypto.randomBytes(32).toString('hex');
      await userRepository.update(user.id, { verificationToken });
      
      const link = `http://localhost:${config.port}/api/auth/verify-email?token=${verificationToken}`;
      await sendVerificationEmail(user.email, user.name, link);
      
      successResponse(res, 200, 'If this email is registered, a new verification link has been sent.');
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/forgot-password
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const user = await userRepository.findByEmail(email.toLowerCase());
      if (!user) {
        // Generic success message to prevent user enumeration
        successResponse(res, 200, 'If this email exists, a password reset link has been sent.');
        return;
      }
      
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
      
      await userRepository.update(user.id, {
        resetPasswordToken: resetToken,
        resetPasswordExpiresAt: resetExpires,
      });
      
      const link = `http://localhost:${config.port}/#reset-password?token=${resetToken}`;
      await sendPasswordResetEmail(user.email, user.name, link);
      
      successResponse(res, 200, 'If this email exists, a password reset link has been sent.');
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/reset-password
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;
      const user = await userRepository.findByResetToken(token);
      if (!user || !user.resetPasswordExpiresAt) {
        next(new BadRequestError('Invalid or expired reset token', 'INVALID_RESET_TOKEN'));
        return;
      }
      
      const expiryTime = new Date(user.resetPasswordExpiresAt).getTime();
      if (expiryTime < Date.now()) {
        next(new BadRequestError('Password reset token has expired', 'EXPIRED_RESET_TOKEN'));
        return;
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const newTokenVersion = (user.tokenVersion ?? 1) + 1;
      
      await userRepository.update(user.id, {
        password: hashedPassword,
        tokenVersion: newTokenVersion,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
        failedAttempts: 0,
        lockedUntil: null,
      });
      
      successResponse(res, 200, 'Password has been reset successfully. You can now sign in.');
    } catch (error) {
      next(error);
    }
  }
}
export default AuthController;
