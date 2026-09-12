import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, ShieldAlert, MessageCircle, Phone, Loader2, ArrowLeft } from 'lucide-react';
import { getLicenseStatus, activateLicense, pullCloudSnapshot, startFreshCloudData, whatsappSupportLink, SUPPORT_CONTACT, type LicenseStatus, type SnapshotAvailable } from '@/lib/license';
import { LandingPage } from '@/components/LandingPage';
import { ContinueDataPrompt } from '@/components/ContinueDataPrompt';
import { useCloudSync } from '@/hooks/useCloudSync';
import { toast } from 'sonner';

// Re-checks the license against the local clock every 5 minutes while the
// app is open. This is a pure date comparison (no crypto, no I/O) so it's
// cheap — but it means a code that expires mid-session locks the app out
// automatically, without needing a restart.
const RECHECK_INTERVAL_MS = 5 * 60 * 1000;

export function LicenseGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const s = await getLicenseStatus();
    setStatus(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, RECHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const isValid = !!status?.activated && !status?.expired;

  // Keep the cloud snapshot fresh in the background whenever the app is in
  // active use — called unconditionally (hooks can't be behind the early
  // returns below), it's a no-op internally until isValid is true.
  useCloudSync(isValid);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!isValid) {
    // Already a customer whose subscription lapsed or was revoked — skip
    // the pitch, go straight to the code screen. The marketing/install
    // page is for new visitors who've never had a code.
    const skipLanding = (status?.activated && status.expired) || status?.revoked;
    if (skipLanding) {
      return <ActivationScreen status={status} onActivated={refresh} />;
    }
    return <LandingGate status={status} onActivated={refresh} />;
  }

  return (
    <>
      {status?.trial && <TrialBanner daysLeft={status.trialDaysLeft ?? 0} />}
      {children}
    </>
  );
}

function TrialBanner({ daysLeft }: { daysLeft: number }) {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs sm:text-sm py-1.5 px-3 text-center border-b border-amber-500/20">
      <span>
        Free trial — {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'ends today'}
      </span>
      <button
        onClick={() => window.open(whatsappSupportLink("Hi, I'm on the DeynPro free trial and would like to get a code."), '_blank')}
        className="underline font-medium"
      >
        Get a code
      </button>
    </div>
  );
}

function LandingGate({ status, onActivated }: { status: LicenseStatus | null; onActivated: () => void }) {
  const [showActivation, setShowActivation] = useState(false);

  if (!showActivation) {
    return <LandingPage onContinue={() => setShowActivation(true)} />;
  }

  return <ActivationScreen status={status} onActivated={onActivated} onBack={() => setShowActivation(false)} />;
}

function ActivationScreen({ status, onActivated, onBack }: { status: LicenseStatus | null; onActivated: () => void; onBack?: () => void }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activateError, setActivateError] = useState<{ message: string; deviceLimitReached?: boolean; deviceLimit?: number } | null>(null);
  const [pendingSnapshot, setPendingSnapshot] = useState<(SnapshotAvailable & { shopName?: string }) | null>(null);

  const handleActivate = async () => {
    if (!code.trim()) return;
    setSubmitting(true);
    const result = await activateLicense(code);
    setSubmitting(false);
    if (result.ok) {
      setActivateError(null);
      setCode('');
      if (result.snapshotAvailable) {
        // Fresh device, and the shop already has data saved from another
        // device — let the person choose before entering the app.
        setPendingSnapshot({ ...result.snapshotAvailable, shopName: (result as Record<string, unknown>).shopName as string | undefined });
      } else {
        toast.success('License activated');
        onActivated();
      }
    } else {
      setActivateError({
        message: result.error || 'Could not activate this code',
        deviceLimitReached: result.deviceLimitReached,
        deviceLimit: result.deviceLimit,
      });
      toast.error(result.error || 'Could not activate this code');
    }
  };

  const handleContinueData = async () => {
    const result = await pullCloudSnapshot();
    if (!result.ok) throw new Error(result.error || 'Could not download the existing data.');
    toast.success('Your existing data is ready on this device');
    setPendingSnapshot(null);
    onActivated();
  };

  const handleStartFresh = () => {
    startFreshCloudData();
    setPendingSnapshot(null);
    toast.success('License activated');
    onActivated();
  };

  const wasExpired = status?.activated && status.expired;
  const wasRevoked = status?.revoked;
  const deviceLimitReached = activateError?.deviceLimitReached;

  const waMessage = wasRevoked
    ? `Hi, my DeynPro access for ${status?.shopName || 'my shop'} was turned off — can we sort this out?`
    : wasExpired
    ? `Hi, my DeynPro subscription for ${status?.shopName || 'my shop'} has expired. I'd like to renew.`
    : deviceLimitReached
      ? `Hi, I've hit the device limit (${activateError?.deviceLimit ?? ''}) on my DeynPro subscription and need to switch to a new device.`
      : `Hi, I need help activating DeynPro.`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground pt-4 pl-4 -mb-2"
          >
            <ArrowLeft size={13} /> Back
          </button>
        )}
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            {wasExpired || wasRevoked || deviceLimitReached ? <ShieldAlert className="text-destructive" size={26} /> : <ShieldCheck className="text-muted-foreground" size={26} />}
          </div>
          <CardTitle className="text-lg">
            {wasRevoked ? 'Access Turned Off' : wasExpired ? 'Subscription Expired' : deviceLimitReached ? 'Device Limit Reached' : status?.trialExpired ? 'Free Trial Ended' : 'Activate DeynPro'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {wasRevoked && (
            <p className="text-sm text-center text-muted-foreground">
              {status?.error || 'Access to this code has been turned off.'}
            </p>
          )}
          {wasExpired && status?.shopName && (
            <p className="text-sm text-center text-muted-foreground">
              <span className="font-medium text-foreground">{status.shopName}</span>'s access expired
              {status.expiresAt && ` on ${new Date(status.expiresAt).toDateString()}`}. Enter a new code below to continue.
            </p>
          )}
          {status?.trialExpired && (
            <p className="text-sm text-center text-muted-foreground">
              Your 7-day free trial has ended. Enter a code below to keep using DeynPro.
            </p>
          )}
          {!status?.activated && !status?.trialExpired && !wasRevoked && !status?.error?.includes('unavailable') && !activateError && (
            <p className="text-sm text-center text-muted-foreground">
              Enter the license code you received to start using the app.
            </p>
          )}
          {status?.error && !status?.activated && !activateError && !wasRevoked && (
            <p className="text-xs text-center text-destructive">{status.error}</p>
          )}
          {activateError && (
            <p className="text-xs text-center text-destructive">{activateError.message}</p>
          )}

          <Textarea
            placeholder="Paste your license code here (starts with DPL1.)"
            value={code}
            onChange={e => setCode(e.target.value)}
            className="font-mono text-xs min-h-[90px]"
          />

          <Button className="w-full" onClick={handleActivate} disabled={submitting || !code.trim()}>
            {submitting ? 'Activating…' : 'Activate'}
          </Button>

          <div className="pt-3 border-t border-border space-y-2">
            <p className="text-xs text-center text-muted-foreground">
              {deviceLimitReached ? 'Ask support to free up a device slot:' : 'Need a code, or think this is a mistake?'}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => window.open(whatsappSupportLink(waMessage), '_blank')}
              >
                <MessageCircle size={14} /> WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => window.open(`tel:${SUPPORT_CONTACT.phone}`)}
              >
                <Phone size={14} /> Call
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ContinueDataPrompt
        open={!!pendingSnapshot}
        shopName={pendingSnapshot?.shopName}
        updatedAt={pendingSnapshot?.updatedAt}
        recordCount={pendingSnapshot?.recordCount}
        onContinue={handleContinueData}
        onStartFresh={handleStartFresh}
      />
    </div>
  );
}
