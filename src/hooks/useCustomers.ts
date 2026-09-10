import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  credit_limit: number;
  loyalty_points: number;
}

export interface Transaction {
  id: string;
  customer_id: string;
  type: 'debt' | 'payment';
  amount: number;
  date: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
}

import { getDB } from '@/lib/db';
const db = getDB;

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const rows: Customer[] = await db().select('customers', {});
      return rows.filter((r: any) => !r.deleted_at)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customer', id],
    enabled: !!id,
    queryFn: async () => {
      const rows: Customer[] = await db().select('customers', { id });
      if (!rows.length) throw new Error('Customer not found');
      return rows[0];
    },
  });
}

export function useCustomerTransactions(customerId: string) {
  return useQuery({
    queryKey: ['transactions', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const rows: Transaction[] = await db().select('transactions', { customer_id: customerId });
      return rows.filter((r: any) => !r.deleted_at)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
  });
}

export function useAllTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const txs: Transaction[] = await db().select('transactions', {});
      const customers: Customer[] = await db().select('customers', {});
      const custMap: Record<string, Customer> = {};
      customers.forEach(c => { custMap[c.id] = c; });
      return txs
        .filter((r: any) => !r.deleted_at)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(tx => ({
          ...tx,
          customers: custMap[tx.customer_id]
            ? { name: custMap[tx.customer_id].name, phone: custMap[tx.customer_id].phone }
            : { name: 'Unknown', phone: '' },
        }));
    },
  });
}

export function useAddCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, phone, credit_limit = 0 }: { name: string; phone: string; credit_limit?: number }) => {
      return db().insert('customers', { name, phone, credit_limit, loyalty_points: 0, created_at: new Date().toISOString() });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, phone, credit_limit }: { id: string; name: string; phone: string; credit_limit?: number }) => {
      const fields: any = { name, phone };
      if (credit_limit !== undefined) fields.credit_limit = credit_limit;
      await db().update('customers', fields, { id });
      return { id, name, phone, credit_limit };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer', vars.id] });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await db().remove('customers', { id }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await db().remove('transactions', { id }); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount, description, due_date }: { id: string; amount: number; description?: string; due_date?: string }) => {
      await db().update('transactions', { amount, description: description || null, due_date: due_date || null }, { id });
      return { id, amount };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: { customer_id: string; type: 'debt' | 'payment'; amount: number; description?: string; due_date?: string }) => {
      return db().insert('transactions', {
        ...tx,
        date: new Date().toISOString(),
        due_date: tx.due_date || null,
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['transactions', vars.customer_id] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCustomerBalance(customerId: string) {
  const { data: transactions } = useCustomerTransactions(customerId);
  if (!transactions) return { totalDebt: 0, totalPaid: 0, balance: 0 };
  const totalDebt = transactions.filter(t => t.type === 'debt').reduce((s, t) => s + t.amount, 0);
  const totalPaid = transactions.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);
  return { totalDebt, totalPaid, balance: totalDebt - totalPaid };
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard'],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const customers: Customer[] = (await db().select('customers', {})).filter((r: any) => !r.deleted_at);
      const txs: Transaction[] = (await db().select('transactions', {})).filter((r: any) => !r.deleted_at);

      const totalDebt = txs.filter(t => t.type === 'debt').reduce((s, t) => s + t.amount, 0);
      const totalPayments = txs.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);

      const balances: Record<string, number> = {};
      txs.forEach(t => {
        if (!balances[t.customer_id]) balances[t.customer_id] = 0;
        balances[t.customer_id] += t.type === 'debt' ? t.amount : -t.amount;
      });

      const overdueCustomers = customers
        .filter(c => (balances[c.id] || 0) > 0)
        .map(c => ({ ...c, balance: balances[c.id] }));

      const monthlyPayments: Record<string, number> = {};
      txs.filter(t => t.type === 'payment').forEach(t => {
        const month = new Date(t.date).toLocaleString('en', { month: 'short', year: '2-digit' });
        monthlyPayments[month] = (monthlyPayments[month] || 0) + t.amount;
      });

      const chartData = Object.entries(monthlyPayments).slice(-6).map(([month, amount]) => ({ month, amount }));

      return {
        totalDebt: totalDebt - totalPayments,
        totalPayments,
        customerCount: customers.length,
        overdueCount: overdueCustomers.length,
        overdueCustomers: overdueCustomers.slice(0, 5),
        chartData,
        recentTransactions: txs.slice(0, 5),
      };
    },
  });
}

export function useUpdateLoyaltyPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) => {
      const rows: Customer[] = await db().select('customers', { id });
      if (!rows.length) throw new Error('Customer not found');
      const current = rows[0].loyalty_points || 0;
      const next = Math.max(0, current + delta);
      await db().update('customers', { loyalty_points: next }, { id });
      return { id, loyalty_points: next };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer', vars.id] });
    },
  });
}

export function useCustomerCreditStatus(customerId: string, pendingSaleTotal: number) {
  const { data: customer } = useCustomer(customerId);
  const { data: transactions } = useCustomerTransactions(customerId);
  if (!customer || !transactions) return { ok: true, balance: 0, limit: 0, wouldExceed: false };
  const totalDebt = transactions.filter(t => t.type === 'debt').reduce((s, t) => s + t.amount, 0);
  const totalPaid = transactions.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);
  const balance = totalDebt - totalPaid;
  const limit = customer.credit_limit || 0;
  const wouldExceed = limit > 0 && (balance + pendingSaleTotal) > limit;
  return { ok: !wouldExceed, balance, limit, wouldExceed };
}
