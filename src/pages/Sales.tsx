import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers, useCustomerCreditStatus, useUpdateLoyaltyPoints } from '@/hooks/useCustomers';
import { useCreateSale, CartItem, SaleItem } from '@/hooks/useSales';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Plus, Trash2, CheckCircle, Package, Clock, ScanLine, QrCode, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ReceiptModal } from '@/components/ReceiptModal';
import { useShopSettings } from '@/hooks/useShopSettings';
import { BarcodeScanner } from '@/components/BarcodeScanner';

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString()}`;
}

// ── Beep sound via Web Audio API (non-blocking, no file needed) ──────────────
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch (_) { /* audio not available */ }
}

interface LastAdded {
  product: any;
  asPiece: boolean;
}

interface RecentProduct {
  product: any;
  asPiece: boolean;
  label: string;
}

export default function Sales() {
  const { t } = useTranslation();
  const { data: products } = useProducts();
  const { data: customers } = useCustomers();

  const createSale = useCreateSale();
  const updateLoyalty = useUpdateLoyaltyPoints();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerId, setCustomerId] = useState('none');
  const [showSuccess, setShowSuccess] = useState(false);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [focusedIndex, setFocusedIndex] = useState(0);

  // ── New POS state ─────────────────────────────────────────────────────────
  const [lastAdded, setLastAdded] = useState<LastAdded | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);

  const { data: shopSettings } = useShopSettings();
  const [receiptData, setReceiptData] = useState<any>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [printPromptOpen, setPrintPromptOpen] = useState(false);
  const noBtnRef = useRef<HTMLButtonElement>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [scannerUrl, setScannerUrl] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const focusedRowRef = useRef<HTMLTableRowElement>(null);

  // ── Auto-focus search when modal opens ───────────────────────────────────
  useEffect(() => {
    if (productModalOpen) {
      // Small delay to let the Dialog animation settle
      const t = setTimeout(() => searchInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [productModalOpen]);

  // ── Scroll focused row into view ─────────────────────────────────────────
  useEffect(() => {
    focusedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set((products || []).map(p => p.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [products]);

  // Filter products in modal
  const filteredProducts = useMemo(() => {
    setFocusedIndex(0);
    return (products || []).filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
        (p.barcode || '').includes(modalSearch);
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, modalSearch, categoryFilter]);

  // ── Core addToCart — now with beep + flash + recents + lastAdded ─────────
  const addToCart = useCallback((product: any, asPiece = false) => {
    setCart(prev => {
      const cartKey = asPiece ? `${product.id}__piece` : product.id;
      const existing = prev.find(item => item.product_id === cartKey);

      // For piece sales: available = total pieces remaining (pack qty × pieces_per_pack)
      // For pack sales: available = pack quantity
      const piecesPerPack = product.pieces_per_pack || 0;
      const available = asPiece && piecesPerPack > 0
        ? Math.floor(product.quantity * piecesPerPack)  // total whole pieces left
        : product.quantity;

      if (existing) {
        if (existing.quantity >= available) {
          toast.error(t('sales.notEnoughStock'));
          return prev;
        }
        return prev.map(item =>
          item.product_id === cartKey ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // For pieces: need at least 1 piece (>0 pack qty). For packs: need at least 1 pack.
      const hasStock = asPiece && piecesPerPack > 0
        ? product.quantity > 0
        : product.quantity >= 1;
      if (!hasStock) {
        toast.error(t('sales.outOfStock'));
        return prev;
      }

      const effectivePiecePrice =
        product.piece_price > 0
          ? product.piece_price
          : product.pieces_per_pack > 0
          ? product.price / product.pieces_per_pack
          : 0;
      const resolvedPrice = asPiece ? effectivePiecePrice : product.price;

      return [
        ...prev,
        {
          product_id: cartKey,
          name: asPiece ? `${product.name} (piece)` : product.name,
          price: resolvedPrice,
          quantity: 1,
          available,
          cost_price: asPiece
            ? product.pieces_per_pack > 0
              ? product.cost_price / product.pieces_per_pack
              : product.cost_price
            : product.cost_price,
          piece_mode: asPiece,
          pack_name: product.pack_name || null,
          pieces_per_pack: product.pieces_per_pack || 0,
          piece_price: effectivePiecePrice,
          pack_price: product.price,
        },
      ];
    });

    // Beep
    playBeep();

    // Flash this row
    const flashKey = asPiece ? `${product.id}__piece` : product.id;
    setFlashId(flashKey);
    setTimeout(() => setFlashId(null), 150);

    // Track last added (for Shift+Enter repeat)
    setLastAdded({ product, asPiece });

    // Update recents strip (max 8, no duplicate key)
    const recentKey = asPiece ? `${product.id}__piece` : product.id;
    const label = asPiece
      ? `${product.name} (piece)`
      : product.pack_name
      ? `${product.name} · ${product.pack_name}`
      : product.name;

    setRecentProducts(prev => {
      const filtered = prev.filter(r =>
        (asPiece ? `${r.product.id}__piece` : r.product.id) !== recentKey
      );
      return [{ product, asPiece, label }, ...filtered].slice(0, 8);
    });
  }, [t]);

  // ── Global 'a' key → open Add Products modal ─────────────────────────────
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (productModalOpen) return; // already open
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setProductModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [productModalOpen]);

  // ── Keyboard handler for the modal ───────────────────────────────────────
  useEffect(() => {
    if (!productModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't steal events from Select dropdowns or other inputs (except our search)
      const tag = (e.target as HTMLElement).tagName;
      const isSearch = e.target === searchInputRef.current;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(i => Math.min(i + 1, filteredProducts.length - 1));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(i => Math.max(i - 1, 0));
          break;

        case 'Enter':
          if (e.shiftKey) {
            // Shift+Enter → repeat last added
            if (lastAdded) {
              e.preventDefault();
              addToCart(lastAdded.product, lastAdded.asPiece);
            }
          } else {
            // Enter → add focused product
            const focused = filteredProducts[focusedIndex];
            if (focused) {
              e.preventDefault();
              addToCart(focused);
            }
          }
          break;

        case 'Escape':
          // Let Dialog handle it naturally
          break;

        default:
          // If typing and not already in search, re-focus search
          if (!isSearch && tag !== 'INPUT' && tag !== 'SELECT' && e.key.length === 1) {
            searchInputRef.current?.focus();
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productModalOpen, filteredProducts, focusedIndex, lastAdded, addToCart]);

  // ── Barcode auto-add: exact match on barcode field ───────────────────────
  useEffect(() => {
    if (!modalSearch || !products) return;
    const exactMatch = products.find(
      p => p.barcode && p.barcode === modalSearch
    );
    if (exactMatch) {
      addToCart(exactMatch);
      setModalSearch('');
    }
  }, [modalSearch, products, addToCart]);

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.product_id !== productId) return item;
        const newQty = item.quantity + delta;
        if (newQty < 1) return item;
        if (newQty > item.available) {
          toast.error(t('sales.notEnoughStock'));
          return item;
        }
        return { ...item, quantity: newQty };
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const total = cart.reduce((s, item) => s + item.price * item.quantity, 0);

  // Credit limit check — live as customer/cart changes
  const creditStatus = useCustomerCreditStatus(
    customerId !== 'none' ? customerId : '',
    paymentMethod === 'credit' ? total : 0
  );

  const handlePaymentMethodChange = (value: string) => {
    if (value === 'credit' && customerId === 'none') {
      toast.error(t('sales.selectCustomerFirst'));
      return;
    }
    setPaymentMethod(value);
  };

  const handleCustomerChange = (value: string) => {
    setCustomerId(value);
    if (value === 'none' && paymentMethod === 'credit') {
      setPaymentMethod('cash');
      toast.info(t('sales.paymentChangedToCash'));
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error(t('sales.cartIsEmpty')); return; }
    const belowCost = cart.find(item => item.price < item.cost_price);
    if (belowCost) {
      toast.error(t('sales.belowCost', { name: belowCost.name, cost: belowCost.cost_price.toLocaleString() }));
      return;
    }
    if (paymentMethod === 'credit' && customerId === 'none') {
      toast.error(t('sales.creditRequiresCustomer'));
      return;
    }
    if (paymentMethod === 'credit' && creditStatus.wouldExceed) {
      const fmt = (n: number) => `KES ${n.toLocaleString()}`;
      toast.error(
        `Credit limit exceeded! Current balance: ${fmt(creditStatus.balance)}, ` +
        `limit: ${fmt(creditStatus.limit)}. Reduce the order or change payment method.`
      );
      return;
    }
    try {
      const items: SaleItem[] = cart.map(item => ({
        product_id: item.product_id.replace('__piece', ''),
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,
        piece_mode: item.piece_mode ? 1 : 0,
        pieces_per_pack: item.pieces_per_pack || 0,
      }));
      const sale = await createSale.mutateAsync({
        items,
        payment_method: paymentMethod,
        customer_id: customerId !== 'none' ? customerId : undefined,
      });
      const receiptItems = cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,
      }));
      const customer = customerId !== 'none'
        ? (customers || []).find((cu: any) => cu.id === customerId)
        : null;
      // Award 1 loyalty point per KES 100 spent (cash or credit)
      if (customerId !== 'none') {
        const points = Math.floor(total / 100);
        if (points > 0) updateLoyalty.mutate({ id: customerId, delta: points });
      }

      setReceiptData({
        saleId: sale?.id,
        date: new Date().toISOString(),
        items: receiptItems,
        total,
        paymentMethod,
        customerName: customer?.name || null,
        shopName: shopSettings?.shop_name || 'DeynPro',
        shopPhone: shopSettings?.phone || null,
        shopAddress: shopSettings?.address || null,
      });
      setCart([]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      toast.success(t('sales.saleCompleted'));
      // Ask user whether to print receipt (No is focused by default)
      setPrintPromptOpen(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleScan = (barcode: string) => {
    const match = (products || []).find(p => p.barcode && p.barcode === barcode);
    if (match) {
      addToCart(match);
      toast.success(`Added: ${match.name}`);
    } else {
      toast.error(`No product found for barcode: ${barcode}`);
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('sales.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('sales.subtitle')}</p>
      </div>

      {showSuccess && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="text-primary" size={24} />
            <div>
              <p className="font-medium text-primary">{t('sales.saleCompleted')}</p>
              <p className="text-sm text-muted-foreground">{t('sales.stockUpdated')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex gap-2">
          <Button className="flex-1 gap-2" variant="outline" onClick={() => setProductModalOpen(true)}>
            <Package size={16} /> {t('sales.addProducts')}
          </Button>
          <Button variant="outline" className="gap-2 px-4" onClick={() => setScannerOpen(true)}>
            <ScanLine size={16} /> Scan
          </Button>
          <Button
            variant="outline"
            className="px-3"
            title="Show QR code for mobile scanner"
            onClick={async () => {
              if ((window as any).electronMobileScanner) {
                const info = await (window as any).electronMobileScanner.getInfo();
                setScannerUrl(info.url);
              }
              setQrOpen(true);
            }}
          >
            <QrCode size={16} />
          </Button>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-0">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">{t('sales.cartEmpty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="border border-border">
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead className="w-[90px] border-r border-border">{t('sales.itemNo')}</TableHead>
                      <TableHead className="border-r border-border">{t('sales.itemName')}</TableHead>
                      <TableHead className="text-right border-r border-border w-[110px]">Unit Price</TableHead>
                      <TableHead className="text-center border-r border-border w-[90px]">{t('common.quantity')}</TableHead>
                      <TableHead className="text-center border-r border-border w-[70px]">Ratio</TableHead>
                      <TableHead className="text-right border-r border-border">{t('common.total')}</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item, index) => (
                      <TableRow key={item.product_id} className="border-b border-border">
                        <TableCell className="font-mono text-sm text-muted-foreground border-r border-border">
                          #{String(index + 1).padStart(6, '0')}
                        </TableCell>
                        <TableCell className="font-medium text-sm border-r border-border">{item.name}</TableCell>
                        <TableCell className="border-r border-border p-1">
                          <Input
                            type="number"
                            min={0}
                            className={`h-8 text-right text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${item.price < item.cost_price ? 'border-destructive text-destructive' : ''}`}
                            value={item.price}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const product = (products || []).find(p => p.id === item.product_id);
                              const costPrice = product?.cost_price || 0;
                              if (val < costPrice) {
                                toast.error(t('sales.priceCantBeBelowCost', { cost: costPrice.toLocaleString() }));
                              }
                              setCart(prev => prev.map(c => c.product_id === item.product_id ? { ...c, price: val } : c));
                            }}
                          />
                        </TableCell>
                        <TableCell className="border-r border-border p-1">
                          <Input
                            type="number"
                            min={1}
                            max={item.available}
                            className="h-8 text-center text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              if (val > item.available) { toast.error(t('sales.notEnoughStock')); return; }
                              setCart(prev => prev.map(c => c.product_id === item.product_id ? { ...c, quantity: Math.max(1, val) } : c));
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-center border-r border-border p-1">
                          {item.pieces_per_pack > 0 ? (
                            <div className="text-xs leading-tight">
                              {item.piece_mode ? (
                                <span className="text-amber-600 font-medium">piece<br /><span className="text-muted-foreground">1/{item.pieces_per_pack}</span></span>
                              ) : (
                                <span className="text-blue-600 font-medium">
                                  {item.pack_name || 'pack'}<br />
                                  <span className="text-muted-foreground">×{item.pieces_per_pack}</span>
                                </span>
                              )}
                            </div>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm border-r border-border">{formatKES(item.price * item.quantity)}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product_id)}>
                            <Trash2 size={12} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Checkout Section */}
        {cart.length > 0 && (
          <Card className="shadow-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-card-foreground">{t('sales.totalItems', { count: cart.length })}</span>
                <span className="text-xl font-bold text-primary">{formatKES(total)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('common.customer')}</label>
                  <Select value={customerId} onValueChange={handleCustomerChange}>
                    <SelectTrigger><SelectValue placeholder={t('sales.customerOptional')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('sales.walkIn')}</SelectItem>
                      {(customers || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('sales.paymentMethod')}</label>
                  <Select value={paymentMethod} onValueChange={handlePaymentMethodChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t('sales.cash')}</SelectItem>
                      <SelectItem value="mpesa">{t('sales.mpesa')}</SelectItem>
                      <SelectItem value="card">{t('sales.card')}</SelectItem>
                      {customerId !== 'none' && (
                        <SelectItem value="credit">{t('sales.credit')}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {customerId === 'none' && (
                    <p className="text-xs text-muted-foreground mt-1">{t('sales.creditHint')}</p>
                  )}
                  {/* Credit limit warning banner */}
                  {paymentMethod === 'credit' && customerId !== 'none' && creditStatus.limit > 0 && (
                    <div className={`mt-2 rounded-lg px-3 py-2 text-xs flex items-start gap-2 ${
                      creditStatus.wouldExceed
                        ? 'bg-destructive/10 border border-destructive/30 text-destructive'
                        : 'bg-success/10 border border-success/30 text-success'
                    }`}>
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">
                          {creditStatus.wouldExceed ? 'Credit limit exceeded' : 'Credit available'}
                        </p>
                        <p className="opacity-80">
                          Balance: KES {creditStatus.balance.toLocaleString()} / Limit: KES {creditStatus.limit.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button className="w-full gradient-primary border-0" onClick={handleCheckout}
                disabled={createSale.isPending || (paymentMethod === 'credit' && creditStatus.wouldExceed)}>
                {createSale.isPending ? t('sales.processing') : `${t('sales.checkout')} — ${formatKES(total)}`}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Product Picker Modal */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col gap-3 p-4">
          <DialogHeader className="pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Package size={18} /> {t('sales.selectProducts')}
              {lastAdded && (
                <span className="ms-auto text-xs font-normal text-muted-foreground hidden sm:flex items-center gap-1">
                  <kbd className="bg-muted border border-border rounded px-1 py-0.5 text-[10px]">Shift+↵</kbd>
                  repeat: <span className="text-foreground font-medium">{lastAdded.product.name}{lastAdded.asPiece ? ' (piece)' : ''}</span>
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Search + Category */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={t('sales.searchByNameBarcode')}
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
                className="ps-9 h-9 text-sm"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder={t('common.category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('sales.allCategories')}</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Recent Products Strip ────────────────────────────────────── */}
          {recentProducts.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-shrink-0">
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 flex-shrink-0">
                <Clock size={11} /> Recent
              </span>
              {recentProducts.map((r, i) => {
                const rKey = r.asPiece ? `${r.product.id}__piece` : r.product.id;
                return (
                  <button
                    key={`${rKey}-${i}`}
                    onClick={() => addToCart(r.product, r.asPiece)}
                    className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-medium bg-muted hover:bg-primary/10 hover:text-primary border border-border rounded-full px-2.5 py-1 transition-colors"
                  >
                    <Plus size={9} />
                    {r.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Keyboard hint bar ────────────────────────────────────────── */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-shrink-0 flex-wrap">
            {[
              ['↑↓', 'Navigate'],
              ['↵', 'Add to cart'],
              ['⇧↵', 'Repeat last'],
              ['Esc', 'Close'],
            ].map(([key, label]) => (
              <span key={key} className="flex items-center gap-1">
                <kbd className="bg-muted border border-border rounded px-1 py-0.5 font-mono text-[10px]">{key}</kbd>
                {label}
              </span>
            ))}
          </div>

          {/* ── Product Table ─────────────────────────────────────────────── */}
          <div className="flex-1 overflow-auto rounded-xl border border-border bg-card shadow-sm min-h-0">
            <Table className="w-full text-sm border-separate border-spacing-0">
              <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-md z-10">
                <TableRow className="border-b-2 border-border hover:bg-transparent">
                  <TableHead className="py-2.5 px-3 border-r border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide w-9">#</TableHead>
                  <TableHead className="py-2.5 px-3 border-r border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product</TableHead>
                  <TableHead className="py-2.5 px-3 border-r border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right w-[105px]">Pack S.P</TableHead>
                  <TableHead className="py-2.5 px-3 border-r border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center w-[80px]">Ratio</TableHead>
                  <TableHead className="py-2.5 px-3 border-r border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right w-[105px]">Piece S.P</TableHead>
                  <TableHead className="py-2.5 px-3 border-r border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right w-[95px]">Profit</TableHead>
                  <TableHead className="py-2.5 px-3 border-r border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center w-[58px]">Qty</TableHead>
                  <TableHead className="py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center w-[110px]">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredProducts.map((product, idx) => {
                  const inCart = cart.find(c => c.product_id === product.id);
                  const inCartPiece = cart.find(c => c.product_id === `${product.id}__piece`);
                  const hasPack = product.pieces_per_pack > 0;
                  const effectivePieceSP =
                    product.piece_price > 0
                      ? product.piece_price
                      : hasPack
                      ? product.price / product.pieces_per_pack
                      : null;
                  const packProfit = product.price - product.cost_price;
                  const isSelected = idx === focusedIndex;
                  const isFlashing = flashId === product.id || flashId === `${product.id}__piece`;

                  return (
                    <TableRow
                      key={product.id}
                      ref={isSelected ? focusedRowRef : undefined}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      className={[
                        'border-b border-border transition-all duration-100 cursor-pointer group',
                        isFlashing
                          ? 'bg-emerald-100 dark:bg-emerald-900/40'
                          : isSelected
                          ? 'bg-primary/8 ring-1 ring-inset ring-primary/30'
                          : 'hover:bg-muted/40',
                      ].join(' ')}
                    >
                      {/* # */}
                      <TableCell className="py-2.5 px-3 border-r border-border text-xs text-muted-foreground font-mono" onClick={() => addToCart(product)}>
                        {String(idx + 1).padStart(2, '0')}
                      </TableCell>

                      {/* Product name + badges */}
                      <TableCell className="py-2.5 px-3 border-r border-border" onClick={() => addToCart(product)}>
                        <p className={`font-semibold text-sm leading-tight transition-colors ${isSelected ? 'text-primary' : 'group-hover:text-primary'}`}>
                          {product.name}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {product.quantity <= (product.low_stock_threshold ?? 5) && product.quantity > 0 && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">Low stock</span>
                          )}
                          {inCart && (
                            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-1.5 py-0.5">✓ {inCart.quantity} in cart</span>
                          )}
                          {inCartPiece && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">✓ {inCartPiece.quantity} pcs</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Pack S.P */}
                      <TableCell className="py-2.5 px-3 border-r border-border text-right font-bold text-primary" onClick={() => addToCart(product)}>
                        {formatKES(product.price)}
                      </TableCell>

                      {/* Ratio */}
                      <TableCell className="py-2.5 px-3 border-r border-border text-center" onClick={() => addToCart(product)}>
                        {hasPack ? (
                          <div className="leading-tight">
                            <span className="font-bold text-sm">{product.pieces_per_pack}</span>
                            {product.pack_name && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-[68px] mx-auto">{product.pack_name}</div>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>

                      {/* Piece S.P */}
                      <TableCell className="py-2.5 px-3 border-r border-border text-right" onClick={() => addToCart(product)}>
                        {effectivePieceSP != null
                          ? <span className="font-semibold text-amber-600">{formatKES(effectivePieceSP)}</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>

                      {/* Profit */}
                      <TableCell className="py-2.5 px-3 border-r border-border text-right" onClick={() => addToCart(product)}>
                        <span className={`font-semibold text-sm ${packProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                          {formatKES(packProfit)}
                        </span>
                      </TableCell>

                      {/* Qty */}
                      <TableCell
                        className={`py-2.5 px-3 border-r border-border text-center font-semibold text-sm ${
                          product.quantity < 1 ? 'text-destructive' : product.quantity <= (product.low_stock_threshold ?? 5) ? 'text-amber-500' : ''
                        }`}
                        onClick={() => addToCart(product)}
                      >
                        <div className="leading-tight">
                          <span>{Number.isInteger(product.quantity) ? product.quantity : product.quantity.toFixed(2)}</span>
                          {hasPack && product.quantity > 0 && (
                            <div className="text-[10px] text-muted-foreground font-normal">
                              {Math.floor(product.quantity * product.pieces_per_pack)} pcs
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-2 px-2 text-center">
                        <div className="flex flex-col gap-1 items-stretch">
                          <button
                            onClick={() => addToCart(product)}
                            className="inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-white bg-primary hover:bg-primary/90 active:scale-95 rounded-md px-2 py-1 transition-all"
                          >
                            <Plus size={10} />
                            {hasPack ? product.pack_name || 'Pack' : 'Add'}
                          </button>
                          {hasPack && effectivePieceSP != null && (
                            <button
                              onClick={e => { e.stopPropagation(); addToCart(product, true); }}
                              className="inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 active:scale-95 rounded-md px-2 py-1 transition-all"
                            >
                              <Plus size={10} />
                              Piece
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Package size={28} />
                        <p>{t('sales.noProductsFound')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />

      {/* QR Code overlay for mobile scanner */}
      {qrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="relative bg-white rounded-3xl p-6 flex flex-col items-center gap-4 shadow-2xl mx-4 max-w-xs w-full"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setQrOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 text-gray-800">
              <QrCode size={18} />
              <span className="font-semibold text-sm">Mobile Scanner</span>
            </div>

            {scannerUrl ? (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(scannerUrl)}&bgcolor=ffffff&color=000000&margin=10`}
                alt="QR code"
                width={240}
                height={240}
                className="rounded-xl"
              />
            ) : (
              <div className="w-[240px] h-[240px] rounded-xl bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                Only available in desktop app
              </div>
            )}

            {scannerUrl && (
              <p className="text-[11px] text-gray-500 font-mono text-center break-all">{scannerUrl}</p>
            )}

            <p className="text-xs text-gray-500 text-center">
              Scan with your phone camera.<br/>
              Phone must be on the same Wi-Fi.
            </p>

            <button
              onClick={() => setQrOpen(false)}
              className="w-full py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* Print Receipt Prompt — No is focused so Enter = skip */}
      <Dialog open={printPromptOpen} onOpenChange={(open) => { if (!open) setPrintPromptOpen(false); }}>
        <DialogContent
          className="max-w-sm w-[90vw]"
          onOpenAutoFocus={(e) => { e.preventDefault(); setTimeout(() => noBtnRef.current?.focus(), 50); }}
        >
          <DialogHeader>
            <DialogTitle className="text-center">Print Receipt?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-center">Would you like to print a receipt for this sale?</p>
          <div className="flex gap-3 mt-2">
            <Button
              ref={noBtnRef}
              variant="outline"
              className="flex-1"
              onClick={() => setPrintPromptOpen(false)}
            >
              No
            </Button>
            <Button
              className="flex-1 gradient-primary border-0"
              onClick={() => { setPrintPromptOpen(false); setReceiptOpen(true); }}
            >
              Yes, Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        receipt={receiptData}
      />
    </div>
  );
}
