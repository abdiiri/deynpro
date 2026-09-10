import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  quantity: number;
  category: string | null;
  description: string | null;
  image_url: string | null;
  barcode: string | null;
  expiry_date: string | null;
  low_stock_threshold: number;
  supplier_id: string | null;
  unit: string; // e.g. 'pcs', 'kg', 'g', 'l', 'ml', 'box', 'dozen'
  // Pack / piece pricing
  pack_name: string | null;        // e.g. "Carton", "Dozen" – null = feature off
  pieces_per_pack: number;         // 0 = feature off
  piece_price: number;             // selling price per single piece
  created_at: string;
}

import { getDB } from '@/lib/db';
const db = getDB;

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const products: Product[] = (await db().select('products', {})).filter((p: any) => !p.deleted_at);
      const suppliers: any[] = await db().select('suppliers', {});
      const suppMap: Record<string, any> = {};
      suppliers.forEach(s => { suppMap[s.id] = s; });
      return products
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(p => ({ ...p, suppliers: p.supplier_id && suppMap[p.supplier_id] ? { name: suppMap[p.supplier_id].name } : null }));
    },
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    enabled: !!id,
    queryFn: async () => {
      const rows: Product[] = await db().select('products', { id });
      if (!rows.length) throw new Error('Product not found');
      const p = rows[0];
      const suppRows: any[] = p.supplier_id ? await db().select('suppliers', { id: p.supplier_id }) : [];
      return { ...p, suppliers: suppRows.length ? { name: suppRows[0].name } : null };
    },
  });
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: ['products-low-stock'],
    queryFn: async () => {
      const products: Product[] = (await db().select('products', {})).filter((p: any) => !p.deleted_at);
      return products.filter(p => p.quantity <= p.low_stock_threshold);
    },
  });
}

export function useAddProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'created_at'>) => {
      return db().insert('products', { ...product, created_at: new Date().toISOString() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['products-low-stock'] });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Product> & { id: string }) => {
      await db().update('products', updates, { id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['products-low-stock'] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await db().remove('products', { id }); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['products-low-stock'] });
    },
  });
}
