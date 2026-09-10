import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { PinLock } from "@/components/PinLock";
import { LicenseGate } from "@/components/LicenseGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useState, useEffect } from "react";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import CustomerDetails from "@/pages/CustomerDetails";
import Transactions from "@/pages/Transactions";
import Products from "@/pages/Products";
import { useAutoBackup } from '@/hooks/useAutoBackup';
import Suppliers from "@/pages/Suppliers";
import Sales from "@/pages/Sales";
import Expenses from "@/pages/Expenses";
import Reports from "@/pages/Reports";
import Invoices from "@/pages/Invoices";
import Settings from "@/pages/Settings";
import StockReceiving from "@/pages/StockReceiving";
import Notifications from "@/pages/Notifications";
import EndOfDay from "@/pages/EndOfDay";
import ReorderList from "@/pages/ReorderList";
import ARAging from "@/pages/ARAging";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Separate inner component so useAutoBackup runs inside QueryClientProvider
function AppInner() {
  useAutoBackup();

  // PIN lock — only active in Electron when enabled
  const [pinChecked, setPinChecked] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!(window as any).electronPin) { setPinChecked(true); return; }
    (window as any).electronPin.getStatus().then((status: { enabled: boolean; hasPin: boolean }) => {
      if (status.enabled && status.hasPin) setLocked(true);
      setPinChecked(true);
    });
  }, []);

  if (!pinChecked) return null;

  return (
    <LicenseGate>
      {locked ? (
        <PinLock onUnlock={() => setLocked(false)} />
      ) : (
        <HashRouter>
          <ErrorBoundary>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerDetails />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/products" element={<Products />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/ar-aging" element={<ARAging />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/stock-receiving" element={<StockReceiving />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/end-of-day" element={<EndOfDay />} />
                <Route path="/reorder-list" element={<ReorderList />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </ErrorBoundary>
        </HashRouter>
      )}
    </LicenseGate>
  );
}

const App = () => {
  return (
<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="deynpro-theme">      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppInner />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;