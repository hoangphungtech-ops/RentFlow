import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { AccountCodeKind } from '@prisma/client';
import { actorSelect, db, matchesPassword, passwordHash, SessionGuard, SessionRequest, tokenHash, Tx } from './auth';
import { production, setBrowserSession, webRequest } from './browser-session';
import { allow, atomic, audit, found, id, label, parse, requireCondition } from './rules';

const password = z.string().min(1).max(128);
const strongPassword = z.string().min(12).max(128);
const username = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_.-]{2,31}$/);
const email = z.email().max(254).toLowerCase();
const role = z.enum(['STAFF', 'ACCOUNTANT', 'RENTER']);
const confirmation = { newPassword: strongPassword, confirmPassword: strongPassword };
const managedSelect = {
  ...actorSelect, lockedAt: true, emailVerifiedAt: true,
  access: { select: { propertyId: true } },
} as const;
const invalidCode = () => new UnauthorizedException('Mã không hợp lệ hoặc đã hết hạn.');

export async function issueCode(tx: Tx, userId: string, kind: AccountCodeKind) {
  const code = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + (kind === 'RESET' ? 20 : 1440) * 60_000);
  await tx.accountCode.upsert({
    where: { userId_kind: { userId, kind } },
    create: { userId, kind, hash: tokenHash(code), expiresAt },
    update: { hash: tokenHash(code), expiresAt },
  });
  return { code, expiresAt };
}

async function revoke(tx: Tx, userId: string) {
  await tx.session.deleteMany({ where: { userId } });
  await tx.accountCode.deleteMany({ where: { userId } });
}

@Controller()
export class AccountAuthentication {
  @Post('login')
  @HttpCode(200)
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    const input = parse(z.object({ identifier: label(254).optional(), email: email.optional(), password })
      .refine(value => Boolean(value.identifier ?? value.email), 'Cần tên đăng nhập hoặc email'), body);
    const identifier = (input.identifier ?? input.email)!.toLowerCase();
    const result = await atomic(async tx => {
      const user = await tx.user.findUnique({ where: identifier.includes('@') ? { email: identifier } : { username: identifier },
        select: { ...actorSelect, passwordHash: true, lockedAt: true, isDemo: true } });
      const valid = matchesPassword(input.password, user?.passwordHash ?? null);
      if (!user || !valid || user.lockedAt || (production() && user.isDemo)) {
        throw new UnauthorizedException('Tên đăng nhập, email hoặc mật khẩu không hợp lệ.');
      }
      const { passwordHash: _password, lockedAt: _locked, isDemo: _demo, ...actor } = user;
      const token = randomBytes(32).toString('hex');
      await tx.session.create({ data: { tokenHash: tokenHash(token), userId: actor.id, expiresAt: new Date(Date.now() + 8 * 3600_000) } });
      return { token, actor };
    });
    res.setHeader('Cache-Control', 'no-store');
    if (!webRequest(req)) return result;
    setBrowserSession(res, result.token);
    return { actor: result.actor };
  }

  @Post('auth/forgot-password')
  @HttpCode(200)
  async forgot(@Body() body: unknown) {
    const data = parse(z.object({ email }), body);
    await db.user.updateMany({
      where: { email: data.email, lockedAt: null, passwordHash: { not: null }, ...(production() ? { isDemo: false } : {}) },
      data: { recoveryRequestedAt: new Date() },
    });
    return { message: 'Nếu thông tin phù hợp, yêu cầu sẽ được xử lý qua kênh hỗ trợ đã xác minh.' };
  }

  @Post('auth/activate')
  @HttpCode(200)
  activate(@Body() body: unknown) { return this.consume('INVITE', body); }

  @Post('auth/reset-password')
  @HttpCode(200)
  reset(@Body() body: unknown) { return this.consume('RESET', body); }

  private async consume(kind: AccountCodeKind, body: unknown) {
    const input = parse(z.object({ code: z.string().regex(/^[a-f0-9]{64}$/), ...confirmation }), body);
    requireCondition(input.newPassword === input.confirmPassword, 'Mật khẩu xác nhận chưa khớp.');
    const hash = tokenHash(input.code);
    await atomic(async tx => {
      const record = await tx.accountCode.findUnique({ where: { hash }, include: { user: true } });
      if (!record || record.kind !== kind || record.expiresAt <= new Date() || record.user.lockedAt ||
          (production() && record.user.isDemo) || (kind === 'INVITE' && record.user.passwordHash)) throw invalidCode();
      if (record.user.passwordHash && matchesPassword(input.newPassword, record.user.passwordHash)) {
        requireCondition(false, 'Chọn mật khẩu khác mật khẩu hiện tại.');
      }
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash: passwordHash(input.newPassword), recoveryRequestedAt: null } });
      await revoke(tx, record.userId);
      await audit(tx, { ...record.user }, kind === 'INVITE' ? 'ACCOUNT_ACTIVATED' : 'PASSWORD_RESET', record.userId);
    });
    return { ok: true };
  }
}

@UseGuards(SessionGuard)
@Controller()
export class AccountManagement {
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: SessionRequest, @Res({ passthrough: true }) res: Response) {
    await db.session.deleteMany({ where: { tokenHash: req.tokenHash } });
    if (webRequest(req)) setBrowserSession(res);
    return { ok: true };
  }

  @Get('account/me')
  me(@Req() req: SessionRequest) { return req.actor; }

  @Post('account/sessions/revoke-others')
  async otherSessions(@Req() req: SessionRequest) {
    await atomic(async tx => {
      await tx.session.deleteMany({ where: { userId: req.actor.id, tokenHash: { not: req.tokenHash } } });
      await audit(tx, req.actor, 'OTHER_SESSIONS_REVOKED', req.actor.id);
    });
    return { ok: true };
  }

  @Post('account/password/change')
  async change(@Req() req: SessionRequest, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    const input = parse(z.object({ currentPassword: password, ...confirmation }), body);
    requireCondition(input.newPassword === input.confirmPassword && input.newPassword !== input.currentPassword,
      'Mật khẩu mới phải khác mật khẩu hiện tại và khớp với ô xác nhận.');
    await atomic(async tx => {
      const user = found(await tx.user.findUnique({ where: { id: req.actor.id } }));
      if (!matchesPassword(input.currentPassword, user.passwordHash) || user.lockedAt) throw new UnauthorizedException('Mật khẩu hiện tại không đúng.');
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: passwordHash(input.newPassword), recoveryRequestedAt: null } });
      await revoke(tx, user.id);
      await audit(tx, req.actor, 'PASSWORD_CHANGED', user.id);
    });
    if (webRequest(req)) setBrowserSession(res);
    return { ok: true };
  }

  @Get('accounts')
  async list(@Req() { actor }: SessionRequest) {
    allow(actor, 'OWNER');
    const users = await db.user.findMany({
      where: { managedById: actor.id }, select: { ...managedSelect, passwordHash: true }, orderBy: { fullName: 'asc' },
    });
    return users.map(({ passwordHash: hash, ...user }) => ({ ...user, active: Boolean(hash) }));
  }

  @Post('accounts')
  async create(@Req() { actor }: SessionRequest, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    allow(actor, 'OWNER');
    const input = parse(z.object({ username, email, fullName: label(120), role, propertyId: id }), body);
    res.setHeader('Cache-Control', 'no-store');
    return atomic(async tx => {
      const { propertyId, ...profile } = input;
      found(await tx.property.findFirst({ where: { id: propertyId, ownerId: actor.id } }));
      const user = await tx.user.create({ data: { ...profile, managedById: actor.id }, select: actorSelect });
      if (user.role !== 'RENTER') await tx.propertyAccess.create({ data: { propertyId, userId: user.id } });
      await audit(tx, actor, 'ACCOUNT_CREATED', user.id);
      return { user, invitation: await issueCode(tx, user.id, 'INVITE') };
    });
  }

  @Post('accounts/:userId/link-tenant')
  async linkTenant(@Req() { actor }: SessionRequest, @Param('userId') userId: string, @Body() body: unknown) {
    allow(actor, 'OWNER');
    const { tenantId } = parse(z.object({ tenantId: id }), body);
    return atomic(async tx => {
      found(await tx.user.findFirst({ where: { id: userId, managedById: actor.id, role: 'RENTER' } }));
      const tenant = found(await tx.tenant.findFirst({ where: { id: tenantId, property: { ownerId: actor.id } } }));
      requireCondition(!tenant.userId || tenant.userId === userId, 'Hồ sơ đã được liên kết với tài khoản khác.');
      await tx.tenant.update({ where: { id: tenant.id }, data: { userId } });
      await audit(tx, actor, 'RENTER_PROFILE_LINKED', userId, tenant.id);
      return { ok: true };
    });
  }

  @Post('accounts/:userId/profile')
  async edit(@Req() { actor }: SessionRequest, @Param('userId') userId: string, @Body() body: unknown) {
    allow(actor, 'OWNER');
    const input = parse(z.object({ fullName: label(120), username, role, email: email.optional() }), body);
    return atomic(async tx => {
      const user = found(await tx.user.findFirst({ where: { id: userId, managedById: actor.id } }));
      requireCondition((user.role === 'RENTER') === (input.role === 'RENTER'), 'Không thể chuyển đổi giữa người thuê và nhân viên.');
      const emailChanged = Boolean(input.email && input.email !== user.email);
      requireCondition(!emailChanged || !user.passwordHash, 'Đổi email tài khoản đã kích hoạt cần quy trình xác minh của người vận hành.');
      const profile = await tx.user.update({ where: { id: userId }, data: {
        ...input, ...(emailChanged ? { emailVerifiedAt: null, recoveryRequestedAt: null } : {}),
      }, select: actorSelect });
      if (user.role !== input.role || emailChanged) await revoke(tx, userId);
      await audit(tx, actor, 'ACCOUNT_UPDATED', userId);
      return profile;
    });
  }

  @Post('accounts/:userId/control')
  async control(@Req() { actor }: SessionRequest, @Param('userId') userId: string,
    @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    allow(actor, 'OWNER');
    const { action } = parse(z.object({ action: z.enum(['LOCK', 'UNLOCK', 'REVOKE', 'INVITE']) }), body);
    res.setHeader('Cache-Control', 'no-store');
    return atomic(async tx => {
      const user = found(await tx.user.findFirst({ where: { id: userId, managedById: actor.id } }));
      await audit(tx, actor, 'ACCOUNT_' + action, userId);
      if (action === 'INVITE') {
        requireCondition(!user.lockedAt && !user.passwordHash, 'Chỉ cấp lời mời cho tài khoản đang chờ kích hoạt.');
        return { invitation: await issueCode(tx, userId, 'INVITE') };
      }
      if (action !== 'REVOKE') await tx.user.update({
        where: { id: userId }, data: { lockedAt: action === 'LOCK' ? new Date() : null },
      });
      if (action !== 'UNLOCK') await revoke(tx, userId);
      return { ok: true };
    });
  }
}
