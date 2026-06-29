import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRepository, User } from './auth.repository';
import { successResponse } from '../../utils/response';
import { ConflictError, UnauthorizedError, ForbiddenError, BadRequestError, NotFoundError } from '../../utils/errors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import config from '../../config';

const userRepository = new UserRepository();

export class AuthController {
  
  // POST /api/auth/signup
  async signUp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password } = req.body;

      // Check if email already exists
      const existingUser = await userRepository.findByEmail(email.toLowerCase());
      if (existingUser) {
        next(new ConflictError('Email is already registered', 'EMAIL_ALREADY_REGISTERED'));
        return;
      }

      // Hash password (async)
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Generate UUID (standard RFC4122 v4)
      const userId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

      const newUser: User = {
        id: userId,
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        tokenVersion: 1,
      };

      await userRepository.create(newUser);

      successResponse(res, 201, 'User registered successfully', {
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
      if (!user || !user.password) {
        next(new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS'));
        return;
      }

      // Compare password hash (async)
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        next(new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS'));
        return;
      }

      const tokenVersion = user.tokenVersion ?? 1;

      // Generate Access Token (15 minutes)
      const accessToken = jwt.sign(
        { id: user.id, name: user.name, email: user.email },
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
      
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      
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
      const { code } = req.query;

      if (code === 'mock-sandbox-code') {
        // Sandbox Login
        const mockEmail = `john.doe@${provider.toLowerCase()}-sandbox.com`;
        let user = await userRepository.findByEmail(mockEmail);

        if (!user) {
          // Create sandbox user
          const userId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
          user = {
            id: userId,
            name: `John Doe (${provider})`,
            email: mockEmail,
            password: 'oauth-sandbox-dummy-password',
            tokenVersion: 1,
          };
          await userRepository.create(user);
        }

        const tokenVersion = user.tokenVersion ?? 1;

        // Generate Access Token (15 minutes)
        const accessToken = jwt.sign(
          { id: user.id, name: user.name, email: user.email },
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
          maxAge: 15 * 60 * 1000,
        });

        // Set Refresh Token Cookie
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
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

      const { name, email } = req.body;
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
      });

      // Issue a new Access Token with updated name/email
      const accessToken = jwt.sign(
        { id: userId, name, email: email.toLowerCase() },
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
}
export default AuthController;
