import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { AuditLogService } from '../audit/audit.service';
import { UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInvitationDto, CreateInvitationDto } from './invitations.dto';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async createInvitation(actorId: string, dto: CreateInvitationDto) {
    const access = await this.prisma.userPropertyAccess.findUnique({
      where: {
        userId_propertyId: { userId: actorId, propertyId: dto.propertyId },
      },
    });
    if (!access) {
      throw new ForbiddenException('Bạn không có quyền tạo lời mời cho khu trọ này');
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const hours = dto.expiresInHours ?? 48;
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        tokenHash,
        tenantId: dto.tenantId,
        leaseId: dto.leaseId,
        createdById: actorId,
        expiresAt,
      },
    });

    await this.auditLog.log({
      actorId,
      entityType: 'Invitation',
      entityId: invitation.id,
      action: 'INVITATION_CREATED',
      newValue: {
        tenantId: dto.tenantId,
        leaseId: dto.leaseId,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      invitationId: invitation.id,
      inviteToken: rawToken,
      expiresAt,
    };
  }

  async acceptInvitation(dto: AcceptInvitationDto) {
    const tokenHash = this.hashToken(dto.token.trim());
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      throw new BadRequestException('Mã lời mời không hợp lệ');
    }
    if (invitation.usedAt) {
      throw new BadRequestException('Lời mời này đã được sử dụng');
    }
    if (invitation.expiresAt <= new Date()) {
      throw new BadRequestException('Lời mời này đã hết hạn');
    }

    const tenantRole = await this.prisma.role.findUnique({
      where: { name: 'TENANT' },
    });
    if (!tenantRole) {
      throw new BadRequestException('Chưa cấu hình vai trò TENANT trong hệ thống');
    }

    const email = dto.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      // Đảm bảo lời mời chỉ dùng đúng 1 lần kể cả khi gửi trùng đồng thời
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('Lời mời này đã được sử dụng');
      }

      const existingUser = await tx.user.findUnique({
        where: { email },
        include: { role: true },
      });

      if (existingUser) {
        if (existingUser.role.name !== 'TENANT') {
          throw new BadRequestException('Email này thuộc tài khoản quản lý, không thể dùng cho người thuê');
        }
        return existingUser;
      }

      return tx.user.create({
        data: {
          email,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
          roleId: tenantRole.id,
          status: UserStatus.ACTIVE,
        },
        include: { role: true },
      });
    });

    await this.auditLog.log({
      actorId: user.id,
      entityType: 'Invitation',
      entityId: invitation.id,
      action: 'INVITATION_ACCEPTED',
      newValue: {
        userId: user.id,
        tenantId: invitation.tenantId,
        leaseId: invitation.leaseId,
      },
    });

    return {
      message: 'Kích hoạt tài khoản người thuê thành công',
      userId: user.id,
      tenantId: invitation.tenantId,
      leaseId: invitation.leaseId,
    };
  }
}
