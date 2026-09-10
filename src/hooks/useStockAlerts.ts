import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface StockAlert {
  id: string;
  product_id: string;
  alert_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

import { getDB } from '@/lib/db';
const db = getDB;

export function useStockAlerts() {
  return useQuery({
    queryKey: ['stock-alerts'],
    queryFn: async () => {
      const alerts: StockAlert[] = (await db().select('stock_alerts', {}))
        .filter((a: any) => !a.deleted_at && !a.is_read);
      const products: any[] = await db().select('products', {});
      const prodMap: Record<string, any> = {};
      products.forEach(p => { prodMap[p.id] = p; });
      return alerts
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map(a => ({ ...a, products: prodMap[a.product_id] ? { name: prodMap[a.product_id].name } : null })) as (StockAlert & { products: { name: string } | null })[];
    },
  });
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await db().update('stock_alerts', { is_read: 1 }, { id }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-alerts'] }),
  });
}

export function useMarkAllAlertsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const alerts: StockAlert[] = (await db().select('stock_alerts', {})).filter((a: any) => !a.is_read);
      for (const alert of alerts) {
        await db().update('stock_alerts', { is_read: 1 }, { id: alert.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-alerts'] }),
  });
}
