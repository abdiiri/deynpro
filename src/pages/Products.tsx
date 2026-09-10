import { useState, useRef } from 'react';
import { useShopSettings } from '@/hooks/useShopSettings';
import { useTranslation } from 'react-i18next';
import { useProducts, useAddProduct, useUpdateProduct, useDeleteProduct } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProductCategories } from '@/hooks/useProductCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Pencil, Trash2, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { exportToExcel } from '@/lib/excelExport';
import * as XLSX from 'xlsx';
import { useCurrencySettings, formatCurrency, toBaseCurrency } from '@/hooks/useCurrencySettings';


function ProductForm({ product, suppliers, categories, onSubmit, isPending, onCancel, currency }: {
  product?: any;
  suppliers: any[];
  categories: string[];
  onSubmit: (data: any) => void;
  isPending: boolean;
  onCancel?: () => void;
  currency?: any;
}) {
  const [form, setForm] = useState({
    name: product?.name || '',
    price: product?.price || '',
    cost_price: product?.cost_price || '',
    quantity: product?.quantity ?? '',
    category: product?.category || '',
    description: product?.description || '',
    barcode: product?.barcode || '',
    expiry_date: product?.expiry_date || '',
    low_stock_threshold: product?.low_stock_threshold ?? 5,
    supplier_id: product?.supplier_id || '',
    unit: product?.unit || 'pcs',
    pack_name: product?.pack_name || '',
    pieces_per_pack: product?.pieces_per_pack ?? '',
    piece_price: product?.piece_price ?? '',
  });

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: form.name,
      price: Number(form.price),
      cost_price: Number(form.cost_price),
      quantity: Number(form.quantity),
      category: form.category || null,
      description: form.description || null,
      barcode: form.barcode || null,
      expiry_date: form.expiry_date || null,
      low_stock_threshold: Number(form.low_stock_threshold),
      supplier_id: form.supplier_id || null,
      unit: form.unit || 'pcs',
      pack_name: form.pack_name || null,
      pieces_per_pack: Number(form.pieces_per_pack) || 0,
      // Auto-derive piece selling price from pack price ÷ ratio when not manually set
      piece_price: Number(form.piece_price) > 0
        ? Number(form.piece_price)
        : (Number(form.pieces_per_pack) > 0 ? Number(form.price) / Number(form.pieces_per_pack) : 0),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
      <Input placeholder="Product name *" value={form.name} onChange={e => update('name', e.target.value)} required />
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder={currency && currency.purchase_currency !== currency.base_currency ? `Pack buying price (${currency.purchase_currency}) *` : "Pack buying price *"} type="number" min="0" step="0.01" value={form.cost_price} onChange={e => update('cost_price', e.target.value)} required />
        <Input placeholder="Pack selling price *" type="number" min="0" step="0.01" value={form.price} onChange={e => update('price', e.target.value)} required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input placeholder="Quantity *" type="number" min="0" value={form.quantity} onChange={e => update('quantity', e.target.value)} required className="col-span-1" />
        <Select value={form.unit} onValueChange={v => update('unit', v)}>
          <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
          <SelectContent>
            {[
              ['pcs', 'Pieces (pcs)'], ['kg', 'Kilogram (kg)'], ['g', 'Gram (g)'],
              ['l', 'Litre (l)'], ['ml', 'Millilitre (ml)'], ['box', 'Box'],
              ['pack', 'Pack'], ['dozen', 'Dozen'], ['bag', 'Bag'], ['bottle', 'Bottle'],
              ['carton', 'Carton'], ['tray', 'Tray'], ['roll', 'Roll'], ['other', 'Other'],
            ].map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Low stock alert" type="number" min="0" value={form.low_stock_threshold} onChange={e => update('low_stock_threshold', e.target.value)} />
      </div>
      <Select value={form.category} onValueChange={v => update('category', v)}>
        <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>{categoryList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={form.supplier_id} onValueChange={v => update('supplier_id', v)}>
        <SelectTrigger><SelectValue placeholder="Supplier (optional)" /></SelectTrigger>
        <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>
      <Input placeholder="Barcode" value={form.barcode} onChange={e => update('barcode', e.target.value)} />
      <div>
        <label className="text-xs text-muted-foreground">Expiry Date</label>
        <Input type="date" value={form.expiry_date} onChange={e => update('expiry_date', e.target.value)} />
      </div>
      <Input placeholder="Description" value={form.description} onChange={e => update('description', e.target.value)} />
      {/* Pack / Piece pricing */}
      <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pack / Piece Pricing (optional)</p>
        <Input placeholder="Pack name (e.g. Carton, Dozen, Box)" value={form.pack_name} onChange={e => update('pack_name', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Ratio (pieces per pack)" type="number" min="0" step="1" value={form.pieces_per_pack} onChange={e => update('pieces_per_pack', e.target.value)} />
          <Input placeholder="Piece selling price" type="number" min="0" step="0.01" value={form.piece_price} onChange={e => update('piece_price', e.target.value)} />
        </div>
        {Number(form.pieces_per_pack) > 0 && Number(form.cost_price) > 0 && (
          <p className="text-xs text-muted-foreground">
            Piece buying price: <strong>{(Number(form.cost_price) / Number(form.pieces_per_pack)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
            {!form.piece_price && Number(form.price) > 0 && (
              <> &nbsp;·&nbsp; Piece selling price (auto): <strong>{(Number(form.price) / Number(form.pieces_per_pack)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></>
            )}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Piece buying price = pack buying price ÷ ratio. Leave ratio as 0 to disable piece sales.</p>
      </div>
      <div className="flex gap-2 pt-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>}
        <Button type="submit" className="flex-1 gradient-primary border-0" disabled={isPending}>
          {isPending ? 'Saving...' : product ? 'Update' : 'Add Product'}
        </Button>
      </div>
    </form>
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
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
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
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

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

  const handleDelete = async (id: string) => {
    if (!confirm(t('products.deleteConfirm'))) return;
    try {
      await deleteProduct.mutateAsync(id);
      toast.success(t('products.deleted'));
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

  const updateNew = (field: string, value: string) => setNewProduct(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('products.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('customers.total', { count: products?.length || 0 })}</p>
        </div>
        <div className="flex gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
          <Button variant="outline" className="gap-1" onClick={() => importRef.current?.click()}>
            <Upload size={16} /> Import
          </Button>
          <Button variant="outline" className="gap-1" onClick={() => {
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
            exportToExcel(`\${shopSettings?.shop_name || 'Shop'}_Products`, [{ name: t('products.title'), rows }]);
            toast.success(t('common.excelDownloaded'));
          }}>
            <FileSpreadsheet size={16} /> {t('common.excel')}
          </Button>
          <Button className="gradient-primary border-0 gap-1" onClick={() => setIsAdding(true)}>
            <Plus size={16} /> {t('common.add')}
          </Button>
        </div>
      </div>

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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger ref={filterRef} className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('sales.allCategories')}</SelectItem>
            {categoryList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>}

      {!isLoading && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table ref={tableRef}>
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
                    <TableCell colSpan={12} className="p-4">
                      <ProductForm
                        product={product}
                        suppliers={suppliers || []}
                        categories={categoryList}
                        onSubmit={(data) => handleUpdate(product.id, data)}
                        isPending={updateProduct.isPending}
                        onCancel={() => setEditingId(null)}
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
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(product.id)}><Pencil size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(product.id)}><Trash2 size={14} /></Button>
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
    </div>
  );
}
