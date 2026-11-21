import type { Request, Response } from 'express';
export const sessionCookie = 'rentflow_session';
export const webRequest = (request: Request) => request.get('x-rentflow-web') === '1';
export const production = () => process.env.NODE_ENV === 'production' || Boolean(process.env.PUBLIC_ORIGIN);
export function setBrowserSession(response: Response, token?: string) {
  const options = { httpOnly: true, sameSite: 'strict' as const, secure: production(), path: '/api' };
  if (token) response.cookie(sessionCookie, token, { ...options, maxAge: 8 * 3600_000 });
  else response.clearCookie(sessionCookie, options);
}
