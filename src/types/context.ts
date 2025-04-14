export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

import { Request, Response } from 'express';

export interface Context {
  user?: User;
  req?: Request;  // Changed from req to request
  res?: Response;  // Changed from res to response
}