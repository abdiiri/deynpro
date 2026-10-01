import { useMemo, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, X } from 'lucide-react';
import { format } from 'date-fns';
import type { Customer, Transaction } from '@/hooks/useCustomers';
import type { ShopSettings } from '@/hooks/useShopSettings';
import { useMoney } from '@/hooks/useCurrencySettings';

interface Props {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  transactions: Transaction[];
  shop?: ShopSettings | null;
}

const STYLE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; padding: 24px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 16px; }
  .shop-name { font-size: 20px; font-weight: bold; }
  .muted { color: #555; font-size: 11px; }
  .statement-title { font-size: 16px; font-weight: bold; text-align: right; }
  .meta-table { width: 100%; margin-bottom: 16px; border-collapse: collapse; }
  .meta-table td { padding: 2px 0; vertical-align: top; }
  .meta-table td.label { color: #555; width: 110px; }
  table.ledger { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.ledger th { text-align: left; border-bottom: 2px solid #222; padding: 6px 4px; font-size: 11px; }
  table.ledger td { padding: 6px 4px; border-bottom: 1px solid #ddd; font-size: 11.5px; }
  table.ledger th.r, table.ledger td.r { text-align: right; }
  .debt-amt { color: #b91c1c; }
  .payment-amt { color: #15803d; }
  .summary { margin-top: 16px; width: 260px; margin-left: auto; }
  .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .summary-row.total { border-top: 2px solid #222; font-weight: bold; font-size: 14px; padding-top: 8px; margin-top: 4px; }
  .footer { margin-top: 24px; font-size: 10.5px; color: #777; text-align: center; }
  @media print { @page { size: A4; margin: 14mm; } body { padding: 0; } }
`;

export function CustomerStatementModal({ open, onClose, customer, transactions, shop }: Props) {
  const { fmt } = useMoney();
  const money = (n: number) => fmt(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const printRef = useRef<HTMLDivElement>(null);

  const ledger = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let running = 0;
    return sorted.map(tx => {
      running += tx.type === 'debt' ? tx.amount : -tx.amount;
      return { ...tx, runningBalance: running };
    });
  }, [transactions]);

  const totalDebt = transactions.filter(t => t.type === 'debt').reduce((s, t) => s + t.amount, 0);
  const totalPaid = transactions.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);
  const closingBalance = totalDebt - totalPaid;

  if (!customer) return null;

  const buildHtml = () => `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/><title>Statement - ${customer.name}</title><style>${STYLE}</style></head>
    <body>${printRef.current?.innerHTML || ''}</body>
    </html>
  `;

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=850,height=1000');
    if (!win) return;
    win.document.write(buildHtml() + `<script>window.onload = () => { window.print(); window.close(); }<\/script>`);
    win.document.close();
  };

  const handleDownloadPDF = () => {
    const win = window.open('', '_blank', 'width=850,height=1000');
    if (!win) return;
    win.document.write(buildHtml());
    win.document.close();
  };

  const today = format(new Date(), 'MMM d, yyyy');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <span className="font-semibold text-sm">Statement — {customer.name}</span>
          <div className="flex gap-2 items-center">
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

        <div className="overflow-y-auto max-h-[75vh] bg-white p-4 flex justify-center">
          <div ref={printRef} className="w-full text-black" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12 }}>
            <div className="header" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #222', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <div className="shop-name" style={{ fontSize: 20, fontWeight: 'bold' }}>{shop?.shop_name || 'Shop'}</div>
                {shop?.address && <div className="muted" style={{ color: '#555', fontSize: 11 }}>{shop.address}</div>}
                {shop?.phone && <div className="muted" style={{ color: '#555', fontSize: 11 }}>Tel: {shop.phone}</div>}
              </div>
              <div className="statement-title" style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'right' }}>
                CUSTOMER STATEMENT
                <div className="muted" style={{ color: '#555', fontSize: 11, fontWeight: 'normal' }}>As of {today}</div>
              </div>
            </div>

            <table className="meta-table" style={{ width: '100%', marginBottom: 16 }}>
              <tbody>
                <tr><td className="label" style={{ color: '#555', width: 110 }}>Customer</td><td style={{ fontWeight: 'bold' }}>{customer.name}</td></tr>
                <tr><td className="label" style={{ color: '#555' }}>Phone</td><td>{customer.phone}</td></tr>
                {customer.credit_limit > 0 && <tr><td className="label" style={{ color: '#555' }}>Credit Limit</td><td>{money(customer.credit_limit)}</td></tr>}
              </tbody>
            </table>

            <table className="ledger" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '2px solid #222', padding: '6px 4px' }}>Date</th>
                  <th style={{ textAlign: 'left', borderBottom: '2px solid #222', padding: '6px 4px' }}>Description</th>
                  <th className="r" style={{ textAlign: 'right', borderBottom: '2px solid #222', padding: '6px 4px' }}>Debt</th>
                  <th className="r" style={{ textAlign: 'right', borderBottom: '2px solid #222', padding: '6px 4px' }}>Payment</th>
                  <th className="r" style={{ textAlign: 'right', borderBottom: '2px solid #222', padding: '6px 4px' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '16px 4px', textAlign: 'center', color: '#777' }}>No transactions</td></tr>
                ) : ledger.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ padding: '6px 4px', borderBottom: '1px solid #ddd' }}>{format(new Date(tx.date), 'dd/MM/yyyy')}</td>
                    <td style={{ padding: '6px 4px', borderBottom: '1px solid #ddd' }}>{tx.description || (tx.type === 'debt' ? 'Debt' : 'Payment')}</td>
                    <td className="r debt-amt" style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid #ddd', color: '#b91c1c' }}>
                      {tx.type === 'debt' ? money(tx.amount) : ''}
                    </td>
                    <td className="r payment-amt" style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid #ddd', color: '#15803d' }}>
                      {tx.type === 'payment' ? money(tx.amount) : ''}
                    </td>
                    <td className="r" style={{ textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid #ddd', fontWeight: 500 }}>
                      {money(tx.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="summary" style={{ marginTop: 16, width: 260, marginLeft: 'auto' }}>
              <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>Total Debt</span><span>{money(totalDebt)}</span>
              </div>
              <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>Total Paid</span><span>{money(totalPaid)}</span>
              </div>
              <div className="summary-row total" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #222', fontWeight: 'bold', fontSize: 14, paddingTop: 8, marginTop: 4 }}>
                <span>Closing Balance</span><span>{money(closingBalance)}</span>
              </div>
            </div>

            <div className="footer" style={{ marginTop: 24, fontSize: 10.5, color: '#777', textAlign: 'center' }}>
              Generated by {shop?.shop_name || 'DeynPro'} on {today}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
