import { type Response } from 'express';

export function ok<T>(res: Response, data: T, meta: { requestId: string }, status = 200): void {
  res.status(status).json({
    success: true,
    data,
    meta: {
      requestId: meta.requestId,
      timestamp: new Date().toISOString(),
    },
  });
}

export function paged<T>(
  res: Response,
  data: T[],
  meta: { requestId: string; nextCursor: string | null; hasMore: boolean; limit: number },
): void {
  res.status(200).json({
    success: true,
    data,
    meta: {
      requestId: meta.requestId,
      timestamp: new Date().toISOString(),
      nextCursor: meta.nextCursor,
      hasMore: meta.hasMore,
      limit: meta.limit,
    },
  });
}
