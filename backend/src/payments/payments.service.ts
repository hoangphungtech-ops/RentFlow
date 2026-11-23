import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLogService } from '../audit/audit.service';
import { AuthUser } from '../auth/decorators/roles.decorator';
import { PaymentStatus, Prisma, TransactionType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AllocationItemDto, ConfirmPaymentDto, CreatePaymentDto, ReportPaymentDto, ReversePaymentDto } from './payments.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private roundVnd(value: number | string | Prisma.Decimal): Prisma.Decimal {
    return new Prisma.Decimal(value).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  }

  private async assertPropertyAccess(userId: string, propertyId: string) {
    const access = await this.prisma.userPropertyAccess.findUnique({
      where: { userId_propertyId: { userId, propertyId } },
    });
    if (!access) throw new ForbiddenException('Không có quyền thao tác khu trọ này');
  }

  private async validateAllocations(tx: Prisma.TransactionClient, paymentAmount: Prisma.Decimal, allocations: AllocationItemDto[]) {
    let totalAllocated = new Prisma.Decimal(0);
    const seen = new Set<string>();
    const normalized: { invoiceId: string; amount: Prisma.Decimal }[] = [];

    for (const item of allocations) {
      if (seen.has(item.invoiceId)) throw new BadRequestException(`Hóa đơn ${item.invoiceId} bị lặp`);
      seen.add(item.invoiceId);

      const rounded = this.roundVnd(item.amount);
      if (rounded.lte(0)) throw new BadRequestException('Số tiền phân bổ phải lớn hơn 0');

      if (item.invoiceTotal !== undefined) {
        const invoiceTotal = this.roundVnd(item.invoiceTotal);
        const paidRows = await tx.paymentAllocation.findMany({
          where: { invoiceId: item.invoiceId, payment: { status: PaymentStatus.CONFIRMED } },
          select: { allocatedAmount: true },
        });
        const alreadyPaid = paidRows.reduce((sum, r) => sum.plus(r.allocatedAmount), new Prisma.Decimal(0));
        const remaining = invoiceTotal.minus(alreadyPaid);
        if (rounded.gt(remaining)) {
          throw new BadRequestException(`Phân bổ (${rounded.toString()}) vượt dư nợ còn lại (${remaining.toString()})`);
        }
      }

      totalAllocated = totalAllocated.plus(rounded);
      normalized.push({ invoiceId: item.invoiceId, amount: rounded });
    }

    if (totalAllocated.gt(paymentAmount)) {
      throw new BadRequestException(`Tổng phân bổ (${totalAllocated.toString()}) vượt số tiền thu (${paymentAmount.toString()})`);
    }
    return { normalized, totalAllocated };
  }

  async createConfirmedPayment(actor: AuthUser, dto: CreatePaymentDto, idempotencyKey?: string) {
    await this.assertPropertyAccess(actor.id, dto.propertyId);
    const roundedAmount = this.roundVnd(dto.amount);
    const cleanKey = idempotencyKey?.trim() || undefined;
    const allocationsInput = dto.allocations ?? [];

    if (cleanKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { recordedById_idempotencyKey: { recordedById: actor.id, idempotencyKey: cleanKey } },
        include: { allocations: true },
      });
      if (existing) {
        const existingSig = existing.allocations.map((a) => `${a.invoiceId}:${new Prisma.Decimal(a.allocatedAmount).toFixed(0)}`).sort().join('|');
        const incomingSig = allocationsInput.map((a) => `${a.invoiceId}:${this.roundVnd(a.amount).toFixed(0)}`).sort().join('|');
        if (existing.leaseId !== dto.leaseId || !new Prisma.Decimal(existing.amount).equals(roundedAmount) || existing.paymentMethod !== dto.paymentMethod || existingSig !== incomingSig) {
          throw new ConflictException('Idempotency-Key đã được dùng với nội dung khác');
        }
        const allocatedSum = existing.allocations.reduce((s, a) => s.plus(a.allocatedAmount), new Prisma.Decimal(0));
        return {
          idempotentReplay: true,
          payment: existing,
          allocatedAmount: allocatedSum.toFixed(0),
          unallocatedAmount: new Prisma.Decimal(existing.amount).minus(allocatedSum).toFixed(0),
        };
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const { normalized, totalAllocated } = await this.validateAllocations(tx, roundedAmount, allocationsInput);
      const payment = await tx.payment.create({
        data: {
          leaseId: dto.leaseId,
          transactionType: dto.transactionType ?? TransactionType.INVOICE_PAYMENT,
          amount: roundedAmount,
          paymentMethod: dto.paymentMethod,
          payerName: dto.payerName.trim(),
          paidAt: new Date(dto.paidAt),
          referenceCode: dto.referenceCode?.trim() || null,
          idempotencyKey: cleanKey ?? null,
          status: PaymentStatus.CONFIRMED,
          recordedById: actor.id,
          allocations: { create: normalized.map((n) => ({ invoiceId: n.invoiceId, allocatedAmount: n.amount })) },
        },
        include: { allocations: true },
      });
      return { payment, totalAllocated };
    });

    await this.auditLog.log({
      actorId: actor.id,
      entityType: 'Payment',
      entityId: result.payment.id,
      action: 'PAYMENT_CONFIRMED_CREATED',
      newValue: { leaseId: result.payment.leaseId, amount: roundedAmount.toFixed(0) },
    });

    return {
      idempotentReplay: false,
      payment: result.payment,
      allocatedAmount: result.totalAllocated.toFixed(0),
      unallocatedAmount: roundedAmount.minus(result.totalAllocated).toFixed(0),
    };
  }

  async reportTenantTransfer(tenantUser: AuthUser, dto: ReportPaymentDto, idempotencyKey?: string) {
    const roundedAmount = this.roundVnd(dto.amount);
    const cleanKey = idempotencyKey?.trim() || undefined;

    if (cleanKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { recordedById_idempotencyKey: { recordedById: tenantUser.id, idempotencyKey: cleanKey } },
      });
      if (existing) {
        if (existing.leaseId !== dto.leaseId || !new Prisma.Decimal(existing.amount).equals(roundedAmount)) {
          throw new ConflictException('Idempotency-Key đã được dùng cho yêu cầu khác');
        }
        return { idempotentReplay: true, payment: existing };
      }
    }

    const payment = await this.prisma.payment.create({
      data: {
        leaseId: dto.leaseId,
        transactionType: TransactionType.INVOICE_PAYMENT,
        amount: roundedAmount,
        paymentMethod: 'BANK_TRANSFER',
        payerName: dto.payerName.trim(),
        paidAt: new Date(dto.paidAt),
        referenceCode: dto.referenceCode?.trim() || null,
        idempotencyKey: cleanKey ?? null,
        status: PaymentStatus.PENDING,
        recordedById: tenantUser.id,
      },
    });

    await this.auditLog.log({
      actorId: tenantUser.id,
      entityType: 'Payment',
      entityId: payment.id,
      action: 'PAYMENT_REPORTED_PENDING',
      newValue: { leaseId: payment.leaseId, amount: roundedAmount.toFixed(0) },
    });

    return { idempotentReplay: false, payment };
  }

  async confirmPendingPayment(actor: AuthUser, paymentId: string, dto: ConfirmPaymentDto) {
    await this.assertPropertyAccess(actor.id, dto.propertyId);
    const existing = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!existing) throw new NotFoundException('Không tìm thấy phiếu thanh toán');
    if (existing.status !== PaymentStatus.PENDING) throw new BadRequestException('Chỉ xác nhận khoản PENDING');

    const paymentAmount = new Prisma.Decimal(existing.amount);
    const updated = await this.prisma.$transaction(async (tx) => {
      const { normalized, totalAllocated } = await this.validateAllocations(tx, paymentAmount, dto.allocations ?? []);
      const payment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.CONFIRMED,
          allocations: { create: normalized.map((n) => ({ invoiceId: n.invoiceId, allocatedAmount: n.amount })) },
        },
        include: { allocations: true },
      });
      return { payment, totalAllocated };
    });

    await this.auditLog.log({
      actorId: actor.id,
      entityType: 'Payment',
      entityId: paymentId,
      action: 'PAYMENT_CONFIRMED',
      oldValue: { status: PaymentStatus.PENDING },
      newValue: { status: PaymentStatus.CONFIRMED, allocated: updated.totalAllocated.toFixed(0) },
    });

    return {
      payment: updated.payment,
      allocatedAmount: updated.totalAllocated.toFixed(0),
      unallocatedAmount: paymentAmount.minus(updated.totalAllocated).toFixed(0),
    };
  }

  async reversePayment(actor: AuthUser, paymentId: string, dto: ReversePaymentDto) {
    await this.assertPropertyAccess(actor.id, dto.propertyId);
    const existing = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!existing) throw new NotFoundException('Không tìm thấy giao dịch cần đảo');
    if (existing.status !== PaymentStatus.CONFIRMED) throw new BadRequestException('Chỉ đảo được giao dịch CONFIRMED');

    const reversed = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REVERSED,
        reversedAt: new Date(),
        reversedById: actor.id,
        reversalReason: dto.reason.trim(),
      },
      include: { allocations: true },
    });

    await this.auditLog.log({
      actorId: actor.id,
      entityType: 'Payment',
      entityId: paymentId,
      action: 'PAYMENT_REVERSED',
      oldValue: { status: PaymentStatus.CONFIRMED, amount: existing.amount.toString() },
      newValue: { status: PaymentStatus.REVERSED, reason: reversed.reversalReason },
    });

    return reversed;
  }

  async getLeasePaymentSummary(leaseId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { leaseId },
      include: { allocations: true },
      orderBy: { createdAt: 'desc' },
    });

    let totalConfirmed = new Prisma.Decimal(0);
    let totalAllocated = new Prisma.Decimal(0);
    let totalPending = new Prisma.Decimal(0);

    for (const p of payments) {
      if (p.status === PaymentStatus.CONFIRMED) {
        totalConfirmed = totalConfirmed.plus(p.amount);
        for (const a of p.allocations) totalAllocated = totalAllocated.plus(a.allocatedAmount);
      } else if (p.status === PaymentStatus.PENDING) {
        totalPending = totalPending.plus(p.amount);
      }
    }

    return {
      leaseId,
      totalConfirmed: totalConfirmed.toFixed(0),
      totalAllocated: totalAllocated.toFixed(0),
      unallocatedCredit: totalConfirmed.minus(totalAllocated).toFixed(0),
      totalPending: totalPending.toFixed(0),
      payments,
    };
  }

  async getInvoicePaidSummary(invoiceId: string) {
    const allocations = await this.prisma.paymentAllocation.findMany({
      where: { invoiceId, payment: { status: PaymentStatus.CONFIRMED } },
      include: { payment: true },
    });
    const confirmedPaid = allocations.reduce((sum, a) => sum.plus(a.allocatedAmount), new Prisma.Decimal(0));
    return { invoiceId, confirmedPaid: confirmedPaid.toFixed(0), allocations };
  }
}
