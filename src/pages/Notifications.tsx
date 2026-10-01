import { useState, useMemo } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bell, PackageX, AlertTriangle, CalendarClock, Search } from 'lucide-react';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';

type NotifType = 'out_of_stock' | 'low_stock' | 'expiring_soon' | 'expired';

interface Notif {
  id: string;
  type: NotifType;
  productId: string;
  productName: string;
  category: string | null;
  quantity: number;
  threshold: number;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
}

const TYPE_META: Record<NotifType, { label: string; icon: any; badgeClass: string; rowClass: string }> = {
  out_of_stock:  { label: 'Out of Stock',   icon: PackageX,      badgeClass: 'bg-destructive/10 text-destructive border-destructive/30',       rowClass: 'border-l-4 border-l-destructive' },
  low_stock:     { label: 'Low Stock',      icon: AlertTriangle, badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',                     rowClass: 'border-l-4 border-l-amber-400' },
  expired:       { label: 'Expired',        icon: CalendarClock, badgeClass: 'bg-destructive/10 text-destructive border-destructive/30',         rowClass: 'border-l-4 border-l-destructive' },
  expiring_soon: { label: 'Expiring Soon',  icon: CalendarClock, badgeClass: 'bg-orange-50 text-orange-700 border-orange-300',                  rowClass: 'border-l-4 border-l-orange-400' },
};

export default function Notifications() {
  const { data: products } = useProducts();
  const [typeFilter, setTypeFilter] = useState<'all' | NotifType>('all');
  const [search, setSearch] = useState('');

  const notifications = useMemo<Notif[]>(() => {
    if (!products) return [];
    const list: Notif[] = [];

    products.forEach(p => {
      // Stock alerts
      if (p.quantity === 0) {
        list.push({ id: `oos-${p.id}`, type: 'out_of_stock', productId: p.id, productName: p.name, category: p.category, quantity: p.quantity, threshold: p.low_stock_threshold, expiryDate: null, daysUntilExpiry: null });
      } else if (p.quantity <= p.low_stock_threshold) {
        list.push({ id: `low-${p.id}`, type: 'low_stock', productId: p.id, productName: p.name, category: p.category, quantity: p.quantity, threshold: p.low_stock_threshold, expiryDate: null, daysUntilExpiry: null });
      }

      // Expiry alerts (within 30 days or already expired)
      if (p.expiry_date) {
        try {
          const exp = parseISO(p.expiry_date);
          if (!isValid(exp)) return;
          const days = differenceInDays(exp, new Date());
          if (days < 0) {
            list.push({ id: `exp-${p.id}`, type: 'expired', productId: p.id, productName: p.name, category: p.category, quantity: p.quantity, threshold: p.low_stock_threshold, expiryDate: p.expiry_date, daysUntilExpiry: days });
          } else if (days <= 30) {
            list.push({ id: `soon-${p.id}`, type: 'expiring_soon', productId: p.id, productName: p.name, category: p.category, quantity: p.quantity, threshold: p.low_stock_threshold, expiryDate: p.expiry_date, daysUntilExpiry: days });
          }
        } catch (_) {}
      }
    });

    // Sort: expired first, then out_of_stock, low_stock, expiring_soon
    const order: NotifType[] = ['expired', 'out_of_stock', 'low_stock', 'expiring_soon'];
    return list.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }, [products]);

  const filtered = useMemo(() => notifications.filter(n => {
    const matchesType = typeFilter === 'all' || n.type === typeFilter;
    const matchesSearch = n.productName.toLowerCase().includes(search.toLowerCase()) ||
      (n.category || '').toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  }), [notifications, typeFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: notifications.length };
    notifications.forEach(n => { c[n.type] = (c[n.type] || 0) + 1; });
    return c;
  }, [notifications]);

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell size={22} /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {notifications.length === 0 ? 'All products are healthy' : `${notifications.length} alert${notifications.length !== 1 ? 's' : ''} require attention`}
          </p>
        </div>
        {notifications.length > 0 && (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-destructive text-destructive-foreground text-sm font-bold">
            {notifications.length}
          </span>
        )}
      </div>

      {/* Summary chips */}
      {notifications.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(['all', 'out_of_stock', 'low_stock', 'expired', 'expiring_soon'] as const).map(key => {
            const count = counts[key] || 0;
            if (key !== 'all' && !count) return null;
            const meta = key === 'all' ? null : TYPE_META[key];
            return (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  typeFilter === key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {meta && <meta.icon size={11} />}
                {key === 'all' ? 'All' : meta!.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${typeFilter === key ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search */}
      {notifications.length > 0 && (
        <div className="relative max-w-xs">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search product…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-9 h-9 text-sm"
          />
        </div>
      )}

      {/* Empty state */}
      {notifications.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <Bell size={24} className="text-emerald-500" />
            </div>
            <p className="font-semibold text-foreground">All clear!</p>
            <p className="text-sm text-muted-foreground mt-1">No stock or expiry alerts at the moment.</p>
          </CardContent>
        </Card>
      )}

      {/* Notification cards */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(n => {
            const meta = TYPE_META[n.type];
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                className={`flex items-start justify-between gap-3 bg-card rounded-lg border border-border px-4 py-3 ${meta.rowClass}`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                    n.type === 'out_of_stock' || n.type === 'expired' ? 'bg-destructive/10' :
                    n.type === 'low_stock' ? 'bg-amber-50' : 'bg-orange-50'
                  }`}>
                    <Icon size={13} className={
                      n.type === 'out_of_stock' || n.type === 'expired' ? 'text-destructive' :
                      n.type === 'low_stock' ? 'text-amber-600' : 'text-orange-600'
                    } />
                  </div>

                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground leading-tight truncate">{n.productName}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {n.category && (
                        <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{n.category}</span>
                      )}
                      {/* Stock message */}
                      {(n.type === 'out_of_stock' || n.type === 'low_stock') && (
                        <span className="text-xs text-muted-foreground">
                          {n.type === 'out_of_stock'
                            ? 'No stock remaining'
                            : `${n.quantity} left — threshold: ${n.threshold}`}
                        </span>
                      )}
                      {/* Expiry message */}
                      {n.expiryDate && (
                        <span className="text-xs text-muted-foreground">
                          {n.type === 'expired'
                            ? `Expired ${Math.abs(n.daysUntilExpiry!)} day${Math.abs(n.daysUntilExpiry!) !== 1 ? 's' : ''} ago`
                            : `Expires in ${n.daysUntilExpiry} day${n.daysUntilExpiry !== 1 ? 's' : ''}`}
                          {' · '}
                          {format(parseISO(n.expiryDate), 'dd MMM yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Badge className={`flex-shrink-0 text-[10px] px-2 py-0.5 border ${meta.badgeClass}`}>
                  {meta.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && notifications.length > 0 && (
        <p className="text-center text-muted-foreground py-8 text-sm">No notifications match your filter.</p>
      )}
    </div>
  );
}
