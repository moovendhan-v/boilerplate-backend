import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();
const userController = new UserController();

router.use(authenticate);

router.get('/:id', asyncHandler(userController.getUser.bind(userController)));
router.put('/:id', asyncHandler(userController.updateUser.bind(userController)));
router.delete('/:id', asyncHandler(userController.deleteUser.bind(userController)));

export default router;