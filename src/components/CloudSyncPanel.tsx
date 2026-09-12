import { useEffect, useState } from 'react';
import { checkCloudSnapshot, pushCloudSnapshot, type CloudSnapshotInfo } from '@/lib/license';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

/**
 * Manual cloud sync control, for the common real-world case
 * ContinueDataPrompt.tsx's automatic flow doesn't cover: two (or more)
 * devices that are BOTH already in use, and the person wants this one to
 * catch up with whatever another device added (e.g. "I added a product
 * on my phone, why doesn't my PC show it yet?").
 *
 * Safe to press any time, on any device, in any order: this reconciles
 * this device's data with the cloud record-by-record — keeping whichever
 * side has the newer change per record — rather than replacing one side
 * wholesale. Nothing gets erased just because another device hasn't
 * synced recently, no matter how many devices are in use.
 */
export function CloudSyncPanel() {
  const [info, setInfo] = useState<CloudSnapshotInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const refreshInfo = () => {
    setLoadingInfo(true);
    checkCloudSnapshot()
      .then(setInfo)
      .finally(() => setLoadingInfo(false));
  };

  useEffect(() => {
    refreshInfo();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const result = await pushCloudSnapshot();
    setSyncing(false);
    if (result.ok) {
      toast.success("Synced — this device and the cloud now match");
      refreshInfo();
    } else {
      toast.error(result.error || 'Could not sync right now — check your connection.');
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCw size={18} className="text-primary" /> Cloud Data Sync
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          If this shop's code is used on more than one device, this brings them in sync — anything
          new on this device or any other device is combined, nothing is deleted or overwritten.
        </p>

        <div className="text-sm">
          {loadingInfo ? (
            <span className="text-muted-foreground">Checking cloud status…</span>
          ) : info?.exists ? (
            <span className="text-muted-foreground">
              Last synced {info.updatedAt ? format(new Date(info.updatedAt), 'PPP p') : 'recently'}
              {info.recordCount != null && <> · {info.recordCount.toLocaleString()} records</>}
            </span>
          ) : (
            <span className="text-muted-foreground">No cloud copy saved yet.</span>
          )}
        </div>

        <Button size="sm" variant="outline" className="gap-2" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          {syncing ? 'Syncing…' : 'Sync now'}
        </Button>
      </CardContent>
    </Card>
  );
}
