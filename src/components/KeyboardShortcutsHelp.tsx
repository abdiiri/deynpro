import { shortcuts } from '@/hooks/useKeyboardShortcuts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard size={18} />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {shortcuts.map(s => (
            <div key={s.key} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50">
              <kbd className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-muted text-sm font-mono font-semibold text-foreground">
                {s.key}
              </kbd>
              <span className="text-sm text-muted-foreground">{s.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50">
            <kbd className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-muted text-sm font-mono font-semibold text-foreground">
              ?
            </kbd>
            <span className="text-sm text-muted-foreground">This help</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
