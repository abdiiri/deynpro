import { differenceInCalendarDays } from 'date-fns';
import type { Customer, Transaction } from '@/hooks/useCustomers';

export interface AgingBuckets {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
  total: number;
}

export interface CustomerAging extends AgingBuckets {
  customerId: string;
  customerName: string;
  customerPhone: string;
  oldestDueDate: string | null;
}

function emptyBuckets(): AgingBuckets {
  return { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };
}

/**
 * Computes accounts-receivable aging for one customer's transactions.
 * Payments are applied FIFO against the oldest outstanding debts first,
 * then each remaining unpaid debt amount is bucketed by how many days
 * past its due date (or transaction date, if no due date) it is, as of `asOf`.
 */
export function computeCustomerAging(transactions: Transaction[], asOf: Date = new Date()): AgingBuckets & { oldestDueDate: string | null } {
  const debts = transactions
    .filter(t => t.type === 'debt')
    .map(t => ({ ...t, remaining: t.amount }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let paymentsPool = transactions
    .filter(t => t.type === 'payment')
    .reduce((sum, t) => sum + t.amount, 0);

  for (const d of debts) {
    if (paymentsPool <= 0) break;
    const applied = Math.min(paymentsPool, d.remaining);
    d.remaining -= applied;
    paymentsPool -= applied;
  }

  const buckets = emptyBuckets();
  let oldestDueDate: string | null = null;

  for (const d of debts) {
    if (d.remaining <= 0.005) continue;
    const refDate = d.due_date ? new Date(d.due_date) : new Date(d.date);
    if (!oldestDueDate || new Date(refDate) < new Date(oldestDueDate)) {
      oldestDueDate = refDate.toISOString();
    }
    const daysOverdue = differenceInCalendarDays(asOf, refDate);

    if (daysOverdue <= 0) buckets.current += d.remaining;
    else if (daysOverdue <= 30) buckets.d1_30 += d.remaining;
    else if (daysOverdue <= 60) buckets.d31_60 += d.remaining;
    else if (daysOverdue <= 90) buckets.d61_90 += d.remaining;
    else buckets.d90plus += d.remaining;

    buckets.total += d.remaining;
  }

  return { ...buckets, oldestDueDate };
}

/** Builds an AR aging table across all customers. Only customers with an outstanding balance are included. */
export function buildArAgingReport(
  customers: Customer[],
  allTransactions: Transaction[],
  asOf: Date = new Date()
): CustomerAging[] {
  const byCustomer: Record<string, Transaction[]> = {};
  for (const tx of allTransactions) {
    if (!byCustomer[tx.customer_id]) byCustomer[tx.customer_id] = [];
    byCustomer[tx.customer_id].push(tx);
  }

  const rows: CustomerAging[] = [];
  for (const c of customers) {
    const txs = byCustomer[c.id] || [];
    if (!txs.length) continue;
    const aging = computeCustomerAging(txs, asOf);
    if (aging.total <= 0.005) continue;
    rows.push({
      customerId: c.id,
      customerName: c.name,
      customerPhone: c.phone,
      ...aging,
    });
  }

  return rows.sort((a, b) => b.total - a.total);
}

export function sumBuckets(rows: AgingBuckets[]): AgingBuckets {
  return rows.reduce((acc, r) => ({
    current: acc.current + r.current,
    d1_30: acc.d1_30 + r.d1_30,
    d31_60: acc.d31_60 + r.d31_60,
    d61_90: acc.d61_90 + r.d61_90,
    d90plus: acc.d90plus + r.d90plus,
    total: acc.total + r.total,
  }), emptyBuckets());
}
