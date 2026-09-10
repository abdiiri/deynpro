import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSales } from './useSales';
import { useExpenses } from './useExpenses';

export interface EodReport {
  id: string;
  report_date: string;
  cash_sales: number;
  mpesa_sales: number;
  card_sales: number;
  credit_sales: number;
  total_sales: number;
  total_cost: number;
  gross_profit: number;
  total_expenses: number;
  net_profit: number;
  opening_float: number;
  closing_float: number;
  notes: string | null;
  created_at: string;
}

import { getDB } from '@/lib/db';
const db = getDB;

export function useEodReports() {
  return useQuery({
    queryKey: ['eod_reports'],
    queryFn: async () => {
      const rows: EodReport[] = (await db().select('eod_reports', {}))
        .filter((r: any) => !r.deleted_at)
        .sort((a: any, b: any) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());
      return rows;
    },
  });
}

export function useSaveEodReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<EodReport, 'id' | 'created_at'>) => {
      const now = new Date().toISOString();
      // Check if a report already exists for this date
      const existing: any[] = await db().select('eod_reports', { report_date: data.report_date });
      const active = existing.filter((r: any) => !r.deleted_at);
      if (active.length) {
        await db().update('eod_reports', data, { report_date: data.report_date });
        return { ...active[0], ...data };
      }
      return db().insert('eod_reports', { ...data, created_at: now });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eod_reports'] }),
  });
}

/** Compute today's EOD numbers live from sales + expenses */
export function useTodayEodData(date: string) {
  return useQuery({
    queryKey: ['eod_live', date],
    queryFn: async () => {
      const allSales: any[] = (await db().select('sales', {})).filter((s: any) => !s.deleted_at);
      const allItems: any[] = (await db().select('sale_items', {})).filter((i: any) => !i.deleted_at);
      const allProducts: any[] = await db().select('products', {});
      const allExpenses: any[] = (await db().select('expenses', {})).filter((e: any) => !e.deleted_at);

      const prodMap: Record<string, any> = {};
      allProducts.forEach((p: any) => { prodMap[p.id] = p; });

      const daySales = allSales.filter((s: any) => s.date.startsWith(date));
      const dayExpenses = allExpenses.filter((e: any) => e.date.startsWith(date));

      const cash_sales   = daySales.filter((s: any) => s.payment_method === 'cash').reduce((a: number, s: any) => a + s.total_amount, 0);
      const mpesa_sales  = daySales.filter((s: any) => s.payment_method === 'mpesa').reduce((a: number, s: any) => a + s.total_amount, 0);
      const card_sales   = daySales.filter((s: any) => s.payment_method === 'card').reduce((a: number, s: any) => a + s.total_amount, 0);
      const credit_sales = daySales.filter((s: any) => s.payment_method === 'credit').reduce((a: number, s: any) => a + s.total_amount, 0);
      const total_sales  = cash_sales + mpesa_sales + card_sales + credit_sales;

      // Profit = sum of (selling price - buying price) × quantity for each item
      // Buying price per unit depends on piece_mode:
      //   pack sale  → prod.cost_price
      //   piece sale → prod.cost_price / pieces_per_pack
      const daySaleIds = new Set(daySales.map((s: any) => s.id));
      const dayItems = allItems.filter((i: any) => daySaleIds.has(i.sale_id));

      const total_cost = dayItems.reduce((acc: number, item: any) => {
        const prod = prodMap[item.product_id];
        const packCost = prod?.cost_price || 0;
        const ppp = item.pieces_per_pack || 0;
        const isPiece = item.piece_mode === 1 || item.piece_mode === true;
        const unitCost = isPiece && ppp > 0 ? packCost / ppp : packCost;
        return acc + unitCost * item.quantity;
      }, 0);

      // gross_profit = SP - BP (what was asked: no expense subtraction)
      const gross_profit  = total_sales - total_cost;
      const total_expenses = dayExpenses.reduce((a: number, e: any) => a + e.amount, 0);
      // net_profit still subtracts expenses (kept for the EOD report card display)
      const net_profit    = gross_profit - total_expenses;

      return { cash_sales, mpesa_sales, card_sales, credit_sales, total_sales, total_cost, gross_profit, total_expenses, net_profit };
    },
  });
}