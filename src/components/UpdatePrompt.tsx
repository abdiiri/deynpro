import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { registerServiceWorker } from "@/lib/pwa";

export function UpdatePrompt() {
  const [reload, setReload] = useState<(() => void) | null>(null);

  useEffect(() => {
    registerServiceWorker((reloadFn) => setReload(() => reloadFn));
  }, []);

  if (!reload) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 left-4 md:left-auto z-[100] max-w-sm bg-card border border-border shadow-lg rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom-4"
    >
      <RefreshCw size={20} className="text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground">Update available</p>
        <p className="text-xs text-muted-foreground">
          A new version is ready. Reload to apply.
        </p>
      </div>
      <Button size="sm" onClick={() => reload()} className="shrink-0">
        Reload
      </Button>
    </div>
  );
}