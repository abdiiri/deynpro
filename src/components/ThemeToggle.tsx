import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface Props {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: Props) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const isDark = theme === 'dark';
  const size = compact ? 20 : 16;

  return (
    <Button
      variant={compact ? 'ghost' : 'outline'}
      size={compact ? 'icon' : 'sm'}
      className={compact ? 'h-8 w-8 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground' : 'h-9 gap-2'}
      aria-label={t('theme.toggle', 'Toggle theme')}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Moon size={size} /> : <Sun size={size} />}
      {!compact && <span className="text-sm">{isDark ? t('theme.dark', 'Dark') : t('theme.light', 'Light')}</span>}
    </Button>
  );
}