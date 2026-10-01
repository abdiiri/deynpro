import { useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, Download, X, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { toast } from 'sonner';
import { useMoney } from '@/hooks/useCurrencySettings';

interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface ReceiptData {
  saleId: string;
  date: string;
  items: ReceiptItem[];
  total: number;
  paymentMethod: string;
  customerName?: string | null;
  shopName?: string;
  shopPhone?: string | null;
  shopAddress?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
}

const PM_LABEL: Record<string, string> = {
  cash: 'CASH', mpesa: 'M-PESA', card: 'CARD', credit: 'CREDIT'
};

export function ReceiptModal({ open, onClose, receipt }: Props) {
  const { fmt } = useMoney();
  const money = (n: number) => fmt(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const printRef = useRef<HTMLDivElement>(null);
  // Thermal printer (Electron only — invisible in browser/PWA)
  // Must be called BEFORE any conditional return to follow Rules of Hooks
  const thermal = useThermalPrinter();

  if (!receipt) return null;

  const handleThermalPrint = async () => {
    const ok = await thermal.print(receipt);
    if (ok) toast.success('Sent to thermal printer');
    else toast.error(thermal.error || 'Thermal print failed');
  };

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'width=380,height=600');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Receipt #${receipt.saleId.slice(0, 8).toUpperCase()}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 4mm; }
          .center { text-align: center; }
          .right  { text-align: right; }
          .bold   { font-weight: bold; }
          .lg     { font-size: 15px; }
          .sm     { font-size: 10px; }
          .mt     { margin-top: 6px; }
          .mb     { margin-bottom: 6px; }
          hr      { border: none; border-top: 1px dashed #000; margin: 6px 0; }
          table   { width: 100%; border-collapse: collapse; }
          td      { padding: 2px 0; vertical-align: top; }
          td.r    { text-align: right; white-space: nowrap; }
          td.qty  { width: 32px; }
          td.name { padding-right: 4px; }
          .total-row td { font-weight: bold; font-size: 13px; padding-top: 4px; }
          @media print {
            @page { size: 80mm auto; margin: 0; }
            body  { width: 80mm; }
          }
        </style>
      </head>
      <body>
        ${el.innerHTML}
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const handleDownloadPDF = () => {
    // Use browser print-to-PDF via the same popup but without auto-close
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'width=420,height=700');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Receipt #${receipt.saleId.slice(0, 8).toUpperCase()}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 4mm; }
          .center { text-align: center; } .right { text-align: right; }
          .bold { font-weight: bold; } .lg { font-size: 15px; } .sm { font-size: 10px; }
          .mt { margin-top: 6px; } .mb { margin-bottom: 6px; }
          hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 2px 0; vertical-align: top; }
          td.r { text-align: right; white-space: nowrap; } td.qty { width: 32px; } td.name { padding-right: 4px; }
          .total-row td { font-weight: bold; font-size: 13px; padding-top: 4px; }
          @media print { @page { size: 80mm auto; margin: 0; } body { width: 80mm; } }
        </style>
      </head>
      <body>${el.innerHTML}</body>
      </html>
    `);
    win.document.close();
  };

  const receiptDate = (() => { try { return format(new Date(receipt.date), 'dd/MM/yyyy HH:mm'); } catch { return receipt.date; } })();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm w-full p-0 gap-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <span className="font-semibold text-sm">Receipt</span>
          <div className="flex gap-2 flex-wrap items-center">
            {thermal.isAvailable && (
              <>
                {thermal.printers.length > 1 && (
                  <Select value={thermal.selectedPrinter} onValueChange={thermal.setSelectedPrinter}>
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue placeholder="Select printer" />
                    </SelectTrigger>
                    <SelectContent>
                      {thermal.printers.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button size="sm" variant="outline"
                  onClick={handleThermalPrint}
                  disabled={thermal.printing}
                  className="h-8 gap-1.5 text-xs border-green-600/40 text-green-700 hover:bg-green-50 dark:hover:bg-green-950">
                  <Zap size={13} /> {thermal.printing ? 'Printing…' : 'Thermal'}
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={handleDownloadPDF} className="h-8 gap-1.5 text-xs">
              <Download size={13} /> PDF
            </Button>
            <Button size="sm" onClick={handlePrint} className="h-8 gap-1.5 text-xs">
              <Printer size={13} /> Print
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8">
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Receipt preview */}
        <div className="overflow-y-auto max-h-[75vh] bg-white p-2 flex justify-center">
          {/* This div is also used for printing */}
          <div ref={printRef} className="w-full max-w-[320px] font-mono text-[11px] leading-snug text-black">

            {/* Shop header */}
            <div className="center mb bold lg">{receipt.shopName || 'SHOP RECEIPT'}</div>
            {receipt.shopAddress && <div className="center sm">{receipt.shopAddress}</div>}
            {receipt.shopPhone && <div className="center sm">Tel: {receipt.shopPhone}</div>}
            <hr />

            {/* Sale info */}
            <table>
              <tbody>
                <tr><td>Receipt #</td><td className="r">{receipt.saleId.slice(0, 8).toUpperCase()}</td></tr>
                <tr><td>Date</td><td className="r">{receiptDate}</td></tr>
                {receipt.customerName && <tr><td>Customer</td><td className="r">{receipt.customerName}</td></tr>}
                <tr><td>Payment</td><td className="r">{PM_LABEL[receipt.paymentMethod] || receipt.paymentMethod.toUpperCase()}</td></tr>
              </tbody>
            </table>
            <hr />

            {/* Items */}
            <table>
              <thead>
                <tr>
                  <td className="name bold">Item</td>
                  <td className="qty bold center">Qty</td>
                  <td className="r bold">Price</td>
                  <td className="r bold">Total</td>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, i) => (
                  <tr key={i}>
                    <td className="name">{item.name}</td>
                    <td className="qty" style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td className="r">{item.unit_price.toLocaleString()}</td>
                    <td className="r">{item.subtotal.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <hr />

            {/* Total */}
            <table>
              <tbody>
                <tr className="total-row">
                  <td className="bold">TOTAL</td>
                  <td className="r bold">{money(receipt.total)}</td>
                </tr>
              </tbody>
            </table>
            <hr />

            {/* Footer */}
            <div className="center mt sm">Thank you for your purchase!</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
