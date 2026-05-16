import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();

export const PROFILE_PICS_DIR = path.resolve(PROJECT_ROOT, 'uploads/profile-pictures');
export const PORTRAITS_DIR = path.resolve(PROJECT_ROOT, 'uploads/portraits');
export const BANNERS_DIR = path.resolve(PROJECT_ROOT, 'banners');

for (const dir of [PROFILE_PICS_DIR, PORTRAITS_DIR, BANNERS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}