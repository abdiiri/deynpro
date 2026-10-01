import { useState, useEffect } from 'react';
import { useTodayEodData, useSaveEodReport, useEodReports } from '@/hooks/useEodReport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { CheckCircle, TrendingUp, TrendingDown, DollarSign, Smartphone, CreditCard, ClipboardList, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useMoney } from '@/hooks/useCurrencySettings';

export default function EndOfDay() {
  const { fmt: money, code: currencyCode } = useMoney();
  // Compute today's date inside the component so it's always fresh
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: live } = useTodayEodData(today);
  const { data: history } = useEodReports();
  const saveReport = useSaveEodReport();

  const [openingFloat, setOpeningFloat] = useState('');
  const [closingFloat, setClosingFloat] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const todayReport = history?.find(r => r.report_date === today);

  // Pre-populate inputs if a report for today was already saved
  useEffect(() => {
    if (todayReport) {
      setOpeningFloat(todayReport.opening_float > 0 ? String(todayReport.opening_float) : '');
      setClosingFloat(todayReport.closing_float > 0 ? String(todayReport.closing_float) : '');
      setNotes(todayReport.notes || '');
      setSaved(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayReport?.id]);

  const handleSave = async () => {
    if (!live) return;
    try {
      await saveReport.mutateAsync({
        report_date: today,
        cash_sales: live.cash_sales,
        mpesa_sales: live.mpesa_sales,
        card_sales: live.card_sales,
        credit_sales: live.credit_sales,
        total_sales: live.total_sales,
        total_cost: live.total_cost,
        gross_profit: live.gross_profit,
        total_expenses: live.total_expenses,
        net_profit: live.net_profit,
        opening_float: parseFloat(openingFloat) || 0,
        closing_float: parseFloat(closingFloat) || 0,
        notes: notes || null,
      });
      toast.success('End-of-day report saved');
      setSaved(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const data = live || { cash_sales: 0, mpesa_sales: 0, card_sales: 0, credit_sales: 0, total_sales: 0, total_cost: 0, gross_profit: 0, total_expenses: 0, net_profit: 0 };

  const expectedCash = (parseFloat(openingFloat) || 0) + data.cash_sales;

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-foreground">End of Day Report</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer size={15} /> Print
          </Button>
          <Button onClick={handleSave} disabled={saveReport.isPending} className="gap-2">
            <CheckCircle size={15} />
            {saveReport.isPending ? 'Saving…' : saved ? 'Update Report' : 'Save Report'}
          </Button>
        </div>
      </div>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block text-center border-b pb-3 mb-3">
        <h2 className="text-xl font-bold">End of Day Report</h2>
        <p className="text-sm">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      {/* Sales breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Cash Sales', value: data.cash_sales, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'M-Pesa Sales', value: data.mpesa_sales, icon: Smartphone, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Card Sales', value: data.card_sales, icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Credit Sales', value: data.credit_sales, icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                <Icon size={15} className={color} />
              </div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-base sm:text-lg font-bold mt-0.5 break-words ${color}`}>{money(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* P&L Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-2 border-primary/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold text-primary">{money(data.total_sales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Profit (S.P − B.P)</p>
                <p className={`text-xl font-bold ${data.gross_profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{money(data.gross_profit)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Buying cost: {money(data.total_cost)}</p>
              </div>
              {data.gross_profit >= 0
                ? <TrendingUp size={22} className="text-emerald-500" />
                : <TrendingDown size={22} className="text-destructive" />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">After Expenses</p>
                <p className={`text-xl font-bold ${data.net_profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{money(data.net_profit)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Expenses: {money(data.total_expenses)}</p>
              </div>
              {data.net_profit >= 0
                ? <TrendingUp size={22} className="text-emerald-500" />
                : <TrendingDown size={22} className="text-destructive" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Drawer Reconciliation */}
      <Card className="print:border print:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign size={16} /> Cash Drawer Reconciliation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Opening Float ({currencyCode})</label>
              <Input
                type="number" inputMode="decimal" min={0} step="0.01"
                placeholder="0.00"
                value={openingFloat}
                onChange={e => setOpeningFloat(e.target.value)}
                className="h-10 sm:h-9 text-base sm:text-sm print:border-0 print:shadow-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Closing Float — Actual ({currencyCode})</label>
              <Input
                type="number" inputMode="decimal" min={0} step="0.01"
                placeholder="0.00"
                value={closingFloat}
                onChange={e => setClosingFloat(e.target.value)}
                className="h-10 sm:h-9 text-base sm:text-sm print:border-0 print:shadow-none"
              />
            </div>
          </div>

          <Separator />

          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="py-2 text-muted-foreground">Opening Float</td>
                <td className="py-2 text-right font-medium">{money(parseFloat(openingFloat) || 0)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 text-muted-foreground">+ Cash Sales</td>
                <td className="py-2 text-right font-medium text-emerald-600">+{money(data.cash_sales)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 font-semibold">= Expected in Drawer</td>
                <td className="py-2 text-right font-bold text-primary">{money(expectedCash)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-2 text-muted-foreground">Actual in Drawer</td>
                <td className="py-2 text-right font-medium">{money(parseFloat(closingFloat) || 0)}</td>
              </tr>
              {closingFloat !== '' && (
                <tr>
                  <td className="py-2 font-semibold">Difference</td>
                  <td className={`py-2 text-right font-bold ${(parseFloat(closingFloat) || 0) - expectedCash >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {(parseFloat(closingFloat) || 0) - expectedCash >= 0 ? '+' : ''}
                    {money((parseFloat(closingFloat) || 0) - expectedCash)}
                    {' '}
                    <span className="font-normal text-xs text-muted-foreground">
                      {Math.abs((parseFloat(closingFloat) || 0) - expectedCash) < 0.01 ? '✓ Balanced' : (parseFloat(closingFloat) || 0) < expectedCash ? '(Short)' : '(Over)'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
            <Input
              placeholder="Any notes for this report…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Previous Reports */}
      {history && history.length > 0 && (
        <Card className="print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Previous Reports</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile: cards */}
            <div className="md:hidden divide-y divide-border">
              {history.slice(0, 14).map(r => (
                <div key={r.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{format(new Date(r.report_date), 'dd MMM yyyy')}</span>
                    <span className="text-base font-bold text-primary">{money(r.total_sales)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Cash</span><span className="font-medium text-emerald-600">{money(r.cash_sales)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">M-Pesa</span><span className="font-medium text-blue-600">{money(r.mpesa_sales)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Gross</span><span className={`font-medium ${r.gross_profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{money(r.gross_profit)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Net</span><span className={`font-medium ${r.net_profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{money(r.net_profit)}</span></div>
                  </div>
                  {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                  <TableHead className="text-right">Cash</TableHead>
                  <TableHead className="text-right">M-Pesa</TableHead>
                  <TableHead className="text-right">Gross Profit</TableHead>
                  <TableHead className="text-right">Net Profit</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.slice(0, 14).map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">
                      {format(new Date(r.report_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-primary">{money(r.total_sales)}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-600">{money(r.cash_sales)}</TableCell>
                    <TableCell className="text-right text-sm text-blue-600">{money(r.mpesa_sales)}</TableCell>
                    <TableCell className={`text-right text-sm font-medium ${r.gross_profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{money(r.gross_profit)}</TableCell>
                    <TableCell className={`text-right text-sm font-medium ${r.net_profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{money(r.net_profit)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{r.notes || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}