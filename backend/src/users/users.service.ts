import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuditLogService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserStatusDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async assertOwnerHasProperty(ownerId: string, propertyId: string) {
    const access = await this.prisma.userPropertyAccess.findUnique({
      where: { userId_propertyId: { userId: ownerId, propertyId } },
    });
    if (!access) {
      throw new ForbiddenException('Chủ trọ không có quyền quản lý khu trọ này');
    }
  }

  async listByProperty(actorId: string, propertyId: string) {
    await this.assertOwnerHasProperty(actorId, propertyId);

    const accesses = await this.prisma.userPropertyAccess.findMany({
      where: { propertyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            status: true,
            role: { select: { name: true } },
            createdAt: true,
          },
        },
      },
    });
    return accesses.map((a) => a.user);
  }

  async createUser(actorId: string, dto: CreateUserDto) {
    const role = await this.prisma.role.findUnique({ where: { name: dto.roleName } });
    if (!role || role.name === 'OWNER') {
      throw new BadRequestException('Vai trò không hợp lệ');
    }

    if (dto.propertyId) {
      await this.assertOwnerHasProperty(actorId, dto.propertyId);
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new BadRequestException('Email đã tồn tại trong hệ thống');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
          roleId: role.id,
        },
      });

      if (dto.propertyId) {
        await tx.userPropertyAccess.create({
          data: { userId: user.id, propertyId: dto.propertyId },
        });
      }

      return user;
    });

    await this.auditLog.log({
      actorId,
      entityType: 'User',
      entityId: created.id,
      action: 'USER_CREATED',
      newValue: { email: created.email, role: dto.roleName, propertyId: dto.propertyId ?? null },
    });

    return {
      id: created.id,
      email: created.email,
      fullName: created.fullName,
      role: dto.roleName,
      status: created.status,
    };
  }

  async grantPropertyAccess(actorId: string, targetUserId: string, propertyId: string) {
    await this.assertOwnerHasProperty(actorId, propertyId);

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    await this.prisma.userPropertyAccess.upsert({
      where: { userId_propertyId: { userId: targetUserId, propertyId } },
      update: {},
      create: { userId: targetUserId, propertyId },
    });

    await this.auditLog.log({
      actorId,
      entityType: 'UserPropertyAccess',
      entityId: `${targetUserId}:${propertyId}`,
      action: 'ACCESS_GRANTED',
      newValue: { userId: targetUserId, propertyId },
    });

    return { message: 'Đã cấp quyền truy cập khu trọ' };
  }

  async revokePropertyAccess(actorId: string, targetUserId: string, propertyId: string) {
    await this.assertOwnerHasProperty(actorId, propertyId);

    await this.prisma.$transaction(async (tx) => {
      await tx.userPropertyAccess.deleteMany({
        where: { userId: targetUserId, propertyId },
      });
      await tx.user.update({
        where: { id: targetUserId },
        data: { tokenVersion: { increment: 1 } },
      });
    });

    await this.auditLog.log({
      actorId,
      entityType: 'UserPropertyAccess',
      entityId: `${targetUserId}:${propertyId}`,
      action: 'ACCESS_REVOKED',
      oldValue: { userId: targetUserId, propertyId },
    });

    return { message: 'Đã thu hồi quyền khu trọ và ngắt phiên hiện tại' };
  }

  async updateStatus(actorId: string, targetUserId: string, dto: UpdateUserStatusDto) {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        status: dto.status,
        tokenVersion: { increment: 1 },
      },
    });

    await this.auditLog.log({
      actorId,
      entityType: 'User',
      entityId: targetUserId,
      action: 'USER_STATUS_UPDATED',
      oldValue: { status: target.status },
      newValue: { status: updated.status },
    });

    return { id: updated.id, status: updated.status };
  }
}
