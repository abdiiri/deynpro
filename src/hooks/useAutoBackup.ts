import { useEffect, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// electronEnv.isElectron is set by preload.cjs when running inside Electron
const isElectron = !!(window as any).electronEnv?.isElectron;

// Offline fallback user ID
const OFFLINE_USER_ID = 'offline-user';

const getBackupAPI = () => {
  const api = (window as any).electronBackup;
  if (!api) throw new Error('Electron API not found – make sure you are running the desktop app');
  return api;
};

export function useAutoBackup() {
  const [isScheduled, setIsScheduled] = useState(false);

  useEffect(() => {
    if (!isElectron) return;

    let cancelled = false;

    const initScheduler = async () => {
      try {
        const api = getBackupAPI();
        const result = await api.startScheduler(OFFLINE_USER_ID);
        if (!cancelled && result?.success) {
          setIsScheduled(true);
          console.log('Auto-backup scheduler started');
        }
      } catch (error) {
        console.error('Failed to start backup scheduler:', error);
      }
    };

    initScheduler();

    return () => {
      cancelled = true;
      try {
        const api = (window as any).electronBackup;
        if (api) api.cancelScheduler().catch(() => {});
      } catch (_) {}
    };
  }, []); // run once on mount

  return { isScheduled };
}

export function useTriggerBackup() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const api = getBackupAPI();
      const result = await api.exportTodayInvoices(OFFLINE_USER_ID);
      if (!result.success) {
        throw new Error(result.error || 'Backup failed');
      }
      return result.data;
    },

    onSuccess: (data) => {
      toast.success(`✓ Backup created: ${data.filename}`, {
        description: `${data.invoiceCount} invoices, ${data.itemCount} items, Total: ${data.totalAmount.toLocaleString(
          'en-KE',
          { style: 'currency', currency: 'KES' }
        )}`,
        duration: 5000,
      });
      qc.invalidateQueries({ queryKey: ['backup-history'] });
    },

    onError: (error: any) => {
      toast.error('Backup failed', { description: error.message });
    },
  });
}

export function useBackupHistory() {
  return useQuery({
    queryKey: ['backup-history'],
    queryFn: async () => {
      const api = (window as any).electronBackup;
      if (!api) return [];
      const result = await api.getHistory();
      if (!result.success) throw new Error(result.error || 'Failed to get backup history');
      return result.data;
    },
    retry: false,
    enabled: isElectron,
  });
}

export function useOpenBackupFolder() {
  return useCallback(async () => {
    try {
      const api = getBackupAPI();
      const result = await api.openFolder();
      if (!result.success) toast.error('Failed to open backup folder');
    } catch (error: any) {
      toast.error(error.message || 'Failed to open backup folder');
      console.error(error);
    }
  }, []);
}

export function useNextBackupTime() {
  return useQuery({
    queryKey: ['next-backup-time'],
    queryFn: async () => {
      const api = (window as any).electronBackup;
      if (!api) return null;
      const result = await api.getNextTime();
      if (!result.success) throw new Error(result.error || 'Failed to get next backup time');
      return new Date(result.data);
    },
    retry: false,
    // Refresh every minute so the countdown stays fresh
    refetchInterval: 1000 * 60,
    enabled: isElectron,
  });
}
