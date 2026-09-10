import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ProductCategory {
  id: string;
  name: string;
  created_at: string;
}

import { getDB } from '@/lib/db';
const db = getDB;

export function useProductCategories() {
  return useQuery({
    queryKey: ['product_categories'],
    queryFn: async () => {
      const rows: ProductCategory[] = (await db().select('product_categories', {})).filter((c: any) => !c.deleted_at);
      return rows.sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function useAddProductCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      return db().insert('product_categories', {
        name: name.trim(),
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product_categories'] }),
  });
}

export function useDeleteProductCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await db().remove('product_categories', { id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product_categories'] }),
  });
}
