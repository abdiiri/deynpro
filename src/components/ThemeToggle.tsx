import { useTheme } from 'next-themes';
import { Sun, Moon, Laptop } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface Props {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: Props) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Laptop;
  const size = compact ? 20 : 16;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={compact ? 'ghost' : 'outline'}
          size={compact ? 'icon' : 'sm'}
          className={compact ? 'h-8 w-8 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground' : 'h-9 gap-2'}
          aria-label={t('theme.toggle', 'Toggle theme')}
        >
          <Icon size={size} />
          {!compact && <span className="text-sm capitalize">{theme || 'system'}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')} className="gap-2">
          <Sun size={14} /> {t('theme.light', 'Light')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} className="gap-2">
          <Moon size={14} /> {t('theme.dark', 'Dark')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')} className="gap-2">
          <Laptop size={14} /> {t('theme.system', 'System')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
