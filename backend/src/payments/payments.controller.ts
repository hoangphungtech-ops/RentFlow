import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ConfirmPaymentDto, CreatePaymentDto, ReportPaymentDto, ReversePaymentDto } from './payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments & Reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles('OWNER', 'ACCOUNTANT')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  createConfirmed(@CurrentUser() actor: AuthUser, @Body() dto: CreatePaymentDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.paymentsService.createConfirmedPayment(actor, dto, idempotencyKey);
  }

  @Post('report')
  @Roles('TENANT')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  reportTransfer(@CurrentUser() tenant: AuthUser, @Body() dto: ReportPaymentDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.paymentsService.reportTenantTransfer(tenant, dto, idempotencyKey);
  }

  @Post(':id/confirm')
  @Roles('OWNER', 'ACCOUNTANT')
  confirmPending(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: ConfirmPaymentDto) {
    return this.paymentsService.confirmPendingPayment(actor, id, dto);
  }

  @Post(':id/reverse')
  @Roles('OWNER', 'ACCOUNTANT')
  reverse(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: ReversePaymentDto) {
    return this.paymentsService.reversePayment(actor, id, dto);
  }

  @Get('lease/:leaseId/summary')
  getLeaseSummary(@Param('leaseId') leaseId: string) {
    return this.paymentsService.getLeasePaymentSummary(leaseId);
  }

  @Get('invoice/:invoiceId/summary')
  getInvoiceSummary(@Param('invoiceId') invoiceId: string) {
    return this.paymentsService.getInvoicePaidSummary(invoiceId);
  }
}
