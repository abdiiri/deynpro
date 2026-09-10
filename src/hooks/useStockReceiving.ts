import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface StockReceivingItem {
  product_id: string;
  quantity_received: number;
  cost_per_unit: number;
  subtotal: number;
}

export interface StockReceiving {
  id: string;
  supplier_id: string | null;
  notes: string | null;
  total_cost: number;
  date: string;
  created_at: string;
}

import { getDB } from '@/lib/db';
const db = getDB;

export function useStockReceivings() {
  return useQuery({
    queryKey: ['stock_receivings'],
    queryFn: async () => {
      const receivings: StockReceiving[] = (await db().select('stock_receivings', {}))
        .filter((r: any) => !r.deleted_at)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const suppliers: any[] = await db().select('suppliers', {});
      const suppMap: Record<string, any> = {};
      suppliers.forEach(s => { suppMap[s.id] = s; });

      const items: any[] = (await db().select('stock_receiving_items', {}))
        .filter((i: any) => !i.deleted_at);
      const products: any[] = await db().select('products', {});
      const prodMap: Record<string, any> = {};
      products.forEach(p => { prodMap[p.id] = p; });

      const itemsByReceiving: Record<string, any[]> = {};
      items.forEach(item => {
        if (!itemsByReceiving[item.stock_receiving_id]) itemsByReceiving[item.stock_receiving_id] = [];
        itemsByReceiving[item.stock_receiving_id].push({
          ...item,
          product: prodMap[item.product_id] || null,
        });
      });

      return receivings.map(r => ({
        ...r,
        supplier: r.supplier_id && suppMap[r.supplier_id] ? suppMap[r.supplier_id] : null,
        items: itemsByReceiving[r.id] || [],
      }));
    },
  });
}

export function useCreateStockReceiving() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ supplier_id, notes, items }: {
      supplier_id?: string;
      notes?: string;
      items: StockReceivingItem[];
    }) => {
      const total_cost = items.reduce((s, i) => s + i.subtotal, 0);
      const now = new Date().toISOString();
      const receiving = await db().insert('stock_receivings', {
        supplier_id: supplier_id || null,
        notes: notes || null,
        total_cost,
        date: now,
        created_at: now,
      });
      for (const item of items) {
        await db().insert('stock_receiving_items', {
          stock_receiving_id: receiving.id,
          product_id: item.product_id,
          quantity_received: item.quantity_received,
          cost_per_unit: item.cost_per_unit,
          subtotal: item.subtotal,
          created_at: now,
        });
      }
      return receiving;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock_receivings'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['products-low-stock'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteStockReceiving() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await db().remove('stock_receivings', { id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock_receivings'] });
    },
  });
}
