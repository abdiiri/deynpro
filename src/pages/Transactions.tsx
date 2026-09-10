import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useShopSettings } from '@/hooks/useShopSettings';
import { useAllTransactions } from '@/hooks/useCustomers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileSpreadsheet, Search, X, CalendarRange } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel } from '@/lib/excelExport';
import { toast } from 'sonner';

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString()}`;
}

export default function Transactions() {
  const { data: shopSettings } = useShopSettings();
  const { t } = useTranslation();
  const { data: transactions, isLoading } = useAllTransactions();

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filtered = useMemo(() => {
    let list = transactions || [];

    // Search by customer name, description, or type
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(tx =>
        tx.customers?.name?.toLowerCase().includes(q) ||
        tx.description?.toLowerCase().includes(q) ||
        tx.type?.toLowerCase().includes(q)
      );
    }

    // Date range filter (string comparison on YYYY-MM-DD prefix)
    if (fromDate) {
      list = list.filter(tx => tx.date?.slice(0, 10) >= fromDate);
    }
    if (toDate) {
      list = list.filter(tx => tx.date?.slice(0, 10) <= toDate);
    }

    return list;
  }, [transactions, search, fromDate, toDate]);

  const hasFilters = !!(search || fromDate || toDate);

  const clearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
  };

  const handleExport = () => {
    const rows = filtered.map(tx => ({
      [t('common.date')]: format(new Date(tx.date), 'yyyy-MM-dd HH:mm'),
      [t('common.customer')]: tx.customers?.name || '',
      [t('common.phone')]: tx.customers?.phone || '',
      [t('common.status')]: tx.type,
      [t('common.amount')]: tx.amount,
      [t('common.description')]: tx.description || '',
      [t('customers.dueDate')]: tx.due_date || '',
    }));
    exportToExcel(`${shopSettings?.shop_name || 'Shop'}_Transactions`, [{ name: t('transactions.title'), rows }]);
    toast.success(t('common.excelDownloaded'));
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('transactions.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('transactions.subtitle')}</p>
        </div>
        <Button variant="outline" className="gap-1" onClick={handleExport} disabled={!filtered.length}>
          <FileSpreadsheet size={16} /> {t('common.excel')}
        </Button>
      </div>

      {/* Search + Date Range */}
      <div className="space-y-2">
        {/* Search input */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by customer, description, or type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date range row */}
        <div className="flex items-center gap-2">
          <CalendarRange size={15} className="text-muted-foreground shrink-0" />
          <Input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="h-9 text-sm flex-1"
            title="From date"
          />
          <span className="text-muted-foreground text-sm shrink-0">to</span>
          <Input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="h-9 text-sm flex-1"
            title="To date"
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs shrink-0 h-9 px-2">
              <X size={13} className="mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Filter summary */}
        {hasFilters && (
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> of {transactions?.length || 0} transactions
          </p>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(tx => (
          <Card key={tx.id} className="shadow-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-card-foreground">{tx.customers?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {tx.description || tx.type} · {format(new Date(tx.date), 'MMM d, yyyy')}
                </p>
              </div>
              <span className={`text-sm font-bold ${tx.type === 'payment' ? 'text-success' : 'text-destructive'}`}>
                {tx.type === 'payment' ? '-' : '+'}{formatKES(tx.amount)}
              </span>
            </CardContent>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {hasFilters ? 'No transactions match your filters.' : t('transactions.empty')}
          </p>
        )}
      </div>
    </div>
  );
}