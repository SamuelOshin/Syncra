import { Request, Response, NextFunction } from 'express';
import { UserRepository, User } from './auth.repository';
import { successResponse } from '../../utils/response';
import { ConflictError, UnauthorizedError, ForbiddenError, BadRequestError } from '../../utils/errors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Extend express-session types for type safety
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      name: string;
      email: string;
    };
    warnedDemoAuth?: boolean;
  }
}

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

      // Establish session
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
      };

      successResponse(res, 200, 'Login successful', {
        user: req.session.user
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/signout
  async signOut(req: Request, res: Response, next: NextFunction): Promise<void> {
    req.session.destroy((err) => {
      if (err) {
        next(err);
        return;
      }
      res.clearCookie('syncra.sid');
      successResponse(res, 200, 'Logout successful');
    });
  }

  // GET /api/auth/me
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.session.user) {
      next(new UnauthorizedError('You must be logged in to access this resource', 'UNAUTHORIZED'));
      return;
    }

    successResponse(res, 200, 'Profile retrieved successfully', {
      user: req.session.user,
      warnedDemoAuth: req.session.warnedDemoAuth || false,
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
        };
        await userRepository.create(user);
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
      };
      req.session.warnedDemoAuth = true;

      // Redirect to main dashboard
      res.redirect('/');
      return;
    }

    next(new BadRequestError('Invalid authorization code', 'INVALID_AUTH_CODE'));
  }
}
export default AuthController;
