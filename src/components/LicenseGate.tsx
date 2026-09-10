import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, ShieldAlert, MessageCircle, Phone, Loader2, ArrowLeft } from 'lucide-react';
import { getLicenseStatus, activateLicense, whatsappSupportLink, SUPPORT_CONTACT, type LicenseStatus } from '@/lib/license';
import { LandingPage } from '@/components/LandingPage';
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const isValid = status?.activated && !status.expired;

  if (!isValid) {
    // Already a customer whose subscription lapsed — skip the pitch, go
    // straight to renewal. The marketing/install page is for new visitors.
    const isReturningExpired = status?.activated && status.expired;
    if (isReturningExpired) {
      return <ActivationScreen status={status} onActivated={refresh} />;
    }
    return <LandingGate status={status} onActivated={refresh} />;
  }

  return <>{children}</>;
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

  const handleActivate = async () => {
    if (!code.trim()) return;
    setSubmitting(true);
    const result = await activateLicense(code);
    setSubmitting(false);
    if (result.ok) {
      setActivateError(null);
      toast.success('License activated');
      setCode('');
      onActivated();
    } else {
      setActivateError({
        message: result.error || 'Could not activate this code',
        deviceLimitReached: result.deviceLimitReached,
        deviceLimit: result.deviceLimit,
      });
      toast.error(result.error || 'Could not activate this code');
    }
  };

  const wasExpired = status?.activated && status.expired;
  const deviceLimitReached = activateError?.deviceLimitReached;

  const waMessage = wasExpired
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
            {wasExpired || deviceLimitReached ? <ShieldAlert className="text-destructive" size={26} /> : <ShieldCheck className="text-muted-foreground" size={26} />}
          </div>
          <CardTitle className="text-lg">
            {wasExpired ? 'Subscription Expired' : deviceLimitReached ? 'Device Limit Reached' : 'Activate DeynPro'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {wasExpired && status?.shopName && (
            <p className="text-sm text-center text-muted-foreground">
              <span className="font-medium text-foreground">{status.shopName}</span>'s access expired
              {status.expiresAt && ` on ${new Date(status.expiresAt).toDateString()}`}. Enter a new code below to continue.
            </p>
          )}
          {!status?.activated && !status?.error?.includes('unavailable') && !activateError && (
            <p className="text-sm text-center text-muted-foreground">
              Enter the license code you received to start using the app.
            </p>
          )}
          {status?.error && !status?.activated && !activateError && (
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
    </div>
  );
}
