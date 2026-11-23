import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, PROPERTY_PARAM_KEY } from '../decorators/roles.decorator';

@Injectable()
export class PropertyAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName =
      this.reflector.getAllAndOverride<string>(PROPERTY_PARAM_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'propertyId';

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) {
      throw new ForbiddenException('Chưa xác thực người dùng');
    }

    if (user.role === 'TENANT') {
      return true;
    }

    const propertyId =
      request.params?.[paramName] ||
      request.body?.[paramName] ||
      request.query?.[paramName];

    if (!propertyId || typeof propertyId !== 'string') {
      throw new BadRequestException(`Thiếu tham số ${paramName} để kiểm tra quyền khu trọ`);
    }

    const access = await this.prisma.userPropertyAccess.findUnique({
      where: {
        userId_propertyId: {
          userId: user.id,
          propertyId,
        },
      },
    });

    if (!access) {
      throw new ForbiddenException('Bạn không có quyền truy cập khu trọ này');
    }

    return true;
  }
}
