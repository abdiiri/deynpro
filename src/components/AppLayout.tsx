import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { LayoutDashboard, Users, ArrowLeftRight, Menu, X, Package, Truck, ShoppingCart, Receipt, Bell, BarChart3, FileText, Settings as SettingsIcon, PackagePlus, Moon, Wifi, WifiOff, RefreshCw, Server, Globe, Mail, MessageCircle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShopSettings } from '@/hooks/useShopSettings';
import { useStockAlerts } from '@/hooks/useStockAlerts';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MenuBar } from '@/components/MenuBar';

export function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { showHelp, setShowHelp } = useKeyboardShortcuts();
  const { data: shopSettings } = useShopSettings();
  const appName = shopSettings?.shop_name || t('app.name');
  const { data: alerts } = useStockAlerts();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sync = useSyncStatus();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/products', icon: Package, label: t('nav.products') },
    { to: '/sales', icon: ShoppingCart, label: t('nav.sales') },
    { to: '/customers', icon: Users, label: t('nav.customers') },
    { to: '/transactions', icon: ArrowLeftRight, label: t('nav.debts') },
    { to: '/suppliers', icon: Truck, label: t('nav.suppliers') },
    { to: '/expenses', icon: Receipt, label: t('nav.expenses') },
    { to: '/invoices', icon: FileText, label: t('nav.invoices') },
    { to: '/reports', icon: BarChart3, label: t('nav.reports') },
    { to: '/ar-aging', icon: Clock, label: t('nav.arAging') },
    { to: '/notifications', icon: Bell, label: t('nav.notifications') },
    { to: '/stock-receiving', icon: PackagePlus, label: t('nav.stockIn') },
    { to: '/end-of-day', icon: Moon, label: t('nav.endOfDay') },
    { to: '/settings', icon: SettingsIcon, label: t('nav.settings') },
  ];

  const unreadAlerts = alerts?.length || 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Menu Bar - Desktop only */}
      <MenuBar />
      
      {/* Mobile header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 gradient-primary md:hidden">
        <h1 className="text-lg font-bold text-primary-foreground tracking-tight">{appName}</h1>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <ThemeToggle compact />
          <Link to="/notifications" className="relative text-primary-foreground">
            <Bell size={20} />
            {unreadAlerts > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {unreadAlerts}
              </span>
            )}
          </Link>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-primary-foreground">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-foreground/20" />
          <nav className="absolute start-0 top-0 bottom-0 w-64 bg-card p-6 shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-primary mb-6">{appName}</h2>
            <div className="space-y-1">
              {navItems.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === item.to
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <item.icon size={18} />
                  <span className="flex-1">{item.label}</span>
                  {item.to === '/notifications' && unreadAlerts > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {unreadAlerts}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      )}

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-56 lg:w-64 flex-col fixed inset-y-0 start-0 bg-card border-e border-border z-30">
          <div className="p-6 pb-4">
            <h1 className="text-2xl font-bold text-primary tracking-tight">{appName}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{t('app.tagline')}</p>
          </div>
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.to
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <item.icon size={18} />
                <span className="flex-1">{item.label}</span>
                {item.to === '/notifications' && unreadAlerts > 0 && (
                  <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadAlerts}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="p-3 space-y-2">
            <div className="px-1">
              <LanguageSwitcher />
            </div>
            <div className="px-1">
              <ThemeToggle />
            </div>

          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 md:ms-56 lg:ms-64 min-h-screen">
          <div className="p-4 md:p-6 lg:p-8 pb-14 max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav - top 5 items */}
      <nav className="fixed bottom-0 start-0 end-0 z-50 bg-card border-t border-border flex md:hidden">
        {navItems.slice(0, 5).map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
              location.pathname === item.to ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <item.icon size={20} />
            {item.label}
          </Link>
        ))}
      </nav>
      {/* Support ticker — desktop only */}
      <div className="hidden md:block fixed bottom-0 left-56 lg:left-64 right-0 z-20 bg-[hsl(142,60%,32%)] py-3 overflow-hidden">
        <style>{`
          @keyframes ticker {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .ticker-track {
            display: flex;
            width: max-content;
            animation: ticker 22s linear infinite;
          }
          .ticker-track:hover { animation-play-state: paused; }
        `}</style>
        <div className="ticker-track">
          {[0, 1].map(i => (
            <div key={i} className="flex items-center gap-10 px-8 text-white text-sm font-medium whitespace-nowrap select-none">
              <a href="https://www.abmamediahub.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white/80 transition-colors">
                <Globe size={15} /> www.abmamediahub.com
              </a>
              <span className="opacity-40">•</span>
              <a href="mailto:abmahub5@gmail.com"
                className="flex items-center gap-2 hover:text-white/80 transition-colors">
                <Mail size={15} /> abmahub5@gmail.com
              </a>
              <span className="opacity-40">•</span>
              <a href="https://wa.me/254722474205" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white/80 transition-colors">
                <MessageCircle size={15} /> +254 722 474 205
              </a>
              <span className="opacity-40 mx-6">❖</span>
            </div>
          ))}
        </div>
      </div>
      <KeyboardShortcutsHelp open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
}
