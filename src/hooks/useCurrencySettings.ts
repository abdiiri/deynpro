import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface CurrencySettings {
  base_currency: string;    // e.g. 'KES'
  purchase_currency: string; // e.g. 'USD'
  exchange_rate: number;    // 1 purchase_currency = X base_currency
  show_dual_price: boolean; // show both currencies in products
}

const DEFAULT: CurrencySettings = {
  base_currency: 'KES',
  purchase_currency: 'KES',
  exchange_rate: 1,
  show_dual_price: false,
};

const STORAGE_KEY = 'deynpro_currency_settings';

function loadSettings(): CurrencySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch (_) {}
  return DEFAULT;
}

function saveSettings(s: CurrencySettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function useCurrencySettings() {
  return useQuery({
    queryKey: ['currency_settings'],
    queryFn: loadSettings,
    // Settings live in localStorage, so they're available synchronously. Seeding the
    // query avoids a first render that shows the default currency before the real one.
    initialData: loadSettings,
    staleTime: Infinity,
  });
}

/** Base currency code for non-React code (printers, toasts). Components should use useMoney(). */
export function getBaseCurrencyCode(): string {
  return loadSettings().base_currency || DEFAULT.base_currency;
}

export function useSaveCurrencySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: CurrencySettings) => {
      saveSettings(settings);
      return settings;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['currency_settings'] }),
  });
}

export const SUPPORTED_CURRENCIES = [
  { code: 'KES', symbol: 'KES', name: 'Kenyan Shilling' },
  { code: 'USD', symbol: '$',   name: 'US Dollar' },
  { code: 'EUR', symbol: '€',   name: 'Euro' },
  { code: 'GBP', symbol: '£',   name: 'British Pound' },
  { code: 'TZS', symbol: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'UGX', symbol: 'UGX', name: 'Ugandan Shilling' },
  { code: 'RWF', symbol: 'RWF', name: 'Rwandan Franc' },
  { code: 'ETB', symbol: 'ETB', name: 'Ethiopian Birr' },
  { code: 'ZAR', symbol: 'R',   name: 'South African Rand' },
  { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'CNY', symbol: '¥',   name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹',   name: 'Indian Rupee' },
];

export interface MoneyFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function formatCurrency(amount: number, code: string, opts: MoneyFormatOptions = {}): string {
  const cur = SUPPORTED_CURRENCIES.find(c => c.code === code);
  const symbol = cur?.symbol || code;
  return `${symbol} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: opts.minimumFractionDigits ?? 0,
    maximumFractionDigits: opts.maximumFractionDigits ?? 2,
  })}`;
}

/**
 * Formats amounts in the shop's base currency.
 *   const { fmt, code } = useMoney();
 *   fmt(1500)  ->  "KES 1,500"   (or "TSh"/"$"/... depending on Settings)
 */
export function useMoney() {
  const { data } = useCurrencySettings();
  const code = data?.base_currency || DEFAULT.base_currency;
  return useMemo(
    () => ({ code, fmt: (amount: number, opts?: MoneyFormatOptions) => formatCurrency(amount, code, opts) }),
    [code],
  );
}

/** Convert a purchase-currency cost to base (KES) */
export function toBaseCurrency(amount: number, settings: CurrencySettings): number {
  if (settings.purchase_currency === settings.base_currency) return amount;
  return amount * settings.exchange_rate;
}
