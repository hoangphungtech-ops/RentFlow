import type { NextFunction, Request, Response } from 'express';

export function sensitiveRateLimit(req: Request, res: Response, next: NextFunction) {
  const path = req.path.toLowerCase().replace(/\/+$/, '');
  const policy = req.method === 'POST' && limits.get(path);
  if (!policy) return next();
  const now = Date.now();
  if (now > nextSweep) {
    for (const [key, session] of sessions) if (session.reset <= now) sessions.delete(key);
    nextSweep = now + 60_000;
  }
  const key = (req.ip ?? req.socket.remoteAddress ?? 'unknown') + ':' + path;
  const session = sessions.get(key);
  if (session && session.reset > now) {
    if (session.count >= policy.count) {
      res.setHeader('Retry-After', String(Math.ceil((session.reset - now) / 1000)));
      return res.status(429).json({ message: 'Vui lòng chờ trước khi thử lại.' });
    }
    session.count++;
  } else {
    if (sessions.size >= 20000) return res.status(429).json({ message: 'Vui lòng thử lại sau.' });
    sessions.set(key, { count: 1, reset: now + policy.window });
  }
  return next();
}

const sessions = new Map<string, { count: number; reset: number }>();
let nextSweep = 0;
const limits = new Map([
  ['/api/auth/forgot-password', { count: 8, window: 60_000 }],
  ['/api/auth/reset-password', { count: 12, window: 60_000 }],
  ['/api/auth/activate', { count: 12, window: 60_000 }],
  ['/api/account/password/change', { count: 12, window: 60_000 }],
  ['/api/login', { count: 30, window: 60_000 }],
  ['/api/trials', { count: 20, window: 60_000 }],
  ['/api/account/deletion-request', { count: 6, window: 60_000 }],
]);
