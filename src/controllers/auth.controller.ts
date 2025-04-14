import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { HttpStatus, ErrorCode, createError, AppError } from '../utils/errors';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const user = await this.authService.validateUser(email, password);
      if (!user) {
        throw createError(
          'Invalid credentials',
          HttpStatus.UNAUTHORIZED,
          ErrorCode.UNAUTHORIZED
        );
      }

      const result = await this.authService.login(user);
      res.json(result);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
        createError(
          'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          ErrorCode.INTERNAL_SERVER_ERROR
        ).toJSON()
      );
    }
  }

  async register(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;
      const user = await this.authService.register({ email, password, name });
      res.status(HttpStatus.CREATED).json(user);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        return res.status(HttpStatus.CONFLICT).json(
          createError(
            'Email already exists',
            HttpStatus.CONFLICT,
            ErrorCode.CONFLICT
          ).toJSON()
        );
      }
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
        createError(
          'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          ErrorCode.INTERNAL_SERVER_ERROR
        ).toJSON()
      );
    }
  }

  async verifyToken(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        throw createError(
          'No token provided',
          HttpStatus.UNAUTHORIZED,
          ErrorCode.UNAUTHORIZED
        );
      }

      const decoded = this.authService.verifyToken(token);
      if (!decoded) {
        throw createError(
          'Invalid token',
          HttpStatus.UNAUTHORIZED,
          ErrorCode.UNAUTHORIZED
        );
      }

      res.json(decoded);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
        createError(
          'Internal server error',
          HttpStatus.INTERNAL_SERVER_ERROR,
          ErrorCode.INTERNAL_SERVER_ERROR
        ).toJSON()
      );
    }
  }
}