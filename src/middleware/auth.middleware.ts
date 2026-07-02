import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { UserRepository } from '../modules/auth/auth.repository';
import { UnauthorizedError } from '../utils/errors';

const userRepository = new UserRepository();

interface AccessTokenPayload {
  id: string;
}

interface RefreshTokenPayload {
  id: string;
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        preferredLanguage?: string;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const accessToken = req.cookies['accessToken'];
  const refreshToken = req.cookies['refreshToken'];

  // Helper to clear cookies on auth failure (must match original cookie options)
  const clearAuthCookies = () => {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    };
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
  };

  // 1. Try to verify the Access Token
  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, config.jwtAccessSecret) as AccessTokenPayload;
      const user = await userRepository.findById(decoded.id);
      if (!user) {
        clearAuthCookies();
        return next(new UnauthorizedError('User not found', 'USER_NOT_FOUND'));
      }
      
      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        preferredLanguage: user.preferredLanguage || 'en',
      };
      return next();
    } catch (err: any) {
      // If the access token is expired, we fall through to try the refresh token.
      // If it's any other error (invalid signature, etc.), we reject immediately.
      if (err.name !== 'TokenExpiredError') {
        clearAuthCookies();
        return next(new UnauthorizedError('Invalid access token', 'INVALID_ACCESS_TOKEN'));
      }
    }
  }

  // 2. If Access Token is missing or expired, try the Refresh Token
  if (!refreshToken) {
    clearAuthCookies();
    return next(new UnauthorizedError('Authentication required', 'UNAUTHORIZED'));
  }

  try {
    const decodedRefresh = jwt.verify(refreshToken, config.jwtRefreshSecret) as RefreshTokenPayload;
    
    // Check if the user exists and the token version matches
    const user = await userRepository.findById(decodedRefresh.id);
    if (!user || user.tokenVersion !== decodedRefresh.tokenVersion) {
      clearAuthCookies();
      return next(new UnauthorizedError('Session has expired or been revoked', 'SESSION_REVOKED'));
    }

    // Generate a new Access Token
    const newAccessToken = jwt.sign(
      { id: user.id },
      config.jwtAccessSecret,
      { expiresIn: config.jwtAccessExpiresIn as any }
    );

    // Set the new Access Token cookie
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Populate req.user
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      preferredLanguage: user.preferredLanguage || 'en',
    };

    return next();
  } catch (err) {
    clearAuthCookies();
    return next(new UnauthorizedError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN'));
  }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const accessToken = req.cookies['accessToken'];
  const refreshToken = req.cookies['refreshToken'];

  const clearAuthCookies = () => {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
    };
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
  };

  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, config.jwtAccessSecret) as AccessTokenPayload;
      const user = await userRepository.findById(decoded.id);
      if (user) {
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          preferredLanguage: user.preferredLanguage || 'en',
        };
        return next();
      }
    } catch (err: any) {
      if (err.name !== 'TokenExpiredError') {
        clearAuthCookies();
        return next();
      }
    }
  }

  if (refreshToken) {
    try {
      const decodedRefresh = jwt.verify(refreshToken, config.jwtRefreshSecret) as RefreshTokenPayload;
      const user = await userRepository.findById(decodedRefresh.id);
      if (user && user.tokenVersion === decodedRefresh.tokenVersion) {
        const newAccessToken = jwt.sign(
          { id: user.id },
          config.jwtAccessSecret,
          { expiresIn: config.jwtAccessExpiresIn as any }
        );
        res.cookie('accessToken', newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 15 * 60 * 1000,
        });
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          preferredLanguage: user.preferredLanguage || 'en',
        };
      }
    } catch (err) {
      clearAuthCookies();
    }
  }

  return next();
}

export default requireAuth;
