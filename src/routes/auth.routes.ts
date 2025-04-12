import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();
const authController = new AuthController();

router.post('/login', asyncHandler(authController.login.bind(authController)));
router.post('/register', asyncHandler(authController.register.bind(authController)));
router.post('/verify', asyncHandler(authController.verifyToken.bind(authController)));

export default router;