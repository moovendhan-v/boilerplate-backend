import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

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
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const result = await this.authService.login(user);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  async register(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;
      const user = await this.authService.register({ email, password, name });
      res.status(201).json(user);
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ message: 'Email already exists' });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  async verifyToken(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const decoded = this.authService.verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      res.json(decoded);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}