import { useEffect, useState } from 'react';
import { useShopSettings, useSaveShopSettings } from '@/hooks/useShopSettings';
import { useExpenseCategories, useAddExpenseCategory, useDeleteExpenseCategory } from '@/hooks/useExpenseCategories';
import { useProductCategories, useAddProductCategory, useDeleteProductCategory } from '@/hooks/useProductCategories';
import { useCurrencySettings, useSaveCurrencySettings, SUPPORTED_CURRENCIES } from '@/hooks/useCurrencySettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Store, Tag, Plus, Trash2, Package, DollarSign, RefreshCw, Target, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useDailySalesTarget, useSaveDailySalesTarget } from '@/hooks/useDailySalesTarget';
import { getLicenseStatus, activateLicense, daysRemaining, type LicenseStatus } from '@/lib/license';
import { CloudSyncPanel } from '@/components/CloudSyncPanel';

export default function Settings() {
  const { data: settings, isLoading } = useShopSettings();
  const save = useSaveShopSettings();
  const { data: categories } = useExpenseCategories();
  const addCat = useAddExpenseCategory();
  const delCat = useDeleteExpenseCategory();
  const { data: productCategories } = useProductCategories();
  const addProdCat = useAddProductCategory();
  const delProdCat = useDeleteProductCategory();

  const { data: currencySettings } = useCurrencySettings();
  const saveCurrency = useSaveCurrencySettings();

  const { data: dailyTarget } = useDailySalesTarget();
  const saveDailyTarget = useSaveDailySalesTarget();
  const [dailyTargetInput, setDailyTargetInput] = useState('');

  const [baseCurrency, setBaseCurrency] = useState('KES');
  const [purchaseCurrency, setPurchaseCurrency] = useState('KES');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [showDual, setShowDual] = useState(false);

  useEffect(() => {
    if (currencySettings) {
      setBaseCurrency(currencySettings.base_currency);
      setPurchaseCurrency(currencySettings.purchase_currency);
      setExchangeRate(String(currencySettings.exchange_rate));
      setShowDual(currencySettings.show_dual_price);
    }
  }, [currencySettings]);

  useEffect(() => {
    if (dailyTarget !== undefined) {
      setDailyTargetInput(dailyTarget > 0 ? String(dailyTarget) : '');
    }
  }, [dailyTarget]);

  const handleSaveCurrency = async () => {
    try {
      await saveCurrency.mutateAsync({
        base_currency: baseCurrency,
        purchase_currency: purchaseCurrency,
        exchange_rate: parseFloat(exchangeRate) || 1,
        show_dual_price: showDual,
      });
      toast.success('Currency settings saved');
    } catch (err: any) { toast.error(err.message); }
  };
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newProdCat, setNewProdCat] = useState('');

  // ── PIN lock state ────────────────────────────────────────────────────────
  const isElectron = !!window.electronPin;
  const [pinEnabled, setPinEnabled] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pinStep, setPinStep] = useState<'idle' | 'set' | 'disable'>('idle');
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinShow, setPinShow] = useState(false);

  useEffect(() => {
    if (!window.electronPin) return;
    window.electronPin.getStatus().then((s: { enabled: boolean; hasPin: boolean }) => {
      setPinEnabled(s.enabled);
      setHasPin(s.hasPin);
    });
  }, []);

  async function handleSetPin() {
    if (pinInput.length < 4) { setPinError('PIN must be at least 4 digits'); return; }
    if (pinInput !== pinConfirm) { setPinError('PINs do not match'); return; }
    // When changing an existing PIN, verify the current one first
    if (hasPin) {
      if (pinCurrent.length < 4) { setPinError('Enter your current PIN first'); return; }
      const verify = await window.electronPin.verify(pinCurrent);
      if (!verify.ok) { setPinError('Current PIN is incorrect'); return; }
    }
    const res = await window.electronPin.set(pinInput);
    if (res.ok) {
      setHasPin(true); setPinEnabled(true);
      setPinStep('idle'); setPinInput(''); setPinConfirm(''); setPinCurrent(''); setPinError('');
      toast.success('PIN set successfully');
    } else { setPinError(res.error || 'Failed'); }
  }

  async function handleDisablePin() {
    const res = await window.electronPin.disable(pinInput);
    if (res.ok) {
      setHasPin(false); setPinEnabled(false);
      setPinStep('idle'); setPinInput(''); setPinError('');
      toast.success('PIN removed');
    } else { setPinError(res.error || 'Wrong PIN'); }
  }

  async function handleTogglePinEnabled(val: boolean) {
    await window.electronPin.toggleEnabled(val);
    setPinEnabled(val);
  }

  useEffect(() => {
    if (settings) {
      setShopName(settings.shop_name || '');
      setPhone(settings.phone || '');
      setAddress(settings.address || '');
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({ shop_name: shopName, phone: phone || undefined, address: address || undefined });
      toast.success('Shop settings saved');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleAddCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    try {
      await addCat.mutateAsync({ name: newCat });
      setNewCat('');
      toast.success('Category added');
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Customize your shop settings</p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Store size={18} className="text-primary" /> Shop Information
          </CardTitle>
          <p className="text-xs text-muted-foreground">Shown on invoices and receipts</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="shopName">Shop Name *</Label>
              <Input id="shopName" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Hakima General Store" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +254 712 345 678" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Nairobi CBD, Tom Mboya St" />
            </div>
            <Button type="submit" className="gradient-primary border-0" disabled={save.isPending || isLoading}>
              {save.isPending ? 'Saving...' : 'Save Shop Info'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag size={18} className="text-primary" /> Expense Categories
          </CardTitle>
          <p className="text-xs text-muted-foreground">Create your own categories used in the Expenses page</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddCat} className="flex gap-2">
            <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category (e.g. marketing)" />
            <Button type="submit" className="gap-1 gradient-primary border-0" disabled={addCat.isPending}>
              <Plus size={14} /> Add
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {(categories || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No custom categories yet. Add one above.</p>
            )}
            {(categories || []).map(c => (
              <Badge key={c.id} variant="secondary" className="gap-1 capitalize py-1.5 px-3">
                {c.name}
                <button
                  onClick={() => delCat.mutate(c.id)}
                  className="ml-1 hover:text-destructive"
                  aria-label={`Delete ${c.name}`}
                >
                  <Trash2 size={12} />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package size={18} className="text-primary" /> Product Categories
          </CardTitle>
          <p className="text-xs text-muted-foreground">Categories used when adding or filtering products</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={async (e) => { e.preventDefault(); if (!newProdCat.trim()) return; try { await addProdCat.mutateAsync(newProdCat); setNewProdCat(''); toast.success('Category added'); } catch (err: any) { toast.error(err.message); } }} className="flex gap-2">
            <Input value={newProdCat} onChange={e => setNewProdCat(e.target.value)} placeholder="New category (e.g. Beverages)" />
            <Button type="submit" className="gap-1 gradient-primary border-0" disabled={addProdCat.isPending}>
              <Plus size={14} /> Add
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {(productCategories || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No categories yet.</p>
            )}
            {(productCategories || []).map(c => (
              <Badge key={c.id} variant="secondary" className="gap-1 capitalize py-1.5 px-3">
                {c.name}
                <button
                  onClick={() => delProdCat.mutate(c.id)}
                  className="ml-1 hover:text-destructive"
                  aria-label={`Delete ${c.name}`}
                >
                  <Trash2 size={12} />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Daily Sales Target ───────────────────────────────────────────── */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target size={18} className="text-primary" /> Daily Sales Target
          </CardTitle>
          <p className="text-xs text-muted-foreground">Set a revenue goal to track on the Dashboard each day</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="dailyTarget">Daily Revenue Goal</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="dailyTarget"
                type="number"
                min="0"
                step="100"
                placeholder="e.g. 15000"
                value={dailyTargetInput}
                onChange={e => setDailyTargetInput(e.target.value)}
                className="w-48"
              />
              <span className="text-sm text-muted-foreground">{currencySettings?.base_currency || 'KES'} / day</span>
            </div>
            <p className="text-xs text-muted-foreground">Set to 0 to hide the target tracker on Dashboard.</p>
          </div>
          <Button
            onClick={async () => {
              try {
                await saveDailyTarget.mutateAsync(parseFloat(dailyTargetInput) || 0);
                toast.success('Daily target saved');
              } catch (err: any) { toast.error(err.message); }
            }}
            className="gradient-primary border-0"
            disabled={saveDailyTarget.isPending}
          >
            <Target size={14} className="mr-2" />
            {saveDailyTarget.isPending ? 'Saving...' : 'Save Target'}
          </Button>
        </CardContent>
      </Card>

      {/* ── Currency & Exchange Rate ─────────────────────────────────────── */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign size={18} className="text-primary" /> Currency & Exchange Rate
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Set your selling currency and the currency you use for purchasing stock
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Selling Currency</Label>
              <p className="text-xs text-muted-foreground">Used for all sales & invoices</p>
              <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="font-mono font-semibold mr-2">{c.code}</span>
                      <span className="text-muted-foreground text-xs">{c.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Purchase Currency</Label>
              <p className="text-xs text-muted-foreground">Currency you buy stock in</p>
              <Select value={purchaseCurrency} onValueChange={setPurchaseCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="font-mono font-semibold mr-2">{c.code}</span>
                      <span className="text-muted-foreground text-xs">{c.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {purchaseCurrency !== baseCurrency && (
            <div className="space-y-1">
              <Label htmlFor="rate">Exchange Rate</Label>
              <p className="text-xs text-muted-foreground">
                1 {purchaseCurrency} = how many {baseCurrency}?
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">1 {purchaseCurrency} =</span>
                <Input
                  id="rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={exchangeRate}
                  onChange={e => setExchangeRate(e.target.value)}
                  className="w-36"
                />
                <span className="text-sm font-mono text-muted-foreground">{baseCurrency}</span>
              </div>
              <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
                <p className="font-medium text-primary">Example conversion</p>
                <p className="text-muted-foreground mt-0.5">
                  A product costing <strong>100 {purchaseCurrency}</strong> = <strong>{(100 * (parseFloat(exchangeRate) || 1)).toLocaleString()} {baseCurrency}</strong>
                </p>
              </div>
            </div>
          )}

          {purchaseCurrency !== baseCurrency && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Show dual prices in Products</p>
                <p className="text-xs text-muted-foreground">Display cost in both {purchaseCurrency} and {baseCurrency}</p>
              </div>
              <Switch checked={showDual} onCheckedChange={setShowDual} />
            </div>
          )}

          <Button onClick={handleSaveCurrency} className="gradient-primary border-0" disabled={saveCurrency.isPending}>
            <RefreshCw size={14} className="mr-2" />
            {saveCurrency.isPending ? 'Saving...' : 'Save Currency Settings'}
          </Button>
        </CardContent>
      </Card>
      {/* PIN Lock — Electron only */}
      {isElectron && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock size={16} className="text-primary" /> PIN Lock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Require a PIN each time the app opens to prevent unauthorized access.
            </p>

            {hasPin && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">PIN lock enabled</p>
                  <p className="text-xs text-muted-foreground">Prompted on every app start</p>
                </div>
                <Switch checked={pinEnabled} onCheckedChange={handleTogglePinEnabled} />
              </div>
            )}

            {pinStep === 'idle' && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setPinStep('set'); setPinError(''); }}>
                  <Lock size={14} className="mr-2" />
                  {hasPin ? 'Change PIN' : 'Set PIN'}
                </Button>
                {hasPin && (
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => { setPinStep('disable'); setPinError(''); }}>
                    Remove PIN
                  </Button>
                )}
              </div>
            )}

            {pinStep === 'set' && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-sm font-medium">{hasPin ? 'Change PIN' : 'Create PIN'}</p>
                {hasPin && (
                  <div className="space-y-1">
                    <Label>Current PIN</Label>
                    <div className="relative">
                      <Input
                        type={pinShow ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        value={pinCurrent}
                        onChange={e => { setPinCurrent(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                        placeholder="••••"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>New PIN (4–6 digits)</Label>
                  <div className="relative">
                    <Input
                      type={pinShow ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      value={pinInput}
                      onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                      placeholder="••••"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setPinShow(v => !v)}>
                      {pinShow ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Confirm PIN</Label>
                  <Input
                    type={pinShow ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={pinConfirm}
                    onChange={e => { setPinConfirm(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                    placeholder="••••"
                  />
                </div>
                {pinError && <p className="text-xs text-destructive">{pinError}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSetPin}>Save PIN</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPinStep('idle'); setPinInput(''); setPinConfirm(''); setPinCurrent(''); setPinError(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {pinStep === 'disable' && (
              <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
                <p className="text-sm font-medium text-destructive">Enter current PIN to remove it</p>
                <div className="relative">
                  <Input
                    type={pinShow ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={pinInput}
                    onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                    placeholder="Current PIN"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setPinShow(v => !v)}>
                    {pinShow ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
                {pinError && <p className="text-xs text-destructive">{pinError}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={handleDisablePin}>Remove PIN</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPinStep('idle'); setPinInput(''); setPinError(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <LicenseSettingsCard />
      <CloudSyncPanel />
    </div>
  );
}

function LicenseSettingsCard() {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const refresh = () => { getLicenseStatus().then(setStatus); };
  useEffect(() => { refresh(); }, []);

  const handleActivate = async () => {
    if (!code.trim()) return;
    setSubmitting(true);
    const result = await activateLicense(code);
    setSubmitting(false);
    if (result.ok) {
      toast.success('License updated');
      setCode('');
      setShowForm(false);
      // Force a full reload rather than just refreshing status — this
      // guarantees the correct shop's local database gets opened if the
      // code entered belongs to a different shop than before (see
      // src/lib/webDB.ts for why the database is scoped per shop).
      window.location.reload();
    } else {
      toast.error(result.error || 'Could not activate this code');
    }
  };

  if (!status) return null;

  const left = daysRemaining(status.expiresAt);
  const expiringSoon = status.activated && !status.expired && left <= 7;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound size={18} className="text-primary" /> License
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.activated && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Shop</p>
              <p className="font-medium">{status.shopName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plan</p>
              <p className="font-medium">{status.plan}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expires</p>
              <p className={`font-medium ${status.expired ? 'text-destructive' : expiringSoon ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {status.expiresAt ? new Date(status.expiresAt).toDateString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={status.expired ? 'destructive' : 'default'} className="mt-0.5">
                {status.expired ? 'Expired' : expiringSoon ? `${left} day${left !== 1 ? 's' : ''} left` : 'Active'}
              </Badge>
            </div>
          </div>
        )}
        {!status.activated && <p className="text-sm text-muted-foreground">No license activated.</p>}

        {!showForm ? (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            {status.activated ? 'Enter renewal code' : 'Activate license'}
          </Button>
        ) : (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono min-h-[80px]"
              placeholder="Paste your license code here (starts with DPL1.)"
              value={code}
              onChange={e => setCode(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleActivate} disabled={submitting || !code.trim()}>
                {submitting ? 'Activating…' : 'Activate'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setCode(''); }}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}