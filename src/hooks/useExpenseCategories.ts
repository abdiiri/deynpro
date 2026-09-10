import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ExpenseCategory {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

import { getDB } from '@/lib/db';
const db = getDB;

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense_categories'],
    queryFn: async () => {
      const rows: ExpenseCategory[] = (await db().select('expense_categories', {})).filter((e: any) => !e.deleted_at);
      return rows.sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function useAddExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string }) => {
      return db().insert('expense_categories', {
        name: input.name.trim().toLowerCase(),
        color: input.color || 'muted',
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_categories'] }),
  });
}

export function useDeleteExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await db().remove('expense_categories', { id }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense_categories'] }),
  });
}
