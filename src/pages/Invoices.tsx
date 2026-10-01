import { useState, useMemo, useRef } from 'react';
import { useSales, useCreateSale } from '@/hooks/useSales';
import { useCustomers } from '@/hooks/useCustomers';
import { useShopSettings } from '@/hooks/useShopSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { FileText, Eye, Printer, Calendar, TrendingUp, Banknote, CreditCard, History, Upload, MessageCircle } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useMoney } from '@/hooks/useCurrencySettings';

// Each sale = its own invoice. Generate a short readable invoice number.
function buildInvoiceNumber(sale: any, index: number, total: number) {
  const d = new Date(sale.date);
  const datePart = format(d, 'yyyyMMdd');
  // Sequential number based on reverse-sorted index (oldest = 1)
  const seq = String(total - index).padStart(4, '0');
  return `INV-${datePart}-${seq}`;
}

export default function Invoices() {
  const { fmt: money } = useMoney();
  const { data: sales } = useSales();
  const { data: shop } = useShopSettings();
  const { data: customers } = useCustomers();
  const createSale = useCreateSale();
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!importRef.current) return;
    importRef.current.value = '';
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      if (!rows.length) { toast.error('No data found in file'); return; }
      const custMap: Record<string, string> = {};
      (customers || []).forEach((c: any) => { custMap[c.name.toLowerCase()] = c.id; });
      let imported = 0;
      for (const row of rows) {
        const total = Number(row['Total Amount'] || row['total_amount'] || 0);
        if (!total) continue;
        const payment_method = (row['Payment Method'] || row['payment_method'] || 'cash').toString().toLowerCase().replace(/[^a-z]/g, '');
        const custName = (row['Customer'] || row['customer'] || '').toString().trim();
        const customer_id = custName ? custMap[custName.toLowerCase()] : undefined;
        await createSale.mutateAsync({
          items: [{ product_id: '', quantity: 1, unit_price: total, subtotal: total, piece_mode: 0, pieces_per_pack: 0 }],
          payment_method: ['cash','mpesa','card','credit'].includes(payment_method) ? payment_method : 'cash',
          customer_id,
        });
        imported++;
      }
      toast.success(`Imported ${imported} invoice${imported !== 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error('Import failed: ' + err.message);
    }
  };

  const now = new Date();

  // Each sale is its own invoice with a unique invoice number
  const invoices = useMemo(() => {
    if (!sales) return [];
    // sales arrive sorted DESC by date; assign invoice numbers
    const total = sales.length;
    return sales.map((sale: any, idx: number) => ({
      ...sale,
      invoice_number: buildInvoiceNumber(sale, idx, total),
      all_items: sale.sale_items || [],
    }));
  }, [sales]);

  // Group invoices by period
  const groupedInvoices = useMemo(() => {
    const groups: Record<string, any[]> = {};
    invoices.forEach((inv: any) => {
      const saleDate = new Date(inv.date);
      let key: string;
      if (period === 'daily') {
        key = format(saleDate, 'dd MMM yyyy');
      } else if (period === 'monthly') {
        key = format(saleDate, 'MMMM yyyy');
      } else {
        key = format(saleDate, 'yyyy');
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(inv);
    });
    return groups;
  }, [invoices, period]);

  const groupKeys = Object.keys(groupedInvoices);

  // Summary stats
  const cashTotal = (sales || []).filter((s: any) => s.payment_method === 'cash').reduce((sum: number, s: any) => sum + s.total_amount, 0);
  const mpesaTotal = (sales || []).filter((s: any) => s.payment_method === 'mpesa').reduce((sum: number, s: any) => sum + s.total_amount, 0);
  const creditTotal = (sales || []).filter((s: any) => s.payment_method === 'credit').reduce((sum: number, s: any) => sum + s.total_amount, 0);

  const totalInvoices = invoices.length;
  const totalRevenue = invoices.reduce((s: number, inv: any) => s + inv.total_amount, 0);
  const todayInvoices = invoices.filter((inv: any) => isSameDay(new Date(inv.date), now));
  const todayRevenue = todayInvoices.reduce((s: number, inv: any) => s + inv.total_amount, 0);

  const paymentLabel = (method: string) => {
    const labels: Record<string, string> = { cash: '💵 Cash', mpesa: '📱 M-Pesa', card: '💳 Card', credit: '📝 On Debt' };
    return labels[method] || method;
  };

  const paymentBadgeStyle = (method: string) => {
    const styles: Record<string, string> = {
      cash: 'bg-success/10 text-success border-success/20',
      mpesa: 'bg-primary/10 text-primary border-primary/20',
      card: 'bg-accent/10 text-accent-foreground border-accent/20',
      credit: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return styles[method] || '';
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const shopName = shop?.shop_name || 'DeynPro';
    const shopPhone = shop?.phone || '';
    const shopAddress = shop?.address || '';
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 4px 0; color: #666; font-size: 14px; }
            .details { margin: 16px 0; font-size: 14px; }
            .details div { margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { padding: 8px 12px; border-bottom: 1px solid #ddd; text-align: left; font-size: 14px; }
            th { background: #f5f5f5; font-weight: 600; }
            .text-right { text-align: right; }
            .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #333; }
            .footer { text-align: center; margin-top: 32px; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
          <div class="footer">Thank you for your business! — ${shopName}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  function formatPhone(phone: string) {
    let clean = phone.replace(/\s+/g, '');
    if (clean.startsWith('0')) clean = '254' + clean.slice(1);
    if (!clean.startsWith('+')) clean = '+' + clean;
    return clean.replace('+', '');
  }

  async function handleWhatsApp(inv: any) {
    const customerPhone = inv.customers?.phone;
    if (!customerPhone) {
      toast.error('No phone number for this customer');
      return;
    }
    const shopName = shop?.shop_name || 'DeynPro';
    const invNum = buildInvoiceNumber(inv, 0, 1);
    const itemLines = (inv.sale_items || [])
      .map((i: any) => `  • ${i.products?.name || 'Item'} x${i.quantity} = ${money(i.subtotal)}`)
      .join('\n');

    const message =
      `🧾 *Invoice from ${shopName}*\n` +
      `Invoice #: ${invNum}\n` +
      `Date: ${format(new Date(inv.date), 'dd MMM yyyy')}\n\n` +
      `*Items:*\n${itemLines}\n\n` +
      `*Total: ${money(inv.total_amount)}*\n\n` +
      `Payment: ${inv.payment_method?.toUpperCase() || 'CASH'}\n\n` +
      `Thank you for your business! 🙏`;

    const num = formatPhone(customerPhone);
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, '_blank');
    toast.success('WhatsApp opened');
  } 
  return(
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
        <p className="text-sm text-muted-foreground">Each sale gets its own invoice</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
          <Button variant="outline" className="gap-1" onClick={() => importRef.current?.click()}>
            <Upload size={16} /> Import
          </Button>
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Today</span>
              <Calendar size={14} className="text-primary" />
            </div>
            <p className="text-lg font-bold text-card-foreground">{todayInvoices.length} invoices</p>
            <p className="text-xs text-muted-foreground">{money(todayRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Total Invoices</span>
              <FileText size={14} className="text-primary" />
            </div>
            <p className="text-lg font-bold text-card-foreground">{totalInvoices}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Grand Total (All Invoices)</span>
              <TrendingUp size={14} className="text-success" />
            </div>
            <p className="text-xl font-bold text-primary">{money(totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 [&>*]:min-w-0">
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <Banknote size={18} className="mx-auto text-success mb-1" />
            <p className="text-xs text-muted-foreground">Cash Sales</p>
            <p className="text-xs sm:text-sm font-bold text-card-foreground break-words">{money(cashTotal)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <CreditCard size={18} className="mx-auto text-primary mb-1" />
            <p className="text-xs text-muted-foreground">M-Pesa</p>
            <p className="text-xs sm:text-sm font-bold text-card-foreground break-words">{money(mpesaTotal)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <History size={18} className="mx-auto text-destructive mb-1" />
            <p className="text-xs text-muted-foreground">On Debt</p>
            <p className="text-xs sm:text-sm font-bold text-card-foreground break-words">{money(creditTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Grouped Invoices */}
      {groupKeys.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="p-8 text-center">
            <FileText size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No invoices yet. Make a sale to see invoices here.</p>
          </CardContent>
        </Card>
      ) : (
        groupKeys.map((key) => {
          const groupInvs = groupedInvoices[key];
          const groupTotal = groupInvs.reduce((s: number, inv: any) => s + inv.total_amount, 0);
          return (
            <Card key={key} className="shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar size={14} className="text-primary" />
                    {key}
                  </CardTitle>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{groupInvs.length} invoice{groupInvs.length > 1 ? 's' : ''}</p>
                    <p className="text-sm font-bold text-primary">{money(groupTotal)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Mobile: cards */}
                <div className="md:hidden space-y-2">
                  {groupInvs.map((inv: any, idx: number) => (
                    <div key={inv.id + idx} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {inv.customers?.name || <span className="text-muted-foreground">Walk-in</span>}
                          </p>
                          <p className="text-[11px] font-mono text-muted-foreground truncate">{inv.invoice_number}</p>
                        </div>
                        <p className="text-base font-bold shrink-0">{money(inv.total_amount)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className={paymentBadgeStyle(inv.payment_method)}>
                          {paymentLabel(inv.payment_method)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {inv.all_items?.length || 0} item{(inv.all_items?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1 h-10 gap-1.5 text-primary" onClick={() => setSelectedInvoice(inv)}>
                          <Eye size={15} /> View
                        </Button>
                        {inv.customers?.phone && (
                          <Button size="sm" variant="outline" className="flex-1 h-10 gap-1.5 text-green-700 border-green-600/40" onClick={() => handleWhatsApp(inv)}>
                            <MessageCircle size={15} /> WhatsApp
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupInvs.map((inv: any, idx: number) => (
                        <TableRow key={inv.id + idx}>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {inv.invoice_number}
                          </TableCell>
                          <TableCell className="text-sm">
                            {inv.customers?.name || <span className="text-muted-foreground">Walk-in</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {inv.all_items?.length || 0} item{(inv.all_items?.length || 0) !== 1 ? 's' : ''}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={paymentBadgeStyle(inv.payment_method)}>
                              {paymentLabel(inv.payment_method)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm">
                            {money(inv.total_amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" className="gap-1 text-primary" onClick={() => setSelectedInvoice(inv)}>
                                <Eye size={14} /> View
                              </Button>
                              {inv.customers?.phone && (
                                <Button size="sm" variant="ghost" className="gap-1 text-green-700" onClick={() => handleWhatsApp(inv)}>
                                  <MessageCircle size={14} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={18} />
              {selectedInvoice?.invoice_number || 'Invoice'}
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              <div ref={printRef}>
                <div className="header" style={{ textAlign: 'center', marginBottom: 16 }}>
                  <h1 style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>{shop?.shop_name || 'DeynPro'}</h1>
                  {shop?.phone && <p style={{ margin: '2px 0', color: '#666', fontSize: 12 }}>📞 {shop.phone}</p>}
                  {shop?.address && <p style={{ margin: '2px 0', color: '#666', fontSize: 12 }}>📍 {shop.address}</p>}
                  <p style={{ margin: '4px 0', color: '#666', fontSize: 13 }}>Invoice</p>
                </div>

                <div className="details text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice #:</span>
                    <span className="font-mono">{selectedInvoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span>{format(new Date(selectedInvoice.date), 'dd MMM yyyy, HH:mm')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span>{selectedInvoice.customers?.name || 'Walk-in Customer'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment:</span>
                    <span>{paymentLabel(selectedInvoice.payment_method)}</span>
                  </div>
                </div>

                <Separator className="my-3" />

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid hsl(var(--border))' }}>
                      <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 12, color: '#888' }}>Product</th>
                      <th style={{ textAlign: 'center', padding: '6px 0', fontSize: 12, color: '#888' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 12, color: '#888' }}>Price</th>
                      <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 12, color: '#888' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedInvoice.all_items || []).map((item: any, i: number) => (
                      <tr key={item.id || i} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                        <td style={{ padding: '8px 0', fontSize: 13 }}>{item.products?.name || 'Unknown'}</td>
                        <td style={{ textAlign: 'center', padding: '8px 0', fontSize: 13 }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right', padding: '8px 0', fontSize: 13 }}>{money(item.unit_price)}</td>
                        <td style={{ textAlign: 'right', padding: '8px 0', fontSize: 13, fontWeight: 600 }}>{money(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <Separator className="my-2" />

                <div className="flex justify-between items-center py-2">
                  <span className="font-bold text-base">Total</span>
                  <span className="font-bold text-lg text-primary">{money(selectedInvoice.total_amount)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 gap-2" onClick={handlePrint}>
                  <Printer size={16} /> Print Invoice
                </Button>
                {selectedInvoice.customers?.phone && (
                  <Button variant="outline" className="flex-1 gap-2 text-green-700 border-green-600/40 hover:bg-green-50 dark:hover:bg-green-950"
                    onClick={() => handleWhatsApp(selectedInvoice)}>
                    <MessageCircle size={16} /> WhatsApp
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
