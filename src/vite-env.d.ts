/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

declare global {
  interface Window {
    electronDB?: {
      select: (table: string, filters?: Record<string, unknown>) => Promise<any[]>;
      insert: (table: string, values: Record<string, unknown>) => Promise<any>;
      update: (table: string, values: Record<string, unknown>, filters: Record<string, unknown>) => Promise<{ changes: number }>;
      remove: (table: string, filters: Record<string, unknown>) => Promise<{ changes: number }>;
      exportAll: () => Promise<{ app: string; version: number; exportedAt: string; data: Record<string, unknown[]> }>;
      importAll: (payload: unknown) => Promise<{ ok: true }>;
      raw: (sql: string, params?: unknown[]) => Promise<any>;
    };
    electronEnv?: { isElectron: true; platform: string };
    electronLicense?: {
      getStatus: () => Promise<{
        activated: boolean;
        expired?: boolean;
        shopId?: string;
        shopName?: string;
        plan?: string;
        issuedAt?: number;
        expiresAt?: number;
        error?: string;
      }>;
      activate: (code: string) => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>;
      clear: () => Promise<{ ok: true }>;
      pullSnapshot?: () => Promise<{ ok: boolean; error?: string }>;
      pushSnapshot?: () => Promise<{ ok: boolean; error?: string }>;
      checkSnapshot?: () => Promise<{ exists: boolean; updatedAt?: string; recordCount?: number } | null>;
      startFreshSnapshot?: () => void;
    };
  }
}

export {};
