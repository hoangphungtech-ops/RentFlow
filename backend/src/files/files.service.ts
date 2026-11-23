import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AuditLogService } from '../audit/audit.service';
import { AuthUser } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

export interface UploadedBinaryFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class FilesService {
  private readonly uploadDir: string;
  private readonly tempDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {
    this.uploadDir = join(process.cwd(), this.config.get<string>('UPLOAD_DIR') || 'uploads');
    this.tempDir = join(this.uploadDir, 'temp');
    mkdirSync(this.uploadDir, { recursive: true });
    mkdirSync(this.tempDir, { recursive: true });
  }

  private detectRealMimeType(buffer: Buffer): { mimeType: string; ext: string } | null {
    // JPEG: FF D8 FF
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mimeType: 'image/jpeg', ext: 'jpg' };
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { mimeType: 'image/png', ext: 'png' };
    }
    // PDF: %PDF- (25 50 44 46 2D)
    if (
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d
    ) {
      return { mimeType: 'application/pdf', ext: 'pdf' };
    }
    return null;
  }

  async uploadFile(
    user: AuthUser,
    file: UploadedBinaryFile | undefined,
    entityType: string,
    entityId: string,
    propertyId?: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn tệp cần tải lên');
    }
    if (!entityType || !entityId) {
      throw new BadRequestException('Thiếu thông tin entityType hoặc entityId');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('Dung lượng tệp vượt quá giới hạn tối đa 5 MB');
    }

    // Kiểm tra quyền tải lên
    if (user.role === 'TENANT') {
      if (entityType !== 'PAYMENT_PROOF') {
        throw new ForbiddenException('Người thuê chỉ được tải lên minh chứng chuyển khoản');
      }
    } else {
      if (!propertyId) {
        throw new BadRequestException('Thiếu propertyId để kiểm tra quyền tải tệp');
      }
      const access = await this.prisma.userPropertyAccess.findUnique({
        where: { userId_propertyId: { userId: user.id, propertyId } },
      });
      if (!access) {
        throw new ForbiddenException('Bạn không có quyền tải tệp lên khu trọ này');
      }
    }

    // Kiểm tra định dạng thực tế bằng magic bytes phía server
    const detected = this.detectRealMimeType(file.buffer);
    if (!detected) {
      throw new BadRequestException('Định dạng không hợp lệ. Chỉ chấp nhận JPEG, PNG hoặc PDF');
    }

    const storageKey = `${Date.now()}-${randomUUID()}.${detected.ext}`;
    const tempPath = join(this.tempDir, `${storageKey}.tmp`);
    const finalPath = join(this.uploadDir, storageKey);

    try {
      // Ghi tệp tạm trước, ghi DB thành công mới chốt tệp chính để tránh tệp mồ côi
      writeFileSync(tempPath, file.buffer);

      const asset = await this.prisma.fileAsset.create({
        data: {
          entityType,
          entityId,
          uploadedById: user.id,
          storageKey,
          mimeType: detected.mimeType,
          sizeBytes: file.size,
        },
      });

      renameSync(tempPath, finalPath);

      await this.auditLog.log({
        actorId: user.id,
        entityType: 'FileAsset',
        entityId: asset.id,
        action: 'FILE_UPLOADED',
        newValue: {
          targetEntityType: entityType,
          targetEntityId: entityId,
          mimeType: detected.mimeType,
          sizeBytes: file.size,
        },
      });

      return {
        id: asset.id,
        entityType: asset.entityType,
        entityId: asset.entityId,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        createdAt: asset.createdAt,
      };
    } catch (err) {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
      if (existsSync(finalPath)) {
        unlinkSync(finalPath);
      }
      throw err;
    }
  }

  async downloadFile(user: AuthUser, fileId: string) {
    const asset = await this.prisma.fileAsset.findUnique({
      where: { id: fileId },
    });
    if (!asset) {
      throw new NotFoundException('Không tìm thấy tệp minh chứng');
    }

    // Kiểm tra quyền tải xuống
    if (user.role === 'TENANT') {
      if (asset.uploadedById !== user.id) {
        throw new ForbiddenException('Bạn không có quyền truy cập tệp của người khác');
      }
    } else if (asset.uploadedById !== user.id) {
      const [requesterProps, uploaderProps] = await Promise.all([
        this.prisma.userPropertyAccess.findMany({
          where: { userId: user.id },
          select: { propertyId: true },
        }),
        this.prisma.userPropertyAccess.findMany({
          where: { userId: asset.uploadedById },
          select: { propertyId: true },
        }),
      ]);

      const requesterSet = new Set(requesterProps.map((p) => p.propertyId));
      const hasSharedProperty = uploaderProps.some((p) => requesterSet.has(p.propertyId));

      if (!hasSharedProperty) {
        throw new ForbiddenException('Bạn không có quyền tải tệp thuộc khu trọ khác');
      }
    }

    const fullPath = join(this.uploadDir, asset.storageKey);
    if (!existsSync(fullPath)) {
      throw new NotFoundException('Tệp vật lý không còn tồn tại trên máy chủ');
    }

    return {
      mimeType: asset.mimeType,
      storageKey: asset.storageKey,
      stream: new StreamableFile(createReadStream(fullPath)),
    };
  }
}
