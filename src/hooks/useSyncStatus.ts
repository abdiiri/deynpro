/**
 * useSyncStatus
 *
 * Subscribes to real-time sync status pushed from the Electron main process.
 * Returns the current sync state for display in the UI.
 *
 * Status values:
 *   'idle'     — not started yet
 *   'syncing'  — actively pushing/pulling
 *   'online'   — last sync succeeded, server is reachable
 *   'offline'  — server unreachable, working locally
 *   'error'    — sync failed with an unexpected error
 */
import { useState, useEffect } from 'react';

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'online' | 'offline' | 'error';
  pendingCount: number;
  lastSyncTs: string | null;
  mode: 'standalone' | 'server' | 'client';
}

const isElectron = !!(window as any).electronEnv?.isElectron;

export function useSyncStatus(): SyncStatus {
  const [state, setState] = useState<SyncStatus>({
    status: 'idle',
    pendingCount: 0,
    lastSyncTs: null,
    mode: 'standalone',
  });

  useEffect(() => {
    if (!isElectron) return;

    const net = (window as any).electronNet;
    if (!net) return;

    // Load initial config + status
    Promise.all([net.getConfig(), net.getSyncStatus()]).then(([cfg, syncSt]) => {
      setState(prev => ({
        ...prev,
        mode: cfg?.mode || 'standalone',
        status: syncSt?.status || 'idle',
        pendingCount: syncSt?.pendingCount || 0,
        lastSyncTs: syncSt?.lastSyncTs || null,
      }));
    }).catch(() => {});

    // Subscribe to live status updates
    const unsub = net.onSyncStatus((data: any) => {
      setState(prev => ({
        ...prev,
        status: data.status,
        pendingCount: data.pendingCount ?? prev.pendingCount,
      }));
    });

    return () => { try { unsub?.(); } catch (_) {} };
  }, []);

  return state;
}
