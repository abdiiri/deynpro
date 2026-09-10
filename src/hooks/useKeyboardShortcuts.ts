import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const shortcuts = [
  { key: 'D', label: 'Dashboard', route: '/' },
  { key: 'I', label: 'Invoices', route: '/invoices' },
  { key: 'S', label: 'Sales', route: '/sales' },
  { key: 'P', label: 'Products', route: '/products' },
  { key: 'C', label: 'Customers', route: '/customers' },
  { key: 'E', label: 'Expenses', route: '/expenses' },
  { key: 'R', label: 'Reports', route: '/reports' },
  { key: 'T', label: 'Debts', route: '/transactions' },
  { key: 'U', label: 'Suppliers', route: '/suppliers' },
];

const shortcutMap: Record<string, string> = {};
shortcuts.forEach(s => { shortcutMap[s.key.toLowerCase()] = s.route; });

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  const toggleHelp = useCallback(() => setShowHelp(prev => !prev), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === '?') {
        e.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }

      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false);
        return;
      }

      const route = shortcutMap[e.key.toLowerCase()];
      if (route) {
        e.preventDefault();
        setShowHelp(false);
        navigate(route);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, showHelp]);

  return { showHelp, setShowHelp, toggleHelp };
}
