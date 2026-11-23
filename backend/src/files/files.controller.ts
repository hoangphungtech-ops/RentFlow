import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { type AuthUser, CurrentUser } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesService, UploadedBinaryFile } from './files.service';

@ApiTags('Files (Private)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'entityType', 'entityId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        entityType: { type: 'string', example: 'PAYMENT_PROOF' },
        entityId: { type: 'string', example: '33333333-3333-4333-8333-333333333333' },
        propertyId: { type: 'string', example: '11111111-1111-4111-8111-111111111111' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedBinaryFile | undefined,
    @Body('entityType') entityType: string,
    @Body('entityId') entityId: string,
    @Body('propertyId') propertyId?: string,
  ) {
    return this.filesService.uploadFile(user, file, entityType, entityId, propertyId);
  }

  @Get(':id/download')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.filesService.downloadFile(user, id);
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `inline; filename="${result.storageKey}"`,
    });
    return result.stream;
  }
}
