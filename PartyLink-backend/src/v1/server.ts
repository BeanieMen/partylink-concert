import { config } from 'dotenv';
import { createApp } from './app';
import { env } from './config/env';
import { migrate } from './db/migrate';

async function bootstrap(): Promise<void> {
  config();
  await migrate();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[v1] API running on http://localhost:${env.PORT}`);
    console.log(`[v1] Local database file: ${env.LOCAL_DB_PATH}`);
  });
}

bootstrap().catch((err) => {
  console.error('[v1] Failed to start', err);
  process.exit(1);
});
