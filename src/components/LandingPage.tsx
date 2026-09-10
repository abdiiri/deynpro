import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Users, Package, Receipt, TrendingUp, WifiOff, Globe,
  Download, Share, PlusSquare, MoreVertical, MessageCircle, ArrowRight,
} from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { whatsappSupportLink } from '@/lib/license';

const FEATURES = [
  { icon: Users, title: 'Customer debts', desc: 'Track who owes what, send reminders, get paid on time.' },
  { icon: Package, title: 'Inventory', desc: 'Stock levels, low-stock alerts, receiving — always up to date.' },
  { icon: Receipt, title: 'Sales & receipts', desc: 'Ring up sales fast, print or share receipts instantly.' },
  { icon: TrendingUp, title: 'Reports', desc: 'End-of-day summaries and reports that show where you stand.' },
  { icon: WifiOff, title: 'Works offline', desc: 'No signal, no problem — everything keeps working, syncs later.' },
  { icon: Globe, title: 'Any device', desc: 'Phone, tablet, or computer — one app, install it anywhere.' },
];

function InstallSection() {
  const { canPrompt, isIOS, isStandalone, promptInstall } = usePwaInstall();

  if (isStandalone) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          You already have DeynPro installed on this device. 🎉
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2 justify-center text-primary font-semibold">
          <Download size={18} /> Install DeynPro on this device
        </div>

        {canPrompt && (
          <Button className="w-full" onClick={promptInstall}>
            <Download size={16} className="mr-1.5" /> Install App
          </Button>
        )}

        {!canPrompt && isIOS && (
          <div className="text-sm text-center text-muted-foreground space-y-1.5">
            <p className="flex items-center justify-center gap-1.5">
              Tap <Share size={15} className="inline text-foreground" /> <span className="font-medium text-foreground">Share</span> in Safari,
            </p>
            <p className="flex items-center justify-center gap-1.5">
              then <PlusSquare size={15} className="inline text-foreground" /> <span className="font-medium text-foreground">Add to Home Screen</span>.
            </p>
          </div>
        )}

        {!canPrompt && !isIOS && (
          <div className="text-sm text-center text-muted-foreground space-y-1.5">
            <p className="flex items-center justify-center gap-1.5">
              Open your browser menu (<MoreVertical size={15} className="inline text-foreground" />)
            </p>
            <p>and choose <span className="font-medium text-foreground">"Install app"</span> or <span className="font-medium text-foreground">"Add to Home Screen"</span>.</p>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground">
          Works like a regular app — its own icon, opens full-screen, no browser needed after that.
        </p>
      </CardContent>
    </Card>
  );
}

export function LandingPage({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-10 space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center text-2xl font-bold text-white">
            D
          </div>
          <h1 className="text-2xl font-bold">DeynPro</h1>
          <p className="text-muted-foreground">
            The simple way to run a small shop — customers, debts, stock, and sales, all in one place.
          </p>
        </div>

        <InstallSection />

        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardContent className="p-4 space-y-1.5">
                <f.icon size={20} className="text-primary" />
                <div className="text-sm font-medium">{f.title}</div>
                <div className="text-xs text-muted-foreground">{f.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-2.5">
          <Button className="w-full" size="lg" onClick={onContinue}>
            I have a code — Activate <ArrowRight size={16} className="ml-1.5" />
          </Button>
          <Button
            variant="outline"
            className="w-full gap-1.5"
            onClick={() => window.open(whatsappSupportLink("Hi, I'd like to get DeynPro for my shop."), '_blank')}
          >
            <MessageCircle size={16} /> Don't have a code? Ask on WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
