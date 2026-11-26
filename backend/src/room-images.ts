import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Response } from 'express';
import sharp from 'sharp';
import { db, SessionGuard, SessionRequest } from './auth';
import { allow, atomic, audit, found, leaseScope, propertyScope } from './rules';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_PIXELS = 24_000_000;
const MAX_IMAGES_PER_ROOM = 12;
const IMAGE_KEY = /^[0-9a-f-]{36}\.webp$/;

export type UploadedImage = { buffer: Buffer; mimetype: string; size: number };
type ProcessedImage = { buffer: Buffer; width: number; height: number };

function imageDirectory() {
  const configured = process.env.UPLOAD_DIR || 'uploads';
  return join(resolve(configured), 'rooms');
}

export function imagePath(storageKey: string) {
  if (!IMAGE_KEY.test(storageKey)) throw new BadRequestException('Khóa ảnh không hợp lệ');
  return join(imageDirectory(), storageKey);
}

export async function optimizeImage(file?: UploadedImage): Promise<ProcessedImage> {
  if (!file?.buffer?.length) throw new BadRequestException('Vui lòng chọn ảnh phòng');
  if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestException('Ảnh gốc tối đa 8 MB');

  try {
    const source = sharp(file.buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error' });
    const metadata = await source.metadata();
    const mimeByFormat: Record<string, string> = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    if (!metadata.format || !mimeByFormat[metadata.format] || file.mimetype !== mimeByFormat[metadata.format]) {
      throw new BadRequestException('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP hợp lệ');
    }

    for (const [width, quality] of [[1600, 82], [1280, 72], [960, 62]] as const) {
      const result = await sharp(file.buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error' })
        .rotate()
        .resize({ width, height: 1200, fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (result.data.byteLength <= MAX_OUTPUT_BYTES) {
        return { buffer: result.data, width: result.info.width, height: result.info.height };
      }
    }
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('Không thể đọc ảnh. Hãy chọn JPEG, PNG hoặc WebP hợp lệ.');
  }
  throw new BadRequestException('Ảnh sau tối ưu vẫn lớn hơn 2 MB');
}

@UseGuards(SessionGuard)
@Controller()
export class RoomImagesController {
  private async roomScope(actor: SessionRequest['actor'], roomId: string) {
    const scope = actor.role === 'RENTER'
      ? { leases: { some: leaseScope(actor) } }
      : { property: propertyScope(actor) };
    return found(await db.room.findFirst({ where: { id: roomId, ...scope }, select: { id: true, roomCode: true } }));
  }

  private async saveOptimized(file: UploadedImage | undefined) {
    const optimized = await optimizeImage(file);
    const storageKey = randomUUID() + '.webp';
    const target = imagePath(storageKey);
    await mkdir(imageDirectory(), { recursive: true });
    const temporary = target + '.tmp';
    await writeFile(temporary, optimized.buffer, { flag: 'wx' });
    await rename(temporary, target);
    return { storageKey, target, ...optimized };
  }

  @Get('rooms/:roomId/images')
  async list(@Req() { actor }: SessionRequest, @Param('roomId', ParseUUIDPipe) roomId: string) {
    await this.roomScope(actor, roomId);
    return db.roomImage.findMany({
      where: { roomId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, alt: true, mimeType: true, sizeBytes: true, width: true, height: true, isPrimary: true, createdAt: true },
    });
  }

  @Get('rooms/:roomId/images/:imageId/file')
  async view(
    @Req() { actor }: SessionRequest,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.roomScope(actor, roomId);
    const image = found(await db.roomImage.findFirst({ where: { id: imageId, roomId } }));
    const path = imagePath(image.storageKey);
    response.set({
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(createReadStream(path), { type: image.mimeType, disposition: 'inline' });
  }

  @Post('rooms/:roomId/images')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async upload(
    @Req() { actor }: SessionRequest,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @UploadedFile() file: UploadedImage | undefined,
  ) {
    allow(actor, 'OWNER', 'MANAGER', 'STAFF');
    const room = await this.roomScope(actor, roomId);
    const saved = await this.saveOptimized(file);
    try {
      const image = await atomic(async tx => {
        await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM Room WHERE id = ${roomId} FOR UPDATE`;
        const count = await tx.roomImage.count({ where: { roomId } });
        if (count >= MAX_IMAGES_PER_ROOM) throw new BadRequestException(`Tối đa ${MAX_IMAGES_PER_ROOM} ảnh cho mỗi phòng`);
        const created = await tx.roomImage.create({
          data: {
            roomId,
            storageKey: saved.storageKey,
            sizeBytes: saved.buffer.byteLength,
            width: saved.width,
            height: saved.height,
            alt: `Ảnh phòng ${room.roomCode}`,
            isPrimary: count === 0,
          },
        });
        await audit(tx, actor, 'ROOM_IMAGE_UPLOADED', created.id);
        return created;
      });
      return { id: image.id, isPrimary: image.isPrimary, width: image.width, height: image.height, sizeBytes: image.sizeBytes };
    } catch (error) {
      await rm(saved.target, { force: true });
      throw error;
    }
  }

  @Put('rooms/:roomId/images/:imageId')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async replace(
    @Req() { actor }: SessionRequest,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @UploadedFile() file: UploadedImage | undefined,
  ) {
    allow(actor, 'OWNER', 'MANAGER', 'STAFF');
    await this.roomScope(actor, roomId);
    const saved = await this.saveOptimized(file);
    try {
      const result = await atomic(async tx => {
        const current = found(await tx.roomImage.findFirst({ where: { id: imageId, roomId } }));
        const updated = await tx.roomImage.update({
          where: { id: current.id },
          data: { storageKey: saved.storageKey, sizeBytes: saved.buffer.byteLength, width: saved.width, height: saved.height },
        });
        await audit(tx, actor, 'ROOM_IMAGE_REPLACED', imageId);
        return { updated, oldStorageKey: current.storageKey };
      });
      await rm(imagePath(result.oldStorageKey), { force: true });
      return { id: result.updated.id, isPrimary: result.updated.isPrimary, width: result.updated.width, height: result.updated.height, sizeBytes: result.updated.sizeBytes };
    } catch (error) {
      await rm(saved.target, { force: true });
      throw error;
    }
  }

  @Post('rooms/:roomId/images/:imageId/primary')
  async setPrimary(
    @Req() { actor }: SessionRequest,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    allow(actor, 'OWNER', 'MANAGER', 'STAFF');
    await this.roomScope(actor, roomId);
    return atomic(async tx => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM Room WHERE id = ${roomId} FOR UPDATE`;
      found(await tx.roomImage.findFirst({ where: { id: imageId, roomId } }));
      await tx.roomImage.updateMany({ where: { roomId, isPrimary: true }, data: { isPrimary: false } });
      const image = await tx.roomImage.update({ where: { id: imageId }, data: { isPrimary: true } });
      await audit(tx, actor, 'ROOM_IMAGE_PRIMARY_SET', imageId);
      return { id: image.id, isPrimary: image.isPrimary };
    });
  }

  @Delete('rooms/:roomId/images/:imageId')
  async remove(
    @Req() { actor }: SessionRequest,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    allow(actor, 'OWNER', 'MANAGER', 'STAFF');
    await this.roomScope(actor, roomId);
    const result = await atomic(async tx => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM Room WHERE id = ${roomId} FOR UPDATE`;
      const image = found(await tx.roomImage.findFirst({ where: { id: imageId, roomId } }));
      await tx.roomImage.delete({ where: { id: image.id } });
      const next = image.isPrimary ? await tx.roomImage.findFirst({ where: { roomId }, orderBy: { createdAt: 'asc' } }) : null;
      if (next) await tx.roomImage.update({ where: { id: next.id }, data: { isPrimary: true } });
      await audit(tx, actor, 'ROOM_IMAGE_DELETED', imageId);
      return { storageKey: image.storageKey, nextPrimaryId: next?.id ?? null };
    });
    await rm(imagePath(result.storageKey), { force: true });
    return { deleted: true, primaryImageId: result.nextPrimaryId };
  }
}
