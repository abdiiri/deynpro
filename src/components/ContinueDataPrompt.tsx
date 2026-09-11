import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CloudDownload, Loader2, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

interface ContinueDataPromptProps {
  open: boolean;
  shopName?: string;
  updatedAt?: string;
  recordCount?: number;
  onContinue: () => Promise<void> | void;
  onStartFresh: () => void;
}

/**
 * Shown right after a successful activation, only when this device is
 * fresh and the shop already has data saved from another device (see
 * snapshotAvailable in lib/license.ts). Lets the person pick up exactly
 * where they left off — e.g. activated on the shop PC this morning, now
 * opening the app on their phone — instead of starting from a blank shop.
 */
export function ContinueDataPrompt({ open, shopName, updatedAt, recordCount, onContinue, onStartFresh }: ContinueDataPromptProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setLoading(true);
    setError(null);
    try {
      await onContinue();
    } catch (e: any) {
      setError(e?.message || 'Could not download the existing data. Check your connection and try again, or start fresh instead.');
      setLoading(false);
    }
  };

  const lastSynced = updatedAt ? format(new Date(updatedAt), 'PPP p') : null;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-1 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <CloudDownload className="text-primary" size={24} />
          </div>
          <DialogTitle className="text-center">Continue where you left off?</DialogTitle>
          <DialogDescription className="text-center">
            We found existing data for <span className="font-medium text-foreground">{shopName || 'your shop'}</span>
            {recordCount != null && <> — {recordCount.toLocaleString()} record{recordCount === 1 ? '' : 's'}</>}
            {lastSynced && <>, last updated {lastSynced}</>}.
            <br />
            Would you like to bring that data to this device, or start with an empty shop here?
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-xs text-center text-destructive">{error}</p>}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full gap-2" onClick={handleContinue} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={16} /> : <CloudDownload size={16} />}
            {loading ? 'Bringing your data over…' : "Continue with this shop's data"}
          </Button>
          <Button variant="outline" className="w-full gap-2" onClick={onStartFresh} disabled={loading}>
            <Sparkles size={16} />
            Start fresh on this device
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
