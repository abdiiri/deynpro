/**
 * useThermalPrinter
 *
 * Builds the electron-pos-printer data array from a ReceiptData object and
 * sends it to the main process via the `window.electronThermal` IPC bridge.
 *
 * Only active in Electron — falls back gracefully in browser/PWA mode.
 *
 * electron-pos-printer data format:
 *   { type: 'text' | 'qrCode' | 'barCode' | 'image', value: string, ... }
 */

import { useState, useEffect } from 'react';
import { getBaseCurrencyCode } from '@/hooks/useCurrencySettings';

export interface ThermalReceiptData {
  saleId: string;
  date: string;
  items: { name: string; quantity: number; unit_price: number; subtotal: number }[];
  total: number;
  paymentMethod: string;
  customerName?: string | null;
  shopName?: string;
  shopPhone?: string | null;
  shopAddress?: string | null;
}

const PM: Record<string, string> = {
  cash: 'CASH', mpesa: 'M-PESA', card: 'CARD', credit: 'CREDIT',
};

function buildPrintData(r: ThermalReceiptData) {
  // Thermal printers often lack glyphs for symbols like ₦ or €, so print the ISO code.
  const currencyCode = getBaseCurrencyCode();
  const fmt = (n: number) => `${currencyCode} ${n.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
  const pad = (left: string, right: string, width = 32) => {
    const gap = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(gap) + right;
  };

  const lines: any[] = [];

  const text = (value: string, opts: Record<string, any> = {}) =>
    lines.push({ type: 'text', value, style: 'NORMAL', fontSize: '20px', ...opts });

  const divider = () => text('--------------------------------', { style: 'NORMAL' });

  // Header
  text(r.shopName || 'SHOP RECEIPT', { style: 'B', align: 'CT', fontSize: '24px' });
  if (r.shopAddress) text(r.shopAddress, { align: 'CT' });
  if (r.shopPhone)   text(`Tel: ${r.shopPhone}`, { align: 'CT' });
  divider();

  // Meta
  text(pad('Receipt #', r.saleId.slice(0, 8).toUpperCase()));
  text(pad('Date', new Date(r.date).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })));
  if (r.customerName) text(pad('Customer', r.customerName));
  text(pad('Payment', PM[r.paymentMethod] || r.paymentMethod.toUpperCase()));
  divider();

  // Items
  text(pad('ITEM', 'TOTAL', 32), { style: 'B' });
  for (const item of r.items) {
    // Product name (truncated)
    const name = item.name.length > 20 ? item.name.slice(0, 19) + '…' : item.name;
    text(name);
    text(pad(`  ${item.quantity} x ${item.unit_price.toLocaleString()}`, fmt(item.subtotal)));
  }
  divider();

  // Total
  text(pad('TOTAL', fmt(r.total), 32), { style: 'B', fontSize: '24px' });
  divider();

  // Footer
  text('  Thank you for your business!  ', { align: 'CT' });
  text('', {}); // feed line
  text('', {}); // feed line

  return lines;
}

export function useThermalPrinter() {
  const isAvailable = typeof window !== 'undefined' && !!(window as any).electronThermal;
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAvailable) return;
    (window as any).electronThermal.getPrinters().then((res: any) => {
      if (res.ok && res.printers?.length) {
        const names: string[] = res.printers.map((p: any) => p.name || p);
        setPrinters(names);
        // Auto-select first printer that looks like a thermal printer
        const thermal = names.find(n =>
          /thermal|pos|receipt|58mm|80mm|xp|epson|star|bixolon/i.test(n)
        );
        setSelectedPrinter(thermal || names[0]);
      }
    }).catch(() => {});
  }, [isAvailable]);

  async function print(receipt: ThermalReceiptData): Promise<boolean> {
    if (!isAvailable) return false;
    setError(null);
    setPrinting(true);
    try {
      const lines = buildPrintData(receipt);
      const res = await (window as any).electronThermal.print(lines, selectedPrinter || undefined);
      if (!res.ok) { setError(res.error || 'Print failed'); return false; }
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setPrinting(false);
    }
  }

  return { isAvailable, printers, selectedPrinter, setSelectedPrinter, print, printing, error };
}
