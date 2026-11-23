import { Global, Module } from '@nestjs/common';
import { AuditLogController } from './audit.controller';
import { AuditLogService } from './audit.service';

@Global()
@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
