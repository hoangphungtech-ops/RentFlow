import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

export const db = new PrismaClient();
export type Tx = Prisma.TransactionClient;
export const actorSelect = { id: true, email: true, fullName: true, role: true } as const;
export type Actor = Prisma.UserGetPayload<{ select: typeof actorSelect }>;
export type SessionRequest = { headers: { authorization?: string }; actor: Actor; tokenHash: string };

export function passwordHash(password: string, salt = randomBytes(16).toString('hex')) {
  return salt + ':' + scryptSync(password, salt, 48).toString('hex');
}

export function matchesPassword(password: string, stored: string | null) {
  const candidate = passwordHash(password, stored?.split(':')[0] ?? '00000000000000000000000000000000');
  return stored !== null && stored.length === candidate.length &&
    timingSafeEqual(Buffer.from(stored), Buffer.from(candidate));
}

export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const token = request.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) throw new UnauthorizedException('Vui lòng đăng nhập');
    request.tokenHash = tokenHash(token);
    const session = await db.session.findUnique({
      where: { tokenHash: request.tokenHash },
      include: { user: { select: actorSelect } },
    });
    if (!session || session.expiresAt <= new Date()) throw new UnauthorizedException('Phiên đã hết hạn');
    request.actor = session.user;
    return true;
  }
}
