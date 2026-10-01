import { useState, useRef } from 'react';
import { useShopSettings } from '@/hooks/useShopSettings';
import { useTranslation } from 'react-i18next';
import { useProducts, useAddProduct, useUpdateProduct, useDeleteProduct } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProductCategories } from '@/hooks/useProductCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Pencil, Trash2, FileSpreadsheet, Upload, MoreVertical, ChevronDown, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { exportToExcel } from '@/lib/excelExport';
import * as XLSX from 'xlsx';
import { useCurrencySettings, formatCurrency, toBaseCurrency } from '@/hooks/useCurrencySettings';


const COMMON_UNITS = ['pcs', 'kg', 'l', 'box', 'carton'];
const ALL_UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'box', 'pack', 'dozen', 'bag', 'bottle', 'carton', 'tray', 'roll'];

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, hint, open, onToggle, children }: {
  title: string; hint?: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-3 text-start">
        <span>
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          {hint && !open && <span className="block text-xs text-muted-foreground">{hint}</span>}
        </span>
        <ChevronDown size={18} className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-3 border-t border-border p-3">{children}</div>}
    </div>
  );
}

function ProductForm({ product, suppliers, categories, onSubmit, isPending, onCancel, onDelete, currency, className }: {
  product?: any;
  suppliers: any[];
  categories: string[];
  onSubmit: (data: any) => void;
  isPending: boolean;
  onCancel?: () => void;
  onDelete?: () => void;
  currency?: any;
  className?: string;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: product?.name || '',
    price: product?.price ?? '',
    cost_price: product?.cost_price ?? '',
    quantity: product?.quantity ?? '',
    category: product?.category || '',
    description: product?.description || '',
    barcode: product?.barcode || '',
    expiry_date: product?.expiry_date || '',
    low_stock_threshold: product?.low_stock_threshold ?? 5,
    supplier_id: product?.supplier_id || '',
    unit: product?.unit || 'pcs',
    pack_name: product?.pack_name || '',
    pieces_per_pack: product?.pieces_per_pack || '',
    piece_price: product?.piece_price || '',
  });
  const hasPackInitially = !!(product?.pack_name || product?.pieces_per_pack > 0);
  const [packOpen, setPackOpen] = useState(hasPackInitially);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [otherUnit, setOtherUnit] = useState(() => !!product?.unit && !COMMON_UNITS.includes(product.unit));

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const price = Number(form.price);
  const cost = Number(form.cost_price);
  const ppp = Number(form.pieces_per_pack);
  const profit = price - cost;
  const margin = price > 0 ? (profit / price) * 100 : 0;
  const packLabel = form.pack_name.trim();
  const buyingLabel = currency && currency.purchase_currency !== currency.base_currency
    ? `${t('products.buyingPrice', 'Buying price')} (${currency.purchase_currency})`
    : t('products.buyingPrice', 'Buying price');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: form.name.trim(),
      price,
      cost_price: cost,
      quantity: Number(form.quantity),
      category: form.category || null,
      description: form.description || null,
      barcode: form.barcode || null,
      expiry_date: form.expiry_date || null,
      low_stock_threshold: Number(form.low_stock_threshold),
      supplier_id: form.supplier_id || null,
      unit: form.unit || 'pcs',
      pack_name: form.pack_name || null,
      pieces_per_pack: ppp || 0,
      // Auto-derive piece selling price from pack price ÷ ratio when not manually set
      piece_price: Number(form.piece_price) > 0
        ? Number(form.piece_price)
        : (ppp > 0 ? price / ppp : 0),
    });
  };

  const numInput = 'h-11 text-base';

  return (
    <form onSubmit={handleSubmit} className={cn('flex min-h-0 flex-1 flex-col', className)}>
      {/* Scrollable body */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {/* Essentials */}
        <Field label={`${t('products.nameLabel', 'Product name')} *`}>
          <Input className={numInput} value={form.name} onChange={e => update('name', e.target.value)} required autoComplete="off" />
        </Field>

        <Field label={t('common.category')}>
          <Select value={form.category} onValueChange={v => update('category', v)}>
            <SelectTrigger className="h-11 text-base"><SelectValue placeholder={t('products.selectCategory', 'Select category')} /></SelectTrigger>
            <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`${buyingLabel}${packLabel ? ` · ${packLabel}` : ''} *`}>
            <Input className={numInput} inputMode="decimal" type="number" min="0" step="0.01" value={form.cost_price}
              onChange={e => update('cost_price', e.target.value)} required />
          </Field>
          <Field label={`${t('products.sellingPriceLabel', 'Selling price')}${packLabel ? ` · ${packLabel}` : ''} *`}>
            <Input className={numInput} inputMode="decimal" type="number" min="0" step="0.01" value={form.price}
              onChange={e => update('price', e.target.value)} required />
          </Field>
        </div>

        {price > 0 && cost > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t('products.profit', 'Profit')}</span>
            <span className={cn('font-semibold', profit >= 0 ? 'text-success' : 'text-destructive')}>
              {fmt(profit)} <span className="font-normal text-muted-foreground">· {margin.toFixed(1)}% {t('products.margin', 'margin')}</span>
            </span>
          </div>
        )}

        <Field label={`${t('common.quantity')} *`}>
          <Input className={numInput} inputMode="decimal" type="number" min="0" step="any" value={form.quantity}
            onChange={e => update('quantity', e.target.value)} required />
        </Field>

        <Field label={t('products.unit', 'Unit')}>
          <div className="flex flex-wrap gap-2">
            {COMMON_UNITS.map(u => (
              <button key={u} type="button"
                onClick={() => { update('unit', u); setOtherUnit(false); }}
                className={cn('h-10 rounded-full border px-4 text-sm font-medium transition-colors',
                  !otherUnit && form.unit === u ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground')}>
                {u}
              </button>
            ))}
            <button type="button" onClick={() => setOtherUnit(true)}
              className={cn('h-10 rounded-full border px-4 text-sm font-medium transition-colors',
                otherUnit ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground')}>
              {t('products.other', 'Other')}
            </button>
          </div>
          {otherUnit && (
            <Select value={COMMON_UNITS.includes(form.unit) ? '' : form.unit} onValueChange={v => update('unit', v)}>
              <SelectTrigger className="mt-2 h-11 text-base"><SelectValue placeholder={t('products.chooseUnit', 'Choose unit')} /></SelectTrigger>
              <SelectContent>
                {ALL_UNITS.filter(u => !COMMON_UNITS.includes(u)).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                {product?.unit && !ALL_UNITS.includes(product.unit) && <SelectItem value={product.unit}>{product.unit}</SelectItem>}
              </SelectContent>
            </Select>
          )}
        </Field>

        {/* Pack / piece pricing (collapsed) */}
        <Section
          title={t('products.packPricing', 'Pack / piece pricing')}
          hint={t('products.packHint', 'Optional · sell single pieces from a pack')}
          open={packOpen} onToggle={() => setPackOpen(o => !o)}>
          <Field label={t('products.packName', 'Pack name')}>
            <Input className={numInput} placeholder="Carton, Dozen, Box…" value={form.pack_name} onChange={e => update('pack_name', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('products.piecesPerPack', 'Pieces per pack')}>
              <Input className={numInput} inputMode="numeric" type="number" min="0" step="1" value={form.pieces_per_pack}
                onChange={e => update('pieces_per_pack', e.target.value)} />
            </Field>
            <Field label={t('products.piecePrice', 'Piece selling price')}>
              <Input className={numInput} inputMode="decimal" type="number" min="0" step="0.01" placeholder="auto" value={form.piece_price}
                onChange={e => update('piece_price', e.target.value)} />
            </Field>
          </div>
          {ppp > 0 && (
            <div className="space-y-0.5 text-xs text-muted-foreground">
              {cost > 0 && <p>{t('products.pieceBuying', 'Piece buying price')}: <strong className="text-foreground">{fmt(cost / ppp)}</strong></p>}
              {!form.piece_price && price > 0 && <p>{t('products.pieceSellingAuto', 'Piece selling price (auto)')}: <strong className="text-foreground">{fmt(price / ppp)}</strong></p>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {t('products.packNote', 'Leave pieces per pack empty or 0 to turn off piece sales.')}
          </p>
        </Section>

        {/* More details (collapsed) */}
        <Section title={t('products.moreDetails', 'More details')}
          hint={t('products.moreHint', 'Barcode, supplier, expiry, low-stock alert, description')}
          open={moreOpen} onToggle={() => setMoreOpen(o => !o)}>
          <Field label={t('products.barcode')}>
            <div className="flex gap-2">
              <Input className={numInput} value={form.barcode} onChange={e => update('barcode', e.target.value)} inputMode="numeric" />
              <Button type="button" variant="outline" className="h-11 shrink-0 gap-1" onClick={() => setScannerOpen(true)}>
                <ScanLine size={18} /> {t('products.scan', 'Scan')}
              </Button>
            </div>
          </Field>
          <Field label={t('products.supplier', 'Supplier')}>
            <Select value={form.supplier_id} onValueChange={v => update('supplier_id', v)}>
              <SelectTrigger className="h-11 text-base"><SelectValue placeholder={t('products.supplierOptional', 'Optional')} /></SelectTrigger>
              <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('products.expiry')}>
              <Input className={numInput} type="date" value={form.expiry_date} onChange={e => update('expiry_date', e.target.value)} />
            </Field>
            <Field label={t('products.lowStockAlert', 'Low stock alert')}>
              <Input className={numInput} inputMode="numeric" type="number" min="0" value={form.low_stock_threshold}
                onChange={e => update('low_stock_threshold', e.target.value)} />
            </Field>
          </div>
          <Field label={t('common.description')}>
            <Input className={numInput} value={form.description} onChange={e => update('description', e.target.value)} />
          </Field>
        </Section>

        {/* Delete (edit only) */}
        {product && onDelete && (
          <Button type="button" variant="destructive" className="h-11 w-full gap-2" onClick={onDelete}>
            <Trash2 size={16} /> {t('products.deleteProduct', 'Delete product')}
          </Button>
        )}
      </div>

      {/* Sticky footer */}
      <div className="flex shrink-0 gap-2 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} className="h-11 flex-1">{t('common.cancel')}</Button>}
        <Button type="submit" className="h-11 flex-1 gradient-primary border-0" disabled={isPending}>
          {isPending ? t('common.saving', 'Saving...') : product ? t('common.update', 'Update') : t('products.addProduct', 'Add product')}
        </Button>
      </div>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)}
        onScan={(code) => { update('barcode', code); setScannerOpen(false); }} />
    </form>
  );
}

function StockBadge({ product }: { product: any }) {
  const { t } = useTranslation();
  const qty = Number.isInteger(product.quantity) ? product.quantity : Number(product.quantity).toFixed(2);
  const out = product.quantity < 1;
  const low = !out && product.quantity <= product.low_stock_threshold;
  return (
    <span className={cn(
      'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
      out ? 'bg-destructive/15 text-destructive' : low ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground',
    )}>
      {out ? t('products.outOfStock', 'Out of stock') : `${qty} ${product.unit || 'pcs'}${low ? ` · ${t('products.low', 'Low')}` : ''}`}
    </span>
  );
}

function ProductCard({ product, onEdit, onDelete }: { product: any; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  const hasPack = product.pieces_per_pack > 0;
  const piecePrice = product.piece_price > 0 ? product.piece_price : (hasPack ? product.price / product.pieces_per_pack : 0);
  return (
    <div role="button" tabIndex={0} onClick={onEdit}
      onKeyDown={e => { if (e.key === 'Enter') onEdit(); }}
      className="rounded-xl border border-border bg-card p-3 shadow-sm active:bg-muted/50">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-card-foreground">{product.name}</p>
          <p className="truncate text-xs text-muted-foreground">{product.category || '—'}</p>
        </div>
        <StockBadge product={product} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-me-1 h-8 w-8 shrink-0" onClick={e => e.stopPropagation()}
              aria-label={t('common.actions')}>
              <MoreVertical size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
            <DropdownMenuItem onClick={onEdit}><Pencil size={14} className="me-2" /> {t('common.edit', 'Edit')}</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 size={14} className="me-2" /> {t('common.delete', 'Delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-3 grid grid-cols-3 items-end gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground">{t('products.sellingPriceLabel', 'Selling price')}</p>
          <p className="text-xl font-bold leading-tight text-success">{fmt(product.price)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">{t('products.buyingPrice', 'Buying price')}</p>
          <p className="text-sm font-medium text-card-foreground">{fmt(product.cost_price)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">{t('products.profit', 'Profit')}</p>
          <p className={cn('text-sm font-medium', product.price - product.cost_price >= 0 ? 'text-success' : 'text-destructive')}>
            {fmt(product.price - product.cost_price)}
          </p>
        </div>
      </div>
      {(product.pack_name || hasPack) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {product.pack_name || t('products.pack', 'Pack')}{hasPack && ` × ${product.pieces_per_pack} · ${t('products.piece', 'piece')} ${fmt(piecePrice)}`}
        </p>
      )}
    </div>
  );
}

export default function Products() {
  const { data: shopSettings } = useShopSettings();
  const { data: currency } = useCurrencySettings();
  const isDualCurrency = currency && currency.show_dual_price && currency.purchase_currency !== currency.base_currency;
  const { t } = useTranslation();
  const { data: products, isLoading } = useProducts();
  const { data: suppliers } = useSuppliers();
  const { data: productCategories } = useProductCategories();
  const categoryList = (productCategories || []).map(c => c.name);
  const addProduct = useAddProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetProductId, setSheetProductId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '', price: '', cost_price: '', quantity: '', category: '',
    barcode: '', expiry_date: '', low_stock_threshold: '5', supplier_id: '', description: '',
    pack_name: '', pieces_per_pack: '', piece_price: '', unit: 'pcs',
  });

  const searchRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLButtonElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!importRef.current) return;
    importRef.current.value = '';
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      if (!rows.length) { toast.error('No data found in file'); return; }
      let imported = 0;
      for (const row of rows) {
        const name = row['Name'] || row['name'];
        const price = Number(row['Selling Price'] || row['price'] || 0);
        const cost_price = Number(row['Cost Price'] || row['cost_price'] || 0);
        if (!name || !price || !cost_price) continue;
        await addProduct.mutateAsync({
          name,
          price,
          cost_price,
          quantity: Number(row['Quantity'] || row['quantity'] || 0),
          category: row['Category'] || row['category'] || null,
          description: row['Description'] || row['description'] || null,
          barcode: row['Barcode'] || row['barcode'] || null,
          expiry_date: row['Expiry Date'] || row['expiry_date'] || null,
          low_stock_threshold: Number(row['Low Stock Alert'] || row['low_stock_threshold'] || 5),
          supplier_id: null,
          image_url: null,
          pack_name: row['Pack Name'] || row['pack_name'] || null,
          pieces_per_pack: Number(row['Pieces Per Pack'] || row['pieces_per_pack'] || 0),
          piece_price: Number(row['Piece Price'] || row['piece_price'] || 0),
          unit: row['Unit'] || row['unit'] || 'pcs',
        });
        imported++;
      }
      toast.success(`Imported ${imported} product${imported !== 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error('Import failed: ' + err.message);
    }
  };

  const filtered = (products || []).filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search);
    const matchesCategory =
      categoryFilter === 'all' ? true
      : categoryFilter === '__low' ? (p.quantity >= 1 && p.quantity <= p.low_stock_threshold)
      : categoryFilter === '__out' ? p.quantity < 1
      : p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const sheetProduct = sheetProductId ? (products || []).find(p => p.id === sheetProductId) : undefined;
  const closeSheet = () => { setSheetOpen(false); setSheetProductId(null); };
  const openAddSheet = () => { setSheetProductId(null); setSheetOpen(true); };
  const openEditSheet = (id: string) => { setSheetProductId(id); setSheetOpen(true); };
  const handleAddClick = () => { if (isMobile) openAddSheet(); else setIsAdding(true); };
  const handleEditClick = (id: string) => { if (isMobile) openEditSheet(id); else setEditingId(id); };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const firstRow = tableRef.current?.querySelector('tbody tr') as HTMLElement;
      firstRow?.focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      filterRef.current?.focus();
    }
  };

  const handleInlineAdd = async () => {
    if (!newProduct.name || !newProduct.price || !newProduct.cost_price) {
      toast.error(t('products.requiredFields'));
      return;
    }
    try {
      await addProduct.mutateAsync({
        name: newProduct.name,
        price: Number(newProduct.price),
        cost_price: Number(newProduct.cost_price),
        quantity: Number(newProduct.quantity) || 0,
        category: newProduct.category || null,
        barcode: newProduct.barcode || null,
        expiry_date: newProduct.expiry_date || null,
        low_stock_threshold: Number(newProduct.low_stock_threshold) || 5,
        supplier_id: newProduct.supplier_id || null,
        unit: newProduct.unit || 'pcs',
        description: newProduct.description || null,
        image_url: null,
        pack_name: newProduct.pack_name || null,
        pieces_per_pack: Number(newProduct.pieces_per_pack) || 0,
        piece_price: Number(newProduct.piece_price) > 0
          ? Number(newProduct.piece_price)
          : (Number(newProduct.pieces_per_pack) > 0 ? Number(newProduct.price) / Number(newProduct.pieces_per_pack) : 0),
      });
      toast.success(t('products.added'));
      setNewProduct({ name: '', price: '', cost_price: '', quantity: '', category: '', barcode: '', expiry_date: '', low_stock_threshold: '5', supplier_id: '', description: '', pack_name: '', pieces_per_pack: '', piece_price: '', unit: 'pcs' });
      setIsAdding(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleUpdate = async (id: string, data: any) => {
    try {
      await updateProduct.mutateAsync({ id, ...data });
      toast.success(t('products.updated'));
      setEditingId(null);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSheetSubmit = async (data: any) => {
    try {
      if (sheetProductId) {
        await updateProduct.mutateAsync({ id: sheetProductId, ...data });
        toast.success(t('products.updated'));
      } else {
        await addProduct.mutateAsync({ ...data, image_url: null });
        toast.success(t('products.added'));
      }
      closeSheet();
    } catch (err: any) { toast.error(err.message); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await handleDelete(id);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct.mutateAsync(id);
      toast.success(t('products.deleted'));
      if (sheetProductId === id) closeSheet();
    } catch (err: any) {
      if (err.message?.includes('foreign key constraint') || err.message?.includes('sale_items')) {
        toast.error(t('products.cantDelete'));
      } else {
        toast.error(err.message);
      }
    }
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const rows = tableRef.current?.querySelectorAll('tbody tr') as NodeListOf<HTMLElement>;
      rows?.[index + 1]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index === 0) searchRef.current?.focus();
      else {
        const rows = tableRef.current?.querySelectorAll('tbody tr') as NodeListOf<HTMLElement>;
        rows?.[index - 1]?.focus();
      }
    }
  };

  const handleExportExcel = () => {
    const rows = (products || []).map(p => ({
      [t('common.name')]: p.name,
      [t('common.category')]: p.category || '',
      [t('products.sellingPrice')]: p.price,
      [t('products.costPrice')]: p.cost_price,
      [t('common.quantity')]: p.quantity,
      Unit: p.unit || 'pcs',
      [t('products.lowStockAt')]: p.low_stock_threshold,
      [t('products.barcode')]: p.barcode || '',
      [t('products.expiry')]: p.expiry_date || '',
      [t('nav.suppliers')]: p.suppliers?.name || '',
      [t('common.description')]: p.description || '',
    }));
    exportToExcel(`${shopSettings?.shop_name || 'Shop'}_Products`, [{ name: t('products.title'), rows }]);
    toast.success(t('common.excelDownloaded'));
  };

  const updateNew = (field: string, value: string) => setNewProduct(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('products.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('customers.total', { count: products?.length || 0 })}</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
          {/* Desktop actions */}
          <Button variant="outline" className="hidden gap-1 md:inline-flex" onClick={() => importRef.current?.click()}>
            <Upload size={16} /> Import
          </Button>
          <Button variant="outline" className="hidden gap-1 md:inline-flex" onClick={handleExportExcel}>
            <FileSpreadsheet size={16} /> {t('common.excel')}
          </Button>
          <Button className="hidden gradient-primary border-0 gap-1 md:inline-flex" onClick={handleAddClick}>
            <Plus size={16} /> {t('common.add')}
          </Button>
          {/* Mobile overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label={t('common.more', 'More')}>
                <MoreVertical size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => importRef.current?.click()}><Upload size={14} className="me-2" /> Import</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel}><FileSpreadsheet size={14} className="me-2" /> {t('common.excel')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Pinned search + filters */}
      <div className="sticky top-[52px] z-30 -mx-3 space-y-2 bg-background/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4 md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder={t('products.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="ps-9"
            />
          </div>
          {/* Desktop dropdown */}
          <div className="hidden md:block">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger ref={filterRef} className="w-40 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('sales.allCategories')}</SelectItem>
                <SelectItem value="__low">{t('products.lowStock', 'Low stock')}</SelectItem>
                <SelectItem value="__out">{t('products.outOfStock', 'Out of stock')}</SelectItem>
                {categoryList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Mobile chips */}
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { v: 'all', label: t('sales.allCategories', 'All') },
            { v: '__low', label: t('products.lowStock', 'Low stock') },
            { v: '__out', label: t('products.outOfStock', 'Out of stock') },
            ...categoryList.map(c => ({ v: c, label: c })),
          ].map(chip => (
            <button key={chip.v} type="button" onClick={() => setCategoryFilter(chip.v)}
              className={cn('h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors',
                categoryFilter === chip.v
                  ? chip.v === '__out' ? 'border-destructive bg-destructive text-destructive-foreground'
                    : chip.v === '__low' ? 'border-warning bg-warning text-white'
                    : 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground')}>
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>}

      {/* Mobile cards */}
      {!isLoading && (
        <div className="space-y-2 md:hidden">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product}
              onEdit={() => openEditSheet(product.id)}
              onDelete={() => setDeleteTarget(product)} />
          ))}
        </div>
      )}

      {/* Desktop table */}
      {!isLoading && (
        <div className="hidden md:block rounded-lg border border-border overflow-x-auto max-w-full">
          <Table ref={tableRef} className="min-w-[900px]">
            <TableHeader>
              <TableRow className="border-b border-border">
                <TableHead className="border-r border-border w-16">#</TableHead>
                <TableHead className="border-r border-border">{t('common.name')}</TableHead>
                <TableHead className="border-r border-border">{t('common.category')}</TableHead>
                <TableHead className="border-r border-border text-right">Pack B.P</TableHead>
                <TableHead className="border-r border-border text-right">Pack S.P</TableHead>
                <TableHead className="border-r border-border text-center">Ratio</TableHead>
                <TableHead className="border-r border-border text-right">Piece B.P</TableHead>
                <TableHead className="border-r border-border text-right">Piece S.P</TableHead>
                <TableHead className="border-r border-border text-right">Profit</TableHead>
                <TableHead className="border-r border-border text-center">{t('products.qty')}</TableHead>
                <TableHead className="border-r border-border text-center">Unit</TableHead>
                <TableHead className="w-24 text-center">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAdding && (
                <TableRow className="border-b border-border bg-primary/5">
                  <TableCell className="border-r border-border text-muted-foreground font-mono text-xs">NEW</TableCell>
                  <TableCell className="border-r border-border p-1">
                    <Input placeholder={t('products.nameRequired')} value={newProduct.name} onChange={e => updateNew('name', e.target.value)} className="h-8 text-sm" autoFocus />
                  </TableCell>
                  <TableCell className="border-r border-border p-1">
                    <Select value={newProduct.category} onValueChange={v => updateNew('category', v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{categoryList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  {/* Pack B.P */}
                  <TableCell className="border-r border-border p-1">
                    <Input placeholder="0" type="number" min="0" step="0.01" value={newProduct.cost_price} onChange={e => updateNew('cost_price', e.target.value)}
                      className="h-8 text-sm text-right [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" />
                  </TableCell>
                  {/* Pack S.P */}
                  <TableCell className="border-r border-border p-1">
                    <Input placeholder="0" type="number" min="0" step="0.01" value={newProduct.price} onChange={e => updateNew('price', e.target.value)}
                      className="h-8 text-sm text-right [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" />
                  </TableCell>
                  {/* Ratio */}
                  <TableCell className="border-r border-border p-1">
                    <Input placeholder="—" type="number" min="0" step="1" value={newProduct.pieces_per_pack} onChange={e => updateNew('pieces_per_pack', e.target.value)}
                      className="h-8 text-sm text-center [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" title="Pieces per pack (ratio)" />
                  </TableCell>
                  {/* Piece B.P (auto) */}
                  <TableCell className="border-r border-border p-1 text-right text-xs text-muted-foreground">
                    {newProduct.cost_price && Number(newProduct.pieces_per_pack) > 0
                      ? (Number(newProduct.cost_price) / Number(newProduct.pieces_per_pack)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : '—'}
                  </TableCell>
                  {/* Piece S.P */}
                  <TableCell className="border-r border-border p-1">
                    <Input placeholder="auto" type="number" min="0" step="0.01" value={newProduct.piece_price} onChange={e => updateNew('piece_price', e.target.value)}
                      className="h-8 text-sm text-right [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]" title="Piece selling price (leave blank to auto-calc)" />
                  </TableCell>
                  {/* Profit */}
                  <TableCell className="border-r border-border p-1 text-right text-sm font-semibold text-success">
                    {newProduct.price && newProduct.cost_price ? (Number(newProduct.price) - Number(newProduct.cost_price)).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="border-r border-border p-1">
                    <Input placeholder="0" type="number" min="0" value={newProduct.quantity} onChange={e => updateNew('quantity', e.target.value)}
                      className="h-8 text-sm text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" />
                  </TableCell>
                  <TableCell className="border-r border-border p-1">
                    <Select value={newProduct.unit} onValueChange={v => updateNew('unit', v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['pcs','kg','g','l','ml','box','pack','dozen','bag','bottle','carton','tray','roll','other'].map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center p-1">
                    <div className="flex justify-center gap-1">
                      <Button size="sm" className="h-7 text-xs gradient-primary border-0" onClick={handleInlineAdd} disabled={addProduct.isPending}>
                        {addProduct.isPending ? '...' : t('common.save')}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsAdding(false)}>✕</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((product, index) => (
                <TableRow
                  key={product.id}
                  tabIndex={0}
                  onKeyDown={(e) => handleRowKeyDown(e, index + (isAdding ? 1 : 0))}
                  className="border-b border-border focus:bg-primary/5 focus:outline-none"
                >
                  {editingId === product.id ? (
                    <TableCell colSpan={12} className="p-0">
                      <ProductForm
                        className="max-h-[70vh]"
                        product={product}
                        suppliers={suppliers || []}
                        categories={categoryList}
                        onSubmit={(data) => handleUpdate(product.id, data)}
                        isPending={updateProduct.isPending}
                        onCancel={() => setEditingId(null)}
                        onDelete={() => setDeleteTarget(product)}
                        currency={currency}
                      />
                    </TableCell>
                  ) : (
                    <>
                      <TableCell className="border-r border-border font-mono text-muted-foreground text-xs">
                        #{String(index + 1).padStart(3, '0')}
                      </TableCell>
                      <TableCell className="border-r border-border font-medium text-card-foreground">
                        {product.name}
                      </TableCell>
                      <TableCell className="border-r border-border text-sm text-muted-foreground">
                        {product.category || '—'}
                      </TableCell>
                      {/* Pack B.P */}
                      <TableCell className="border-r border-border text-right text-sm text-muted-foreground">
                        {isDualCurrency ? (
                          <div className="leading-tight">
                            <div>{formatCurrency(product.cost_price / (currency?.exchange_rate || 1), currency!.purchase_currency)}</div>
                            <div className="text-xs text-muted-foreground/70">≈ {product.cost_price.toLocaleString()} {currency!.base_currency}</div>
                          </div>
                        ) : product.cost_price.toLocaleString()}
                      </TableCell>
                      {/* Pack S.P */}
                      <TableCell className="border-r border-border text-right font-semibold text-primary">
                        {product.price.toLocaleString()}
                      </TableCell>
                      {/* Ratio */}
                      <TableCell className="border-r border-border text-center text-sm">
                        {product.pieces_per_pack > 0 ? (
                          <span className="font-medium">{product.pieces_per_pack}</span>
                        ) : '—'}
                      </TableCell>
                      {/* Piece B.P (derived: cost_price / ratio) */}
                      <TableCell className="border-r border-border text-right text-sm text-muted-foreground">
                        {product.pieces_per_pack > 0
                          ? (product.cost_price / product.pieces_per_pack).toLocaleString(undefined, { maximumFractionDigits: 2 })
                          : '—'}
                      </TableCell>
                      {/* Piece S.P */}
                      <TableCell className="border-r border-border text-right text-sm">
                        {product.pieces_per_pack > 0 ? (
                          product.piece_price > 0
                            ? product.piece_price.toLocaleString()
                            : <span className="text-muted-foreground italic text-xs">{(product.price / product.pieces_per_pack).toLocaleString(undefined, { maximumFractionDigits: 2 })} (auto)</span>
                        ) : '—'}
                      </TableCell>
                      {/* Profit (pack level) */}
                      <TableCell className="border-r border-border text-right font-semibold text-success">
                        {(product.price - product.cost_price).toLocaleString()}
                      </TableCell>
                      <TableCell className="border-r border-border text-center">
                        <span className={product.quantity < 1 ? 'text-destructive font-semibold' : product.quantity <= product.low_stock_threshold ? 'text-amber-500 font-semibold' : ''}>
                          {Number.isInteger(product.quantity) ? product.quantity : product.quantity.toFixed(2)}
                        </span>
                        {product.pieces_per_pack > 0 && product.quantity > 0 && !Number.isInteger(product.quantity) && (
                          <div className="text-[10px] text-muted-foreground">{Math.floor(product.quantity * product.pieces_per_pack)} pcs left</div>
                        )}
                      </TableCell>
                      <TableCell className="border-r border-border text-center text-sm text-muted-foreground">
                        {product.unit || 'pcs'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditClick(product.id)}><Pencil size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(product)}><Trash2 size={14} /></Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && filtered.length === 0 && !isAdding && (
        <p className="text-center text-muted-foreground py-8">
          {search || categoryFilter !== 'all' ? 'No products found' : 'No products yet. Add your first one!'}
        </p>
      )}

      {/* Floating add button (mobile) */}
      {!sheetOpen && (
        <Button onClick={openAddSheet} aria-label={t('common.add')}
          className="fixed end-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 h-14 w-14 rounded-full gradient-primary border-0 p-0 shadow-lg md:hidden">
          <Plus size={26} />
        </Button>
      )}

      {/* Add / Edit bottom sheet (mobile) */}
      <Sheet open={isMobile && sheetOpen} onOpenChange={(o) => { if (!o) closeSheet(); }}>
        <SheetContent side="bottom" className="flex h-[92dvh] flex-col gap-0 rounded-t-2xl p-0">
          <SheetHeader className="shrink-0 border-b border-border px-4 py-3 text-start">
            <SheetTitle>{sheetProduct ? t('products.editProduct', 'Edit product') : t('products.addProduct', 'Add product')}</SheetTitle>
            <SheetDescription className="sr-only">{t('products.formDescription', 'Product details')}</SheetDescription>
          </SheetHeader>
          {sheetOpen && (
            <ProductForm
              key={sheetProductId ?? 'new'}
              product={sheetProduct}
              suppliers={suppliers || []}
              categories={categoryList}
              onSubmit={handleSheetSubmit}
              isPending={addProduct.isPending || updateProduct.isPending}
              onCancel={closeSheet}
              onDelete={sheetProduct ? () => setDeleteTarget(sheetProduct) : undefined}
              currency={currency}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('products.deleteProduct', 'Delete product')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `${deleteTarget.name} — ` : ''}{t('products.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
