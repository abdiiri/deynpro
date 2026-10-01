import { useState, useMemo } from 'react';
import { useShopSettings } from '@/hooks/useShopSettings';
import { useSales } from '@/hooks/useSales';
import { useExpenses } from '@/hooks/useExpenses';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Receipt, Download } from 'lucide-react';
import { format, subDays, startOfDay, isAfter } from 'date-fns';
import { exportToExcel } from '@/lib/excelExport';
import { toast } from 'sonner';
import { useMoney } from '@/hooks/useCurrencySettings';

const COLORS = ['hsl(160, 60%, 38%)', 'hsl(210, 80%, 55%)', 'hsl(45, 90%, 50%)', 'hsl(0, 70%, 55%)'];

export default function Reports() {
  const { fmt: money, code: currencyCode } = useMoney();
  const { data: shopSettings } = useShopSettings();
  const { data: sales } = useSales();
  const { data: expenses } = useExpenses();
  const { data: products } = useProducts();
  const [period, setPeriod] = useState('30');

  const cutoff = startOfDay(subDays(new Date(), parseInt(period)));

  const filteredSales = useMemo(() =>
    (sales || []).filter((s: any) => isAfter(new Date(s.date), cutoff)),
    [sales, cutoff]
  );

  const filteredExpenses = useMemo(() =>
    (expenses || []).filter((e: any) => isAfter(new Date(e.date), cutoff)),
    [expenses, cutoff]
  );

  // Revenue & expenses
  const totalRevenue = filteredSales.reduce((s: number, sale: any) => s + sale.total_amount, 0);
  const totalExpenseAmt = filteredExpenses.reduce((s: number, e: any) => s + e.amount, 0);
  const profit = totalRevenue - totalExpenseAmt;

  // Sales by payment method
  const paymentBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSales.forEach((s: any) => {
      const label = { cash: 'Cash', mpesa: 'M-Pesa', card: 'Card', credit: 'On Debt' }[s.payment_method] || s.payment_method;
      map[label] = (map[label] || 0) + s.total_amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredSales]);

  // Top selling products
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    filteredSales.forEach((sale: any) => {
      (sale.sale_items || []).forEach((item: any) => {
        const name = item.products?.name || 'Unknown';
        if (!map[name]) map[name] = { name, qty: 0, revenue: 0 };
        map[name].qty += item.quantity;
        map[name].revenue += item.subtotal;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredSales]);

  // Daily revenue chart
  const dailyRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSales.forEach((s: any) => {
      const day = format(new Date(s.date), 'dd MMM');
      map[day] = (map[day] || 0) + s.total_amount;
    });
    return Object.entries(map).map(([day, amount]) => ({ day, amount })).slice(-14);
  }, [filteredSales]);

  // Expense by category
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e: any) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredExpenses]);

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Business performance overview</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="flex-1 sm:flex-none sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 h-10 sm:h-9"
            onClick={() => {
              try {
                exportToExcel(`${shopSettings?.shop_name || 'Shop'}_Report`, [
                  {
                    name: 'Summary',
                    rows: [
                      { Metric: 'Period (days)', Value: period },
                      { Metric: `Total Revenue (${currencyCode})`, Value: totalRevenue },
                      { Metric: `Total Expenses (${currencyCode})`, Value: totalExpenseAmt },
                      { Metric: `Profit/Loss (${currencyCode})`, Value: profit },
                      { Metric: 'Sales Count', Value: filteredSales.length },
                      { Metric: 'Expenses Count', Value: filteredExpenses.length },
                      { Metric: 'Products in Inventory', Value: products?.length || 0 },
                    ],
                  },
                  {
                    name: 'Sales',
                    rows: filteredSales.map((s: any) => ({
                      Date: format(new Date(s.date), 'yyyy-MM-dd HH:mm'),
                      Customer: s.customers?.name || 'Walk-in',
                      'Payment Method': s.payment_method,
                      [`Total (${currencyCode})`]: s.total_amount,
                      Items: (s.sale_items || []).map((i: any) => `${i.products?.name} x${i.quantity}`).join(', '),
                    })),
                  },
                  {
                    name: 'Expenses',
                    rows: filteredExpenses.map((e: any) => ({
                      Date: format(new Date(e.date), 'yyyy-MM-dd'),
                      Title: e.title,
                      Category: e.category,
                      [`Amount (${currencyCode})`]: e.amount,
                      Description: e.description || '',
                    })),
                  },
                  {
                    name: 'Products',
                    rows: (products || []).map((p: any) => ({
                      Name: p.name,
                      Category: p.category || '',
                      [`Selling Price (${currencyCode})`]: p.price,
                      [`Cost Price (${currencyCode})`]: p.cost_price,
                      Quantity: p.quantity,
                      'Low Stock Threshold': p.low_stock_threshold,
                      'Expiry Date': p.expiry_date || '',
                      Barcode: p.barcode || '',
                    })),
                  },
                  {
                    name: 'Top Products',
                    rows: topProducts.map((p, i) => ({
                      Rank: i + 1,
                      Product: p.name,
                      'Qty Sold': p.qty,
                      [`Revenue (${currencyCode})`]: p.revenue,
                    })),
                  },
                ]);
                toast.success('Excel file downloaded');
              } catch (e: any) {
                toast.error('Export failed: ' + e.message);
              }
            }}
          >
            <Download size={16} className="mr-1" /> Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Revenue</span>
              <ShoppingCart size={14} className="text-primary" />
            </div>
            <p className="text-lg font-bold text-card-foreground">{money(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">{filteredSales.length} sales</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Expenses</span>
              <Receipt size={14} className="text-destructive" />
            </div>
            <p className="text-lg font-bold text-card-foreground">{money(totalExpenseAmt)}</p>
            <p className="text-xs text-muted-foreground">{filteredExpenses.length} entries</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Profit/Loss</span>
              {profit >= 0 ? <TrendingUp size={14} className="text-success" /> : <TrendingDown size={14} className="text-destructive" />}
            </div>
            <p className={`text-lg font-bold ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>{money(profit)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Products</span>
              <Package size={14} className="text-accent-foreground" />
            </div>
            <p className="text-lg font-bold text-card-foreground">{products?.length || 0}</p>
            <p className="text-xs text-muted-foreground">in inventory</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Revenue Chart */}
      {dailyRevenue.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyRevenue}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => money(value)} />
                <Bar dataKey="amount" fill="hsl(160, 60%, 38%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Payment Method Breakdown */}
        {paymentBreakdown.length > 0 && (
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sales by Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={paymentBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {paymentBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => money(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {paymentBreakdown.map((item, i) => (
                  <div key={item.name} className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-card-foreground">{item.name}</span>
                    </div>
                    <span className="font-medium text-card-foreground">{money(item.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expense Breakdown */}
        {expenseByCategory.length > 0 && (
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => money(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {expenseByCategory.map((item, i) => (
                  <div key={item.name} className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-card-foreground capitalize">{item.name}</span>
                    </div>
                    <span className="font-medium text-card-foreground">{money(item.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top Selling Products */}
      {topProducts.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile: cards */}
            <div className="md:hidden divide-y divide-border">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-muted text-xs font-semibold text-muted-foreground flex items-center justify-center">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-card-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.qty} sold</p>
                  </div>
                  <span className="text-sm font-semibold text-card-foreground shrink-0">{money(p.revenue)}</span>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((p, i) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium text-card-foreground">{p.name}</TableCell>
                    <TableCell className="text-right text-card-foreground">{p.qty}</TableCell>
                    <TableCell className="text-right font-semibold text-card-foreground">{money(p.revenue)}</TableCell>
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
