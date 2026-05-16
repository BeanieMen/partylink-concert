import { type NextFunction, type Request, type Response } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      authUserId?: string;
    }
  }
}

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  req.requestId = req.header('x-request-id') ?? crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}
