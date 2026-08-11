import { Response } from 'express';

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge?: number;
}

export const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
};

export function setAccessTokenCookie(
  res: Response,
  token: string,
): void {
  res.cookie('access_token', token, {
    ...DEFAULT_COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
}

export function setRefreshTokenCookie(
  res: Response,
  token: string,
): void {
  res.cookie('refresh_token', token, {
    ...DEFAULT_COOKIE_OPTIONS,
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', DEFAULT_COOKIE_OPTIONS);
  res.clearCookie('refresh_token', DEFAULT_COOKIE_OPTIONS);
}
