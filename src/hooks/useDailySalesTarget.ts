import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'deynpro_daily_sales_target';

function loadTarget(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Number(JSON.parse(raw)) || 0;
  } catch (_) {}
  return 0;
}

function saveTarget(target: number) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(target));
}

export function useDailySalesTarget() {
  return useQuery({
    queryKey: ['daily_sales_target'],
    queryFn: loadTarget,
    staleTime: Infinity,
  });
}

export function useSaveDailySalesTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (target: number) => {
      saveTarget(target);
      return target;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['daily_sales_target'] }),
  });
}
