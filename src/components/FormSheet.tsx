import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useKeyboardBox } from '@/hooks/useVisualViewport';
import { cn } from '@/lib/utils';

/** Shared input sizing: 44px tall and 16px text so iOS doesn't zoom on focus. */
export const formInputClass = 'h-11 text-base';

/** A visible label above a control. Use instead of placeholder-only fields. */
export function FormField({
  label, htmlFor, hint, className, children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: () => void;
  submitLabel: string;
  isPending?: boolean;
  /** Optional destructive action shown at the bottom of the body (edit mode). */
  onDelete?: () => void;
  deleteLabel?: string;
  children: React.ReactNode;
}

/**
 * One form container for Customers, Suppliers, Expenses and Customer Details.
 * Mobile: bottom sheet. Desktop: centred dialog. Same body and sticky footer in both.
 * Children are the fields; wrap each in <FormField>.
 */
export function FormSheet({
  open, onOpenChange, title, description, onSubmit, submitLabel, isPending,
  onDelete, deleteLabel, children,
}: FormSheetProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  // While the keyboard is up, lift the sheet above it so the Save button stays reachable.
  const kb = useKeyboardBox(open && isMobile);

  const form = (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(); }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {children}
        {onDelete && (
          <Button type="button" variant="destructive" className="h-11 w-full" onClick={onDelete}>
            {deleteLabel || t('common.delete', 'Delete')}
          </Button>
        )}
      </div>
      <div className="flex shrink-0 gap-2 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="h-11 flex-1 gradient-primary border-0" disabled={isPending}>
          {isPending ? t('common.saving', 'Saving...') : submitLabel}
        </Button>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[92dvh] flex-col gap-0 rounded-t-2xl p-0"
          style={kb ? { bottom: kb.bottomInset, maxHeight: kb.height - 8 } : undefined}
        >
          <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pe-12 text-start">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="sr-only">{description || title}</SheetDescription>
          </SheetHeader>
          {open && form}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pe-12 text-start">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{description || title}</DialogDescription>
        </DialogHeader>
        {open && form}
      </DialogContent>
    </Dialog>
  );
}
