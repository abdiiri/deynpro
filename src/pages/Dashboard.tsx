import { useTranslation } from 'react-i18next';
import { useDashboardStats } from '@/hooks/useCustomers';
import { useLowStockProducts, useProducts } from '@/hooks/useProducts';
import { BackupPanel } from '@/components/BackupPanel';
import { useSales } from '@/hooks/useSales';
import { useExpenses } from '@/hooks/useExpenses';
import { useStockAlerts, useMarkAlertRead, useMarkAllAlertsRead } from '@/hooks/useStockAlerts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Users, AlertTriangle, Package, ShoppingCart, Receipt, Bell, X, CheckCheck, MessageCircle, Calendar, Target, Snail, BarChart2 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, Legend } from 'recharts';
import { format, isPast, parseISO, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAllTransactions } from '@/hooks/useCustomers';
import { useCurrencySettings, formatCurrency } from '@/hooks/useCurrencySettings';
import { useDailySalesTarget } from '@/hooks/useDailySalesTarget';

function formatPhone(phone: string) {
  let clean = phone.replace(/\s+/g, '');
  if (clean.startsWith('0')) clean = '254' + clean.slice(1);
  if (!clean.startsWith('+')) clean = '+' + clean;
  return clean.replace('+', '');
}

function openWhatsApp(phone: string, message: string) {
  const num = formatPhone(phone);
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, '_blank');
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: currencyData } = useCurrencySettings();
  const formatKES = (amount: number) => formatCurrency(amount, currencyData?.base_currency || 'KES');

  const { data: stats, isLoading } = useDashboardStats();
  const { data: lowStockProducts } = useLowStockProducts();
  const { data: sales } = useSales();
  const { data: expenses } = useExpenses();
  const { data: alerts } = useStockAlerts();
  const markRead = useMarkAlertRead();
  const markAllRead = useMarkAllAlertsRead();
  const { data: allTransactions } = useAllTransactions();
  const { data: dailyTarget } = useDailySalesTarget();
  const { data: products } = useProducts();

  const overdueDebts = (allTransactions || []).filter(
    (tx: any) => tx.type === 'debt' && tx.due_date && isPast(parseISO(tx.due_date))
  );

  const totalSalesRevenue = (sales || []).reduce((s, sale: any) => s + sale.total_amount, 0);
  const totalExpenses = (expenses || []).reduce((s, e: any) => s + e.amount, 0);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const monthPrefix = format(today, 'yyyy-MM');

  // Convert a sale's stored date (UTC ISO string) to local YYYY-MM-DD for comparison
  function localDateStr(isoDate: string): string {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    return format(d, 'yyyy-MM-dd'); // date-fns uses local timezone
  }

  function itemProfit(item: any): number {
    const sp = item.unit_price || 0;
    const packCost = item.cost_price || 0;
    const ppp = item.pieces_per_pack || 0;
    // piece_mode is stored as integer 0/1 in SQLite
    const isPiece = item.piece_mode === 1 || item.piece_mode === true;
    const bp = isPiece && ppp > 0 ? packCost / ppp : packCost;
    return (sp - bp) * (item.quantity || 0);
  }

  function salesProfit(salesList: any[]): number {
    return salesList.reduce((total: number, sale: any) =>
      total + (sale.items || []).reduce((s: number, item: any) => s + itemProfit(item), 0), 0);
  }

  const todaySales = (sales || []).filter((s: any) => localDateStr(s.date) === todayStr);
  const todayRevenue = todaySales.reduce((s: number, sale: any) => s + sale.total_amount, 0);
  const todayProfit = salesProfit(todaySales);

  const monthlySales = (sales || []).filter((s: any) => localDateStr(s.date).slice(0, 7) === monthPrefix);
  const monthlyRevenue = monthlySales.reduce((s: number, sale: any) => s + sale.total_amount, 0);
  const monthlyProfit = salesProfit(monthlySales);

  const expiringItems = (products || []).filter((p: any) => {
    if (!p.expiry_date) return false;
    const expiry = new Date(p.expiry_date);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  });

  // ── Daily Sales Target ──────────────────────────────────────────────────
  const target = dailyTarget || 0;
  const targetPct = target > 0 ? Math.min(100, Math.round((todayRevenue / target) * 100)) : 0;
  const targetReached = target > 0 && todayRevenue >= target;
  const targetColor =
    targetPct >= 100 ? 'bg-success' :
    targetPct >= 70  ? 'bg-primary' :
    targetPct >= 40  ? 'bg-warning' :
    'bg-destructive';
  const targetTextColor =
    targetPct >= 100 ? 'text-success' :
    targetPct >= 70  ? 'text-primary' :
    targetPct >= 40  ? 'text-warning' :
    'text-destructive';
  const targetEmoji =
    targetPct >= 100 ? '🎉' :
    targetPct >= 70  ? '🔥' :
    targetPct >= 40  ? '📈' :
    '💪';

  // ── Best-Selling Products (last 30 days) ─────────────────────────────
  const thirtyDaysAgo = subDays(today, 30);
  const recentSales = (sales || []).filter((s: any) => new Date(s.date) >= thirtyDaysAgo);
  const productRevMap: Record<string, { name: string; revenue: number; qty: number }> = {};
  recentSales.forEach((sale: any) => {
    (sale.items || []).forEach((item: any) => {
      const name = item.products?.name || item.product_id;
      if (!productRevMap[item.product_id]) productRevMap[item.product_id] = { name, revenue: 0, qty: 0 };
      productRevMap[item.product_id].revenue += item.unit_price * item.quantity;
      productRevMap[item.product_id].qty += item.quantity;
    });
  });
  const bestSellers = Object.values(productRevMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const chartColors = [
    'hsl(160, 60%, 38%)',
    'hsl(210, 80%, 55%)',
    'hsl(45, 90%, 50%)',
    'hsl(270, 60%, 55%)',
    'hsl(0, 60%, 55%)',
  ];

  // ── Slow-Moving Stock (not sold in 30 days, has stock > 0) ───────────
  const soldProductIds = new Set(recentSales.flatMap((s: any) => (s.items || []).map((i: any) => i.product_id)));
  const slowMoving = (products || [])
    .filter((p: any) => p.quantity > 0 && !soldProductIds.has(p.id))
    .sort((a: any, b: any) => b.quantity - a.quantity)
    .slice(0, 5);

  // ── 30-day daily profit + expense trend ───────────────────────────────
  const profitTrendData = (() => {
    const days: Record<string, { day: string; profit: number; expenses: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const label = format(d, 'dd MMM');
      days[key] = { day: label, profit: 0, expenses: 0 };
    }
    (sales || []).forEach((sale: any) => {
      const key = localDateStr(sale.date);
      if (!days[key]) return;
      const saleProfit = (sale.items || []).reduce((s: number, item: any) => s + itemProfit(item), 0);
      days[key].profit += saleProfit;
    });
    (expenses || []).forEach((e: any) => {
      const key = localDateStr(e.date);
      if (!days[key]) return;
      days[key].expenses += e.amount;
    });
    return Object.values(days);
  })();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  const cards = [
    { label: t('dashboard.todaySales'), value: formatKES(todayRevenue), icon: ShoppingCart, color: 'text-primary' },
    { label: t('dashboard.todayProfit'), value: formatKES(todayProfit), icon: TrendingUp, color: 'text-success' },
    { label: t('dashboard.monthlyRevenue'), value: formatKES(monthlyRevenue), icon: Receipt, color: 'text-primary' },
    { label: t('dashboard.monthlyProfit'), value: formatKES(monthlyProfit), icon: TrendingUp, color: 'text-success' },
    { label: t('dashboard.totalRevenue'), value: formatKES(totalSalesRevenue), icon: TrendingUp, color: 'text-success' },
    { label: t('dashboard.totalExpenses'), value: formatKES(totalExpenses), icon: Receipt, color: 'text-destructive' },
    { label: t('dashboard.customers'), value: stats?.customerCount || 0, icon: Users, color: 'text-accent' },
    { label: t('dashboard.outstandingDebt'), value: formatKES(stats?.totalDebt || 0), icon: TrendingDown, color: 'text-warning' },
    { label: t('dashboard.lowStockItems'), value: lowStockProducts?.length || 0, icon: AlertTriangle, color: 'text-destructive' },
    { label: t('dashboard.expiringItems'), value: expiringItems?.length || 0, icon: Calendar, color: 'text-warning' },
  ];

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('dashboard.overview')}</p>
      </div>

      {(alerts?.length || 0) > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-warning">
                <Bell size={16} /> {t('dashboard.stockAlerts')} ({alerts!.length})
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => markAllRead.mutate()}>
                <CheckCheck size={14} className="me-1" /> {t('dashboard.markAllRead')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts!.slice(0, 5).map(alert => (
              <div key={alert.id} className="flex items-center justify-between text-sm">
                <span className="text-card-foreground">{alert.message}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => markRead.mutate(alert.id)}>
                  <X size={12} />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Daily Sales Target ─────────────────────────────────────────── */}
      {target > 0 ? (
        <Card className={`shadow-card border ${targetReached ? 'border-success/40 bg-success/5' : 'border-border'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target size={16} className={targetTextColor} />
                <span className="text-sm font-semibold text-card-foreground">
                  Daily Sales Target {targetEmoji}
                </span>
              </div>
              <span className={`text-sm font-bold ${targetTextColor}`}>{targetPct}%</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${targetColor}`}
                style={{ width: `${targetPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">{formatKES(todayRevenue)} earned today</span>
              <span className="text-xs text-muted-foreground">
                {targetReached ? '🎉 Target reached!' : `${formatKES(Math.max(0, target - todayRevenue))} to go`}
              </span>
            </div>
            {!targetReached && (
              <p className="text-[11px] text-muted-foreground/60 mt-1 text-right">Goal: {formatKES(target)}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Link to="/settings">
          <Card className="shadow-card border border-dashed border-primary/30 hover:border-primary/60 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Target size={18} className="text-primary/50" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Set a daily sales target</p>
                  <p className="text-xs text-muted-foreground/60">Track your progress every day → Settings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(card => (
          <Card key={card.label} className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                <card.icon size={16} className={card.color} />
              </div>
              <p className="text-lg font-bold text-card-foreground break-words">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t('dashboard.netProfitLoss')}</p>
              <p className={`text-2xl font-bold ${totalSalesRevenue - totalExpenses >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatKES(totalSalesRevenue - totalExpenses)}
              </p>
            </div>
            <div className="text-end">
              <p className="text-xs text-muted-foreground">{t('dashboard.revenueMinusExpenses')}</p>
              <p className="text-xs text-muted-foreground">{formatKES(totalSalesRevenue)} - {formatKES(totalExpenses)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {(stats?.chartData?.length || 0) > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.monthlyPayments')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats!.chartData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => formatKES(value)} />
                <Bar dataKey="amount" fill="hsl(160, 60%, 38%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── 30-day Profit vs Expenses Trend ──────────────────────────── */}
      {profitTrendData.some(d => d.profit > 0 || d.expenses > 0) && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp size={16} className="text-success" /> Profit vs Expenses — Last 30 Days
              </CardTitle>
              <Link to="/reports" className="text-xs text-primary hover:underline">Full report</Link>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={profitTrendData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  interval={4}
                />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `KES ${value.toLocaleString()}`,
                    name === 'profit' ? 'Profit' : 'Expenses'
                  ]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => value === 'profit' ? 'Profit' : 'Expenses'}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="hsl(160, 60%, 38%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="hsl(0, 65%, 55%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Best-Selling Products (last 30 days) ─────────────────────── */}
      {bestSellers.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart2 size={16} className="text-primary" /> Top 5 Products — Last 30 Days
              </CardTitle>
              <Link to="/reports" className="text-xs text-primary hover:underline">Full report</Link>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={bestSellers} layout="vertical" margin={{ left: 0, right: 8 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => String(Math.round(v).toLocaleString())} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip formatter={(value: number) => formatKES(value)} />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                  {bestSellers.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1.5 border-t border-border pt-3">
              {bestSellers.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: chartColors[i % chartColors.length] }} />
                    <span className="text-card-foreground font-medium truncate max-w-[140px]">{p.name}</span>
                  </div>
                  <div className="flex gap-3 text-muted-foreground shrink-0">
                    <span>{p.qty} units</span>
                    <span className="font-semibold text-card-foreground">{formatKES(p.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Slow-Moving Stock ─────────────────────────────────────────── */}
      {slowMoving.length > 0 && (
        <Card className="shadow-card border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Snail size={16} /> Slow-Moving Stock
              </CardTitle>
              <Link to="/reorder-list" className="text-xs text-primary hover:underline">View reorder list</Link>
            </div>
            <p className="text-xs text-muted-foreground">These products haven't sold in 30+ days</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {slowMoving.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <Package size={13} className="text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{p.name}</p>
                    {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">{p.quantity} in stock</p>
                  <p className="text-xs text-muted-foreground">0 sold / 30d</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {overdueDebts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle size={16} /> {t('dashboard.overdueDebts')} ({overdueDebts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueDebts.slice(0, 5).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{tx.customers?.name || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatKES(tx.amount)} · {t('dashboard.due')}: {format(new Date(tx.due_date), 'MMM d, yyyy')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs border-[hsl(142,70%,45%)] text-[hsl(142,70%,45%)]"
                  onClick={() => {
                    if (tx.customers?.phone) {
                      const dueClause = t('whatsapp.dueClause', { date: format(new Date(tx.due_date), 'MMM d, yyyy') });
                      const msg = t('whatsapp.debtReminder', {
                        name: tx.customers.name,
                        amount: tx.amount.toLocaleString(),
                        dueClause,
                      });
                      openWhatsApp(tx.customers.phone, msg);
                    }
                  }}
                >
                  <MessageCircle size={14} /> {t('dashboard.remind')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar size={16} className="text-warning" /> {t('dashboard.expiringItems')} ({expiringItems?.length || 0})
              </CardTitle>
              <Link to="/products" className="text-xs text-primary hover:underline">{t('dashboard.viewAll')}</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(expiringItems?.length || 0) === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('dashboard.allFresh')}</p>
            )}
            {expiringItems?.slice(0, 5).map((p: any) => {
              const daysLeft = Math.ceil((new Date(p.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className={daysLeft <= 7 ? 'text-destructive' : 'text-warning'} />
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(p.expiry_date), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${daysLeft <= 7 ? 'text-destructive' : 'text-warning'}`}>
                    {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.lowStockProducts')}</CardTitle>
              <Link to="/reorder-list" className="text-xs text-primary hover:underline">Reorder list</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(lowStockProducts?.length || 0) === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('dashboard.allStocked')}</p>
            )}
            {lowStockProducts?.slice(0, 5).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-warning" />
                  <p className="text-sm font-medium text-card-foreground">{p.name}</p>
                </div>
                <span className={`text-sm font-semibold ${p.quantity === 0 ? 'text-destructive' : 'text-warning'}`}>
                  {t('dashboard.leftInStock', { count: p.quantity })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.outstandingDebts')}</CardTitle>
            <Link to="/transactions" className="text-xs text-primary hover:underline">{t('dashboard.viewAll')}</Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(stats?.overdueCustomers?.length || 0) === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('dashboard.noOutstanding')}</p>
          )}
          {stats?.overdueCustomers?.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-card-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.phone}</p>
              </div>
              <span className="text-sm font-semibold text-destructive">{formatKES(c.balance)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.quickActions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Link to="/sales">
              <Button variant="outline" className="w-full gap-2"><ShoppingCart size={16} /> {t('dashboard.newSale')}</Button>
            </Link>
            <Link to="/products">
              <Button variant="outline" className="w-full gap-2"><Package size={16} /> {t('dashboard.addProduct')}</Button>
            </Link>
            <Link to="/customers">
              <Button variant="outline" className="w-full gap-2"><Users size={16} /> {t('dashboard.addCustomer')}</Button>
            </Link>
            <Link to="/expenses">
              <Button variant="outline" className="w-full gap-2"><Receipt size={16} /> {t('dashboard.addExpense')}</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      <BackupPanel />
    </div>
  );
}
