import { type NextFunction, type Request, type Response } from 'express';

const buckets = new Map<string, { count: number; resetAt: number }>();

function keyFor(req: Request): string {
  return `${req.ip}:${req.path}`;
}

export function rateLimit(max = 120, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = keyFor(req);
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    existing.count += 1;
    if (existing.count > max) {
      res.status(429).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Too many requests',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
}
