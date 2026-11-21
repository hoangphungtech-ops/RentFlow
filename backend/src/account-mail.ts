import nodemailer from 'nodemailer';
import { z } from 'zod';
import { production } from './browser-session';

export function configureMail() {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return undefined;
  const from = z.email().parse(process.env.SMTP_FROM);
  const port = z.coerce.number().int().min(1).max(65535).parse(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (Boolean(user) !== Boolean(pass)) throw new Error('Incomplete SMTP authentication');
  const security = z.enum(['auto', 'tls', 'starttls']).parse(process.env.SMTP_SECURITY || 'auto');
  const secure = security === 'tls' || (security === 'auto' && port === 465);
  const localTest = security === 'auto' && !secure && !production() && host === '127.0.0.1' && process.env.SMTP_LOOPBACK_TEST === '1';
  const transport = nodemailer.createTransport({
    host, port, secure, requireTLS: !secure && !localTest, ignoreTLS: localTest,
    auth: user && pass ? { user, pass } : undefined,
    tls: { minVersion: 'TLSv1.2' }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  return async (to: string, action: 'reset' | 'email', code: string) => {
    const subject = action === 'reset' ? 'RentFlow — đặt lại mật khẩu' : 'RentFlow — xác minh địa chỉ email';
    const result = await transport.sendMail({
      from, to, subject,
      text: 'Mã: ' + code + '\nMã dùng một lần, hết hạn sau 20 phút. Nhập mã trên RentFlow. Nếu bạn không yêu cầu, hãy bỏ qua.',
    });
    if (!result.accepted.length) throw new Error('SMTP did not accept delivery');
  };
}

export const sendAccountMail = configureMail();
