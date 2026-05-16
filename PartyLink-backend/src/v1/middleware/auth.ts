import { type NextFunction, type Request, type Response } from 'express';
import { HttpError } from '../types/http';
import { get, run } from '../db/client';

function normalizeUsername(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'user';
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const userId = req.header('x-user-id')?.trim();

  if (!userId) {
    next(new HttpError(401, 'UNAUTHORIZED', 'Missing x-user-id header'));
    return;
  }

  try {
    req.authUserId = userId;

    const existing = await get<{ id: string }>('SELECT id FROM users WHERE id = ?', [userId]);
    if (!existing) {
      const username = normalizeUsername(userId);
      await run('INSERT INTO users(id, email, username) VALUES(?,?,?)', [
        userId,
        `${username}@local.partylink`,
        username,
      ]);
      await run('INSERT INTO user_profiles(user_id, display_name) VALUES(?,?)', [userId, username]);
    }

    next();
  } catch (error) {
    next(error);
  }
}
