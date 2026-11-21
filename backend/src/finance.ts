import { Actor, Tx } from './auth';
import { atomic, audit, decimal, found, leaseScope, notify, requireCondition } from './rules';

export async function invoiceFor(tx: Tx, actor: Actor, invoiceId: string) {
  return found(await tx.invoice.findFirst({ where: { id: invoiceId, lease: leaseScope(actor), status: { notIn: ['DRAFT', 'CANCELLED'] } } }));
}

export async function balance(tx: Tx, invoice: Awaited<ReturnType<typeof invoiceFor>>) {
  const result = await tx.payment.aggregate({
    where: { invoiceId: invoice.id, status: 'CONFIRMED' }, _sum: { amount: true },
  });
  const paid = result._sum.amount ?? decimal(0);
  requireCondition(paid.lte(invoice.totalAmount), 'Tổng thanh toán vượt giá trị hóa đơn');
  const remaining = invoice.totalAmount.minus(paid);
  return tx.invoice.update({
    where: { id: invoice.id },
    data: { paidAmount: paid, remainingAmount: remaining, status: remaining.isZero() ? 'PAID' : paid.isZero() ? 'ISSUED' : 'PARTIALLY_PAID' },
  });
}

export function changePayment(actor: Actor, paymentId: string, action: 'confirm' | 'reverse', reason?: string) {
  return atomic(async tx => {
    const payment = found(await tx.payment.findFirst({
      where: { id: paymentId, invoice: { lease: leaseScope(actor) } },
    }));
    const invoice = await invoiceFor(tx, actor, payment.invoiceId);
    requireCondition(payment.method !== 'DEPOSIT', 'Khoản bù cọc thuộc quyết toán');
    const status = action === 'confirm' ? 'CONFIRMED' : 'REVERSED';
    if (payment.status === status) return invoice;
    if (action === 'confirm') {
      requireCondition(payment.status === 'PENDING' && payment.amount.lte(invoice.remainingAmount), 'Khoản thu không còn hợp lệ');
    } else {
      requireCondition(payment.status === 'CONFIRMED' && reason, 'Cần khoản đã xác nhận và lý do đảo');
    }
    await tx.payment.update({ where: { id: payment.id }, data: {
      status, confirmedAt: action === 'confirm' ? new Date() : payment.confirmedAt,
    } });
    const updated = await balance(tx, invoice);
    await audit(tx, actor, 'PAYMENT_' + status, payment.id, reason);
    if (action === 'confirm') await notify(tx, invoice.leaseId, 'payment:' + payment.id, 'Khoản thanh toán đã được xác nhận');
    return updated;
  });
}
