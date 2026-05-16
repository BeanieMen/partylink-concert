import path from 'path';

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.V1_PORT ?? process.env.PORT ?? 4000),
  LOCAL_DB_PATH: process.env.LOCAL_DB_PATH ?? path.resolve(process.cwd(), 'local-v1.db'),
  CORS_ORIGIN:
    process.env.CORS_ORIGIN ??
    'http://localhost:8081,http://localhost:5173,http://localhost,capacitor://localhost,ionic://localhost',
};
