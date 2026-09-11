import { useEffect, useState } from 'react';
import { checkCloudSnapshot, pullCloudSnapshot, pushCloudSnapshot, type CloudSnapshotInfo } from '@/lib/license';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CloudUpload, CloudDownload, RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

/**
 * Manual cloud sync control, for the common real-world case in
 * ContinueDataPrompt.tsx's automatic flow doesn't cover: two devices
 * that are BOTH already in use, and the person wants this one to catch
 * up with whatever the other device has (e.g. "I added a product on my
 * phone, why doesn't my PC show it?").
 *
 * This is deliberately manual, not automatic — pulling always overwrites
 * whatever is on THIS device, so it should only happen when the person
 * explicitly asks for it.
 */
export function CloudSyncPanel() {
  const [info, setInfo] = useState<CloudSnapshotInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [confirmPullOpen, setConfirmPullOpen] = useState(false);

  const refreshInfo = () => {
    setLoadingInfo(true);
    checkCloudSnapshot()
      .then(setInfo)
      .finally(() => setLoadingInfo(false));
  };

  useEffect(() => {
    refreshInfo();
  }, []);

  const handlePush = async () => {
    setPushing(true);
    const result = await pushCloudSnapshot();
    setPushing(false);
    if (result.ok) {
      toast.success('This device\'s data was sent to the cloud');
      refreshInfo();
    } else {
      toast.error(result.error || 'Could not sync right now — check your connection.');
    }
  };

  const handlePull = async () => {
    setPulling(true);
    const result = await pullCloudSnapshot();
    if (!result.ok) {
      setPulling(false);
      setConfirmPullOpen(false);
      toast.error(result.error || 'Could not download the cloud data.');
      return;
    }
    toast.success('This device now has the latest shared data');
    // Full reload so every cached query and screen reflects the new data.
    window.location.reload();
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
          If you use this shop's code on more than one device, changes don't appear on other devices automatically.
          Use these buttons to send this device's data to the cloud, or bring in the latest data another device saved.
        </p>

        <div className="text-sm">
          {loadingInfo ? (
            <span className="text-muted-foreground">Checking cloud status…</span>
          ) : info?.exists ? (
            <span className="text-muted-foreground">
              Cloud copy last updated {info.updatedAt ? format(new Date(info.updatedAt), 'PPP p') : 'recently'}
              {info.recordCount != null && <> · {info.recordCount.toLocaleString()} records</>}
            </span>
          ) : (
            <span className="text-muted-foreground">No cloud copy saved yet.</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={handlePush} disabled={pushing}>
            {pushing ? <Loader2 className="animate-spin" size={14} /> : <CloudUpload size={14} />}
            Send this device's data to the cloud
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setConfirmPullOpen(true)} disabled={pulling}>
            <CloudDownload size={14} />
            Bring in the latest cloud data
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmPullOpen} onOpenChange={(open) => !pulling && setConfirmPullOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace this device's data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite everything currently on this device with the last data saved to the cloud
              {info?.updatedAt && <> (from {format(new Date(info.updatedAt), 'PPP p')})</>}. Anything added on this
              device since then — and not yet sent to the cloud — will be lost. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pulling}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePull} disabled={pulling} className="gap-2">
              {pulling && <Loader2 className="animate-spin" size={16} />}
              {pulling ? 'Downloading…' : 'Yes, replace it'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
