import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCustomers, useAllTransactions } from '@/hooks/useCustomers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Download, Clock } from 'lucide-react';
import { buildArAgingReport, sumBuckets } from '@/lib/arAging';
import { exportToExcel } from '@/lib/excelExport';
import { toast } from 'sonner';

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function ARAging() {
  const { t } = useTranslation();
  const { data: customers, isLoading: custLoading } = useCustomers();
  const { data: allTx, isLoading: txLoading } = useAllTransactions();

  const rows = useMemo(() => {
    if (!customers || !allTx) return [];
    return buildArAgingReport(customers, allTx);
  }, [customers, allTx]);

  const totals = useMemo(() => sumBuckets(rows), [rows]);

  const handleExport = () => {
    if (!rows.length) { toast.error(t('arAging.noData')); return; }
    exportToExcel('AR_Aging_Report', [{
      name: 'AR Aging',
      rows: rows.map(r => ({
        Customer: r.customerName,
        Phone: r.customerPhone,
        Current: r.current,
        '1-30 Days': r.d1_30,
        '31-60 Days': r.d31_60,
        '61-90 Days': r.d61_90,
        '90+ Days': r.d90plus,
        Total: r.total,
      })),
    }]);
    toast.success(t('common.exported'));
  };

  const isLoading = custLoading || txLoading;

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock size={22} className="text-primary" /> {t('arAging.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('arAging.subtitle')}</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport}>
          <Download size={14} /> {t('common.excel')}
        </Button>
      </div>

      {/* Bucket summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: t('arAging.current'), value: totals.current, tone: 'text-success' },
          { label: t('arAging.d1_30'), value: totals.d1_30, tone: 'text-foreground' },
          { label: t('arAging.d31_60'), value: totals.d31_60, tone: 'text-amber-600 dark:text-amber-400' },
          { label: t('arAging.d61_90'), value: totals.d61_90, tone: 'text-orange-600 dark:text-orange-400' },
          { label: t('arAging.d90plus'), value: totals.d90plus, tone: 'text-destructive' },
        ].map((b, i) => (
          <Card key={i} className="shadow-card">
            <CardContent className="p-3 text-center">
              <p className="text-[11px] text-muted-foreground">{b.label}</p>
              <p className={`text-sm md:text-base font-bold ${b.tone}`}>{formatKES(b.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>{t('arAging.byCustomer')}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {t('arAging.totalOutstanding')}: <span className="font-bold text-destructive">{formatKES(totals.total)}</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('arAging.noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('customers.customer')}</TableHead>
                    <TableHead className="text-right">{t('arAging.current')}</TableHead>
                    <TableHead className="text-right">{t('arAging.d1_30')}</TableHead>
                    <TableHead className="text-right">{t('arAging.d31_60')}</TableHead>
                    <TableHead className="text-right">{t('arAging.d61_90')}</TableHead>
                    <TableHead className="text-right">{t('arAging.d90plus')}</TableHead>
                    <TableHead className="text-right">{t('common.total')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.customerId}>
                      <TableCell>
                        <Link to={`/customers/${r.customerId}`} className="font-medium text-primary hover:underline">
                          {r.customerName}
                        </Link>
                        {(r.d61_90 > 0 || r.d90plus > 0) && (
                          <AlertTriangle size={12} className="inline ms-1.5 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="text-right text-success">{r.current > 0 ? formatKES(r.current) : '—'}</TableCell>
                      <TableCell className="text-right">{r.d1_30 > 0 ? formatKES(r.d1_30) : '—'}</TableCell>
                      <TableCell className="text-right text-amber-600 dark:text-amber-400">{r.d31_60 > 0 ? formatKES(r.d31_60) : '—'}</TableCell>
                      <TableCell className="text-right text-orange-600 dark:text-orange-400">{r.d61_90 > 0 ? formatKES(r.d61_90) : '—'}</TableCell>
                      <TableCell className="text-right text-destructive">{r.d90plus > 0 ? formatKES(r.d90plus) : '—'}</TableCell>
                      <TableCell className="text-right font-bold">{formatKES(r.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
