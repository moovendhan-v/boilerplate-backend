import { Router } from 'express';
import { BoilerplateController } from '../controllers/boilerplate.controller';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();
const boilerplateController = new BoilerplateController();

// Public routes
router.get('/', asyncHandler(boilerplateController.listBoilerplates.bind(boilerplateController)));
router.get('/:id', asyncHandler(boilerplateController.getBoilerplate.bind(boilerplateController)));

// Protected routes
router.use(authenticate);
router.post('/', asyncHandler(boilerplateController.createBoilerplate.bind(boilerplateController)));
router.put('/:id', asyncHandler(boilerplateController.updateBoilerplate.bind(boilerplateController)));
router.delete('/:id', asyncHandler(boilerplateController.deleteBoilerplate.bind(boilerplateController)));

export default router;