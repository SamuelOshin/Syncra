import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { UserRepository } from '../modules/auth/auth.repository';
import { UnauthorizedError } from '../utils/errors';

const userRepository = new UserRepository();

interface AccessTokenPayload {
  id: string;
  name: string;
  email: string;
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
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const accessToken = req.cookies['accessToken'];
  const refreshToken = req.cookies['refreshToken'];

  // Helper to clear cookies on auth failure
  const clearAuthCookies = () => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
  };

  // 1. Try to verify the Access Token
  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, config.jwtAccessSecret) as AccessTokenPayload;
      req.user = {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email,
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
      { id: user.id, name: user.name, email: user.email },
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
    };

    return next();
  } catch (err) {
    clearAuthCookies();
    return next(new UnauthorizedError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN'));
  }
}

export default requireAuth;
