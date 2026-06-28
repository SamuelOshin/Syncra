import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { signUpSchema, signInSchema } from './auth.schema';
import { authLimiter } from '../../middleware/rate-limit.middleware';

const router = Router();
const authController = new AuthController();

router.post('/signup', authLimiter, validate(signUpSchema), (req, res, next) => authController.signUp(req, res, next));
router.post('/signin', authLimiter, validate(signInSchema), (req, res, next) => authController.signIn(req, res, next));
router.post('/signout', (req, res, next) => authController.signOut(req, res, next));
router.get('/me', (req, res, next) => authController.me(req, res, next));

router.get('/google', authLimiter, (req, res, next) => authController.handleOAuthRedirect(req, res, next));
router.get('/google/callback', authLimiter, (req, res, next) => authController.handleOAuthCallback(req, res, next));
router.get('/microsoft', authLimiter, (req, res, next) => authController.handleOAuthRedirect(req, res, next));
router.get('/microsoft/callback', authLimiter, (req, res, next) => authController.handleOAuthCallback(req, res, next));

export default router;
