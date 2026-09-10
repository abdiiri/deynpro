import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ShopSettings {
  id: string;
  shop_name: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
}

const LOCAL_ID = 'local';
import { getDB } from '@/lib/db';
const db = getDB;

export function useShopSettings() {
  return useQuery({
    queryKey: ['shop_settings'],
    queryFn: async () => {
      const rows: any[] = await db().select('shop_settings', { user_id: LOCAL_ID });
      return rows.length ? rows[0] as ShopSettings : null;
    },
  });
}

export function useSaveShopSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { shop_name: string; phone?: string; address?: string; logo_url?: string }) => {
      const existing: any[] = await db().select('shop_settings', { user_id: LOCAL_ID });
      if (existing.length) {
        await db().update('shop_settings', input, { user_id: LOCAL_ID });
        return { ...existing[0], ...input };
      } else {
        return db().insert('shop_settings', { user_id: LOCAL_ID, ...input });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shop_settings'] }),
  });
}
