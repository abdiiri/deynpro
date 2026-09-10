import { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Camera, CameraOff, Scan, RefreshCw,
  Smartphone, Wifi, WifiOff, CheckCircle2,
} from 'lucide-react';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

declare global {
  interface Window {
    electronMobileScanner?: {
      getInfo: () => Promise<{ running: boolean; ip: string; port: number; url: string }>;
      onScan: (cb: (barcode: string) => void) => () => void;
      onConnected: (cb: (data: { ip: string }) => void) => () => void;
      onDisconnected: (cb: (data: { ip: string }) => void) => () => void;
    };
  }
}

const isElectron = () => !!(window as any).electronDB;

function QrImage({ url, size = 200 }: { url: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&margin=10`;
  return (
    <img
      src={src}
      alt="QR code"
      width={size}
      height={size}
      className="rounded-xl border border-border shadow-sm"
    />
  );
}

type Tab = 'camera' | 'mobile';

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('mobile');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm w-[95vw] p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Scan size={18} className="text-primary" />
            Barcode Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-border mx-4">
          <TabButton active={activeTab === 'mobile'} onClick={() => setActiveTab('mobile')} icon={<Smartphone size={14} />} label="Mobile (Recommended)" />
          <TabButton active={activeTab === 'camera'} onClick={() => setActiveTab('camera')} icon={<Camera size={14} />} label="PC Camera" />
        </div>

        {activeTab === 'mobile' ? (
          <MobileScannerTab onScan={onScan} open={open} onClose={onClose} />
        ) : (
          <CameraScannerTab onScan={onScan} open={open} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors flex-1 justify-center
        ${active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
    >
      {icon} {label}
    </button>
  );
}

function MobileScannerTab({ onScan, open, onClose }: { onScan: (b: string) => void; open: boolean; onClose: () => void }) {
  const [info, setInfo] = useState<{ ip: string; port: number; url: string } | null>(null);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const unsubRefs = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!open) return;
    setPhoneConnected(false);
    setLastScan(null);
    setScanCount(0);

    if (isElectron() && window.electronMobileScanner) {
      window.electronMobileScanner.getInfo().then(setInfo).catch(() => {});

      const u1 = window.electronMobileScanner.onScan((barcode) => {
        setLastScan(barcode);
        setScanCount(c => c + 1);
        onScan(barcode);
      });
      const u2 = window.electronMobileScanner.onConnected(() => setPhoneConnected(true));
      const u3 = window.electronMobileScanner.onDisconnected(() => setPhoneConnected(false));
      unsubRefs.current = [u1, u2, u3];
    }

    return () => {
      unsubRefs.current.forEach(u => u?.());
      unsubRefs.current = [];
    };
  }, [open]);

  if (!isElectron()) {
    return (
      <div className="p-5 space-y-3">
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold mb-1">📱 Mobile scanner requires the desktop app</p>
          <p className="text-xs opacity-80">Download the DeynPro desktop app to use your phone as a scanner over Wi-Fi.</p>
        </div>
        <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
      </div>
    );
  }

  const url = info?.url ?? '';

  return (
    <div className="p-4 space-y-4">
      <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all
        ${phoneConnected
          ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300'
          : 'bg-muted text-muted-foreground'
        }`}>
        {phoneConnected
          ? <><Wifi size={15} className="text-green-500" /> Phone connected</>
          : <><WifiOff size={15} /> Waiting for phone…</>
        }
        {scanCount > 0 && (
          <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
            {scanCount} scan{scanCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-xs text-muted-foreground">
          Connect phone to the <span className="font-semibold">same Wi-Fi</span> as this PC, then scan the QR code or open:
        </p>
        {url ? (
          <>
            <QrImage url={url} size={180} />
            <span className="text-xs text-primary font-mono select-all">{url}</span>
          </>
        ) : (
          <div className="w-[180px] h-[180px] rounded-xl bg-muted animate-pulse" />
        )}
        <p className="text-[11px] text-muted-foreground">
          Works best with <span className="font-medium">Chrome on Android</span>. No app install needed.
        </p>
      </div>

      {lastScan && (
        <div className="flex items-center gap-2 bg-primary/10 rounded-xl px-4 py-2.5">
          <CheckCircle2 size={15} className="text-primary flex-shrink-0" />
          <span className="text-sm font-mono text-primary font-medium truncate">{lastScan}</span>
        </div>
      )}

      <ManualBarcodeInput onScan={(code) => { setLastScan(code); setScanCount(c => c + 1); onScan(code); }} />
      <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
    </div>
  );
}

function CameraScannerTab({ onScan, open, onClose }: { onScan: (b: string) => void; open: boolean; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!(window as any).BarcodeDetector) setSupported(false);
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const scanLoop = useCallback(() => {
    const detect = async () => {
      if (!videoRef.current || !detectorRef.current) return;
      if (videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }
      try {
        const results = await detectorRef.current.detect(videoRef.current);
        if (results.length > 0) {
          const code = results[0].rawValue;
          setLastScanned(code);
          onScan(code);
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (_) {}
      rafRef.current = requestAnimationFrame(detect);
    };
    rafRef.current = requestAnimationFrame(detect);
  }, [onScan]);

  const startCamera = useCallback(async (deviceId?: string) => {
    stopCamera();
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter(d => d.kind === 'videoinput'));
      if ((window as any).BarcodeDetector) {
        detectorRef.current = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'code_93', 'qr_code', 'itf', 'upc_a', 'upc_e', 'data_matrix'],
        });
        setScanning(true);
        scanLoop();
      }
    } catch (err: any) {
      setError(err.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access in your browser settings.'
        : err.message || 'Could not access camera.');
    }
  }, [stopCamera, scanLoop]);

  useEffect(() => {
    if (open && supported) startCamera();
    else { stopCamera(); setLastScanned(null); setError(null); }
    return stopCamera;
  }, [open]);

  const switchCamera = () => {
    const next = (cameraIndex + 1) % cameras.length;
    setCameraIndex(next);
    startCamera(cameras[next]?.deviceId);
  };

  return (
    <>
      <div className="relative bg-black aspect-[4/3] w-full overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-52 h-36">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-sm" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-sm" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-sm" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-sm" />
              <div className="absolute left-2 right-2 h-0.5 bg-primary/80 shadow-[0_0_8px_2px_hsl(var(--primary)/0.6)] animate-scan-line" />
            </div>
          </div>
        )}
        {lastScanned && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-sm font-mono px-3 py-1.5 rounded-full shadow-lg animate-fade-in">
            ✓ {lastScanned}
          </div>
        )}
        {scanning && cameras.length > 1 && (
          <button onClick={switchCamera} className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors">
            <RefreshCw size={16} />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {!supported ? (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-amber-600">
              <CameraOff size={18} />
              <p className="text-sm font-medium">Camera scanning not supported on this browser</p>
            </div>
            <p className="text-xs text-muted-foreground">Try Chrome or Edge. You can also type a barcode below.</p>
            <ManualBarcodeInput onScan={(code) => { setLastScanned(code); onScan(code); }} />
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <CameraOff size={16} /><p>{error}</p>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => startCamera()}>
              <Camera size={14} /> Retry
            </Button>
            <p className="text-xs text-muted-foreground text-center">Or enter barcode manually:</p>
            <ManualBarcodeInput onScan={(code) => { setLastScanned(code); onScan(code); }} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            Point camera at a barcode — it will be detected automatically
          </p>
        )}
        <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
      </div>
    </>
  );
}

function ManualBarcodeInput({ onScan }: { onScan: (code: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="flex gap-2">
      <input
        autoFocus
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) { onScan(value.trim()); setValue(''); }}}
        placeholder="Type barcode + Enter"
        className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <Button size="sm" onClick={() => { if (value.trim()) { onScan(value.trim()); setValue(''); } }}>Add</Button>
    </div>
  );
}
