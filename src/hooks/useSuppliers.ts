import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  description: string | null;
  address: string | null;
  created_at: string;
}

import { getDB } from '@/lib/db';
const db = getDB;

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const rows: Supplier[] = (await db().select('suppliers', {})).filter((s: any) => !s.deleted_at);
      return rows.sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function useAddSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (supplier: { name: string; phone?: string; description?: string; address?: string }) => {
      return db().insert('suppliers', { ...supplier, created_at: new Date().toISOString() });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; phone?: string; description?: string; address?: string }) => {
      await db().update('suppliers', updates, { id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await db().remove('suppliers', { id }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });
}
