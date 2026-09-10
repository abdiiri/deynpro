import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  description: string | null;
  supplier_id: string | null;
  created_at: string;
}

export const EXPENSE_CATEGORIES = ['rent', 'utilities', 'salaries', 'supplies', 'transport', 'other'] as const;

import { getDB } from '@/lib/db';
const db = getDB;

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const rows: Expense[] = (await db().select('expenses', {})).filter((e: any) => !e.deleted_at);
      return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
  });
}

export function useAddExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: { title: string; amount: number; category: string; description?: string; date?: string; supplier_id?: string | null }) => {
      return db().insert('expenses', { ...expense, date: expense.date || new Date().toISOString(), created_at: new Date().toISOString() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Expense> & { id: string }) => {
      await db().update('expenses', updates, { id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await db().remove('expenses', { id }); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
