import { useState, useEffect } from 'react';
import { Lock, Delete, MessageCircle, Phone, RotateCw, ArrowLeft } from 'lucide-react';
import { useShopSettings } from '@/hooks/useShopSettings';
import { SUPPORT_CONTACT, whatsappSupportLink } from '@/lib/license';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  onUnlock: () => void;
}

export function PinLock({ onUnlock }: Props) {
  const { data: shopSettings } = useShopSettings();
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const maxLen = 6;
  const minLen = 4;

  // Auto-submit when user has typed minLen..maxLen digits
  useEffect(() => {
    if (digits.length >= minLen && digits.length <= maxLen) {
      // Try verifying at each length from minLen upward
      handleVerify(digits);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  async function handleVerify(pin: string) {
    if (!window.electronPin) { onUnlock(); return; }
    const res = await window.electronPin.verify(pin);
    if (res.ok) {
      onUnlock();
    } else {
      // Only shake+reset if we've reached maxLen, or if the pin is wrong at current length
      // and there are no more digits to try (i.e. already at maxLen)
      if (pin.length >= maxLen) {
        setShake(true);
        setError('Wrong PIN. Try again.');
        setDigits('');
        setTimeout(() => setShake(false), 500);
      }
      // If pin.length < maxLen, just let the user keep typing (maybe PIN is longer)
    }
  }

  function press(d: string) {
    if (digits.length >= maxLen) return;
    setError('');
    setDigits(prev => prev + d);
  }

  function del() {
    setError('');
    setDigits(prev => prev.slice(0, -1));
  }

  const pad = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['','0','del'],
  ];

  if (showForgot) {
    return <ForgotPinScreen onUnlock={onUnlock} onBack={() => setShowForgot(false)} />;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock size={28} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          {shopSettings?.shop_name || 'DeynPro'}
        </h1>
        <p className="text-sm text-muted-foreground">Enter your PIN to continue</p>
      </div>

      {/* Dot indicators — grow from 4 to 6 as user types */}
      <div className={`flex gap-4 transition-transform ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: Math.max(minLen, digits.length) }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              i < digits.length
                ? 'bg-primary border-primary scale-110'
                : 'border-muted-foreground/40'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive -mt-4">{error}</p>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {pad.flat().map((key, i) => {
          if (key === '') return <div key={i} />;
          if (key === 'del') return (
            <button
              key="del"
              onClick={del}
              className="h-16 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center active:scale-95 transition-transform"
            >
              <Delete size={22} />
            </button>
          );
          return (
            <button
              key={key}
              onClick={() => press(key)}
              className="h-16 rounded-2xl bg-muted text-foreground text-xl font-semibold flex items-center justify-center hover:bg-muted/70 active:scale-95 transition-all"
            >
              {key}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setShowForgot(true)}
        className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        Forgot PIN?
      </button>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}

function ForgotPinScreen({ onUnlock, onBack }: { onUnlock: () => void; onBack: () => void }) {
  const [nonce, setNonce] = useState('');
  const [shopName, setShopName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!window.electronPin) return;
    window.electronPin.forgotGetChallenge().then((res: { nonce: string; shopId: string | null; shopName: string | null }) => {
      setNonce(res.nonce);
      setShopName(res.shopName || '');
    });
  }, []);

  async function handleRegenerate() {
    if (!window.electronPin) return;
    const res = await window.electronPin.forgotRegenerate();
    setNonce(res.nonce);
    setCode('');
    setError('');
    toast.success('New code generated');
  }

  async function handleSubmit() {
    if (!code.trim() || !window.electronPin) return;
    setSubmitting(true);
    setError('');
    const res = await window.electronPin.forgotVerify(code.trim());
    setSubmitting(false);
    if (res.ok) {
      toast.success('PIN reset — you\'re back in');
      onUnlock();
    } else {
      setError(res.error || 'Could not verify this code.');
    }
  }

  const waMessage = `Hi, I'm locked out of DeynPro${shopName ? ` for ${shopName}` : ''} — forgot my PIN. My unlock code is: ${nonce}`;

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center gap-5 p-6">
      <div className="flex flex-col items-center gap-3 max-w-sm text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock size={28} className="text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Forgot your PIN?</h1>
        <p className="text-sm text-muted-foreground">
          Give this code to support — they'll send back an unlock code to paste below.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="text-3xl font-bold tracking-[0.3em] text-primary tabular-nums">
          {nonce || '······'}
        </div>
        <button
          onClick={handleRegenerate}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RotateCw size={12} /> Generate a new code
        </button>
      </div>

      <div className="flex gap-2 w-full max-w-xs">
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

      <div className="w-full max-w-xs space-y-2">
        <input
          type="text"
          placeholder="Paste unlock code here"
          value={code}
          onChange={e => setCode(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono text-center"
        />
        {error && <p className="text-xs text-destructive text-center">{error}</p>}
        <Button className="w-full" onClick={handleSubmit} disabled={submitting || !code.trim()}>
          {submitting ? 'Checking…' : 'Unlock'}
        </Button>
      </div>

      <button
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowLeft size={14} /> Back to PIN entry
      </button>
    </div>
  );
}
