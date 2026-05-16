import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { all, get, run } from '../../db/client';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { HttpError } from '../../types/http';
import { ok } from '../../utils/http';
import path from 'path';
import fs from 'fs';
import { PROFILE_PICS_DIR } from '../../config/paths.js';

const router = Router();

const IMAGE_EXTENSIONS = ['jpeg', 'jpg', 'png', 'webp'] as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function resolveImagePath(dir: string, userId: string) {
  for (const extension of IMAGE_EXTENSIONS) {
    const candidate = path.join(dir, `${userId}.${extension}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function removeExistingUserImages(dir: string, userId: string) {
  for (const extension of IMAGE_EXTENSIONS) {
    const candidate = path.join(dir, `${userId}.${extension}`);
    if (fs.existsSync(candidate)) {
      fs.unlinkSync(candidate);
    }
  }
}

function extensionFromUpload(file: Express.Multer.File) {
  const mimeToExtension: Record<string, (typeof IMAGE_EXTENSIONS)[number]> = {
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  const mimeExtension = mimeToExtension[file.mimetype];
  if (mimeExtension) return mimeExtension;

  const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
    return ext as (typeof IMAGE_EXTENSIONS)[number];
  }

  return null;
}

async function persistUserImage(dir: string, userId: string, file: Express.Multer.File) {
  const extension = extensionFromUpload(file);
  if (!extension) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Only jpeg, png, and webp images are supported');
  }

  removeExistingUserImages(dir, userId);
  const destinationPath = path.join(dir, `${userId}.${extension}`);
  await fs.promises.writeFile(destinationPath, file.buffer);
}

router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await get<{
      id: string;
      email: string;
      username: string;
      display_name: string | null;
      bio: string | null;
      school: string | null;
    }>(
      `SELECT u.id, u.email, u.username, p.display_name, p.bio, p.school
       FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?`,
      [req.authUserId!],
    );

    if (!row) throw new HttpError(404, 'NOT_FOUND', 'User not found');
    const hasProfilePicture = Boolean(resolveImagePath(PROFILE_PICS_DIR, req.authUserId!));

    ok(
      res,
      {
        ...row,
        has_profile_picture: hasProfilePicture,
      },
      { requestId: req.requestId },
    );
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/me/profile',
  requireAuth,
  validate({
    body: z.object({
      displayName: z.string().min(1).max(64).optional(),
      bio: z.string().max(400).optional(),
      school: z.string().max(120).optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const b = req.body as {
        displayName?: string;
        bio?: string;
        school?: string;
      };

      await run(
        `UPDATE user_profiles SET
            display_name = COALESCE(?, display_name),
            bio = COALESCE(?, bio),
            school = COALESCE(?, school),
            updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [
          b.displayName ?? null,
          b.bio ?? null,
          b.school ?? null,
          req.authUserId!,
        ],
      );

      ok(res, { updated: true }, { requestId: req.requestId });
    } catch (error) {
      next(error);
    }
  },
);

router.post('/me/profile-picture', requireAuth, upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Image file is required');
    }

    await persistUserImage(PROFILE_PICS_DIR, req.authUserId!, req.file);
    ok(res, { updated: true }, { requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

router.get(
  '/:userId/profile-picture',
  validate({ params: z.object({ userId: z.string().min(1).max(128) }) }),
  async (req: Request, res: Response) => {
    const userId = req.params.userId;
    if (!userId) {
      res.status(404).end();
      return;
    }

    const picturePath = resolveImagePath(PROFILE_PICS_DIR, userId);
    const defaultPicPath = resolveImagePath(PROFILE_PICS_DIR, 'default_profile');
    if (picturePath && fs.existsSync(picturePath)) {
      res.header('Cross-Origin-Resource-Policy', 'cross-origin');
      res.header('Access-Control-Allow-Origin', '*');
      res.sendFile(picturePath);
      return;
    }
    if (defaultPicPath && fs.existsSync(defaultPicPath)) {
      res.header('Cross-Origin-Resource-Policy', 'cross-origin');
      res.header('Access-Control-Allow-Origin', '*');
      res.sendFile(defaultPicPath);
      return;
    }
    res.status(404).end();
  },
);

router.get(
  '/:userId/parties-attending',
  requireAuth,
  validate({ params: z.object({ userId: z.string().min(1).max(128) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.params.userId !== req.authUserId) {
        throw new HttpError(403, 'FORBIDDEN', 'Cannot access another user attendance list');
      }

      const rows = await all<{
        id: string;
        title: string;
        starts_at: string;
        location_name: string;
        image_url: string | null;
        price_cents: number;
        code: string;
      }>(
        `SELECT p.id, p.title, p.starts_at, p.location_name, p.image_url, p.price_cents, t.code
         FROM tickets t
         JOIN parties p ON p.id = t.party_id
         WHERE t.user_id = ? AND t.status IN ('paid', 'checked_in')`,
        [req.authUserId!],
      );

      const mapped = rows.map((row) => {
        const starts = new Date(row.starts_at);
        return {
          party_id: row.id,
          name: row.title,
          party_date: starts.toISOString().slice(0, 10),
          party_time: starts.toISOString().slice(11, 16),
          location: row.location_name,
          image_url: row.image_url,
          price: row.price_cents,
          ticket_code: row.code,
        };
      });

      ok(res, mapped, { requestId: req.requestId });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
