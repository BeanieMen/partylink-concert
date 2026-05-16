import { type NextFunction, type Request, type Response } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  let logged = false;

  const writeLog = (event: 'finish' | 'close'): void => {
    if (logged) {
      return;
    }

    logged = true;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const userAgent = req.get('user-agent') ?? '-';
    const ip = req.ip || req.socket.remoteAddress || '-';
    const aborted = event === 'close' && !res.writableEnded ? ' aborted=true' : '';
    const authUser = req.authUserId ? ` userId=${req.authUserId}` : '';

    console.log(
      `[api] ${req.method} ${req.originalUrl} status=${res.statusCode} duration=${durationMs.toFixed(1)}ms reqId=${req.requestId} ip=${ip}${authUser}${aborted} ua="${userAgent}"`,
    );
  };

  // Track both events to capture normal completions and client-aborted requests.
  res.on('finish', () => writeLog('finish'));
  res.on('close', () => writeLog('close'));

  next();
}