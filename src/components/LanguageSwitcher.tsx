import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUPPORTED_LANGUAGES } from '@/i18n';

interface Props {
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: Props) {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage || i18n.language || 'en';

  return (
    <Select value={current} onValueChange={(v) => i18n.changeLanguage(v)}>
      <SelectTrigger className={compact ? 'h-8 w-auto gap-1 px-2 text-xs' : 'h-9 w-auto gap-1 px-2 text-sm'} aria-label="Language">
        <Globe size={compact ? 12 : 14} className="text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {SUPPORTED_LANGUAGES.map(l => (
          <SelectItem key={l.code} value={l.code}>
            <span className="font-medium">{l.native}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
