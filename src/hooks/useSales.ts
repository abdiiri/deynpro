import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Sale {
  id: string;
  customer_id: string | null;
  total_amount: number;
  payment_method: string;
  date: string;
  created_at: string;
}

export interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  piece_mode?: number;      // 1 = piece sale, 0 = pack sale
  pieces_per_pack?: number; // how many pieces in a pack
}

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  available: number;
  cost_price: number;
  // Pack / piece support
  piece_mode: boolean;        // true = selling by piece
  pack_name: string | null;   // e.g. "Carton"
  pieces_per_pack: number;    // 0 = no pack pricing
  piece_price: number;        // price for a single piece
  pack_price: number;         // original pack price (product.price)
}

import { getDB } from '@/lib/db';
const db = getDB;

export function useSales() {
  return useQuery({
    queryKey: ['sales'],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const sales: Sale[] = (await db().select('sales', {})).filter((s: any) => !s.deleted_at);
      const customers: any[] = await db().select('customers', {});
      const custMap: Record<string, any> = {};
      customers.forEach(c => { custMap[c.id] = c; });
      const saleItems: any[] = (await db().select('sale_items', {})).filter((i: any) => !i.deleted_at);
      const products: any[] = await db().select('products', {});
      const prodMap: Record<string, any> = {};
      products.forEach(p => { prodMap[p.id] = p; });
      const itemsBySale: Record<string, any[]> = {};
      saleItems.forEach(item => {
        if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
        const prod = prodMap[item.product_id];
        itemsBySale[item.sale_id].push({
          ...item,
          cost_price: prod?.cost_price ?? 0,
          products: prod ? { name: prod.name } : null,
        });
      });
      return sales
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(s => {
          const saleItemsList = itemsBySale[s.id] || [];
          return {
            ...s,
            customers: s.customer_id && custMap[s.customer_id] ? { name: custMap[s.customer_id].name } : null,
            sale_items: saleItemsList,
            // alias used by Dashboard profit calculations
            items: saleItemsList,
          };
        });
    },
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ items, payment_method, customer_id }: {
      items: SaleItem[];
      payment_method: string;
      customer_id?: string;
    }) => {
      const total_amount = items.reduce((s, i) => s + i.subtotal, 0);
      const now = new Date().toISOString();
      const sale = await db().insert('sales', {
        total_amount, payment_method,
        customer_id: customer_id || null,
        date: now, created_at: now,
      });
      for (const item of items) {
        await db().insert('sale_items', {
          sale_id: sale.id, product_id: item.product_id,
          quantity: item.quantity, unit_price: item.unit_price,
          subtotal: item.subtotal,
          piece_mode: item.piece_mode ?? 0,
          pieces_per_pack: item.pieces_per_pack ?? 0,
          created_at: now,
        });
      }
      if (payment_method === 'credit' && customer_id) {
        await db().insert('transactions', {
          customer_id, type: 'debt', amount: total_amount,
          description: `Credit sale #${sale.id.slice(0, 8)}`,
          date: now, created_at: now,
        });
      }
      return sale;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['products-low-stock'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['stock-alerts'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
