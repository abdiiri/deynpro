import { useState, useMemo } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useStockReceivings, useCreateStockReceiving } from '@/hooks/useStockReceiving';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, PackagePlus, ChevronDown, ChevronRight, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useMoney } from '@/hooks/useCurrencySettings';

interface ReceivingLine {
  product_id: string;
  product_name: string;
  current_qty: number;
  quantity_received: number;
  cost_per_unit: number;
}

export default function StockReceiving() {
  const { fmt: money } = useMoney();
  const { data: products } = useProducts();
  const { data: suppliers } = useSuppliers();
  const { data: receivings } = useStockReceivings();
  const createReceiving = useCreateStockReceiving();

  const [modalOpen, setModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('none');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<ReceivingLine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return [];
    return (products || []).filter(p =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.barcode || '').includes(productSearch)
    ).slice(0, 8);
  }, [products, productSearch]);

  const addLine = (product: any) => {
    if (lines.find(l => l.product_id === product.id)) {
      toast.info('Already added — edit the quantity below');
      setProductSearch('');
      return;
    }
    setLines(prev => [...prev, {
      product_id: product.id,
      product_name: product.name,
      current_qty: product.quantity,
      quantity_received: 1,
      cost_per_unit: product.cost_price || 0,
    }]);
    setProductSearch('');
  };

  const updateLine = (id: string, field: 'quantity_received' | 'cost_per_unit', val: number) => {
    setLines(prev => prev.map(l => l.product_id === id ? { ...l, [field]: val } : l));
  };

  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.product_id !== id));

  const totalCost = lines.reduce((s, l) => s + l.quantity_received * l.cost_per_unit, 0);

  const handleSubmit = async () => {
    if (lines.length === 0) { toast.error('Add at least one product'); return; }
    const invalid = lines.find(l => l.quantity_received < 1 || l.cost_per_unit < 0);
    if (invalid) { toast.error('Check quantities and costs'); return; }

    try {
      await createReceiving.mutateAsync({
        supplier_id: supplierId !== 'none' ? supplierId : undefined,
        notes: notes || undefined,
        items: lines.map(l => ({
          product_id: l.product_id,
          quantity_received: l.quantity_received,
          cost_per_unit: l.cost_per_unit,
          subtotal: l.quantity_received * l.cost_per_unit,
        })),
      });
      toast.success(`Stock received — ${lines.length} product${lines.length > 1 ? 's' : ''} updated`);
      setLines([]);
      setSupplierId('none');
      setNotes('');
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock Receiving</h1>
          <p className="text-sm text-muted-foreground">Record incoming stock from suppliers</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <PackagePlus size={16} /> Receive Stock
        </Button>
      </div>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Receiving History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!receivings || receivings.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">No stock received yet</p>
          ) : (
            <>
            {/* Mobile: cards */}
            <div className="md:hidden divide-y divide-border">
              {receivings.map((r: any) => {
                const open = expandedId === r.id;
                return (
                  <div key={r.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : r.id)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left active:bg-muted/40"
                      aria-expanded={open}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{format(new Date(r.date), 'dd MMM yyyy, HH:mm')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
                          <Truck size={11} className="shrink-0" />
                          <span className="truncate">{r.supplier?.name || 'No supplier'}</span>
                          <span>· {r.items.length} item{r.items.length !== 1 ? 's' : ''}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-semibold text-primary">{money(r.total_cost)}</span>
                        {open
                          ? <ChevronDown size={16} className="text-muted-foreground" />
                          : <ChevronRight size={16} className="text-muted-foreground" />}
                      </div>
                    </button>
                    {open && (
                      <div className="bg-muted/20 px-4 pb-3 space-y-2">
                        {r.notes && <p className="text-xs text-muted-foreground pt-1">Notes: {r.notes}</p>}
                        {r.items.map((item: any) => (
                          <div key={item.id} className="flex items-start justify-between gap-3 text-xs border-b border-border/50 last:border-0 pb-2 last:pb-0">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{item.product?.name || item.product_id}</p>
                              <p className="text-muted-foreground">+{item.quantity_received} × {money(item.cost_per_unit)}</p>
                            </div>
                            <span className="font-semibold text-sm shrink-0">{money(item.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivings.map((r: any) => (
                  <>
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    >
                      <TableCell className="py-2 px-3">
                        {expandedId === r.id
                          ? <ChevronDown size={14} className="text-muted-foreground" />
                          : <ChevronRight size={14} className="text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(r.date), 'dd MMM yyyy, HH:mm')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.supplier ? (
                          <span className="flex items-center gap-1.5">
                            <Truck size={12} className="text-muted-foreground" />
                            {r.supplier.name}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">{r.items.length}</TableCell>
                      <TableCell className="text-right font-semibold text-primary text-sm">{money(r.total_cost)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.notes || '—'}</TableCell>
                    </TableRow>

                    {expandedId === r.id && (
                      <TableRow key={`${r.id}-expanded`} className="bg-muted/20">
                        <TableCell colSpan={6} className="px-8 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground border-b">
                                <th className="text-left pb-1.5 font-medium">Product</th>
                                <th className="text-center pb-1.5 font-medium">Qty Received</th>
                                <th className="text-right pb-1.5 font-medium">Cost/Unit</th>
                                <th className="text-right pb-1.5 font-medium">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.items.map((item: any) => (
                                <tr key={item.id} className="border-b border-border/50 last:border-0">
                                  <td className="py-1.5 font-medium">{item.product?.name || item.product_id}</td>
                                  <td className="text-center py-1.5">+{item.quantity_received}</td>
                                  <td className="text-right py-1.5">{money(item.cost_per_unit)}</td>
                                  <td className="text-right py-1.5 font-semibold">{money(item.subtotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Receive Stock Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 w-full max-w-none h-[100dvh] max-h-[100dvh] rounded-none p-0 sm:p-0 gap-0 flex flex-col overflow-hidden sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-[95vw] sm:max-w-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-lg">
          <DialogHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus size={18} /> Receive New Stock
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
          {/* Supplier + Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Supplier (optional)</label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-10 sm:h-9 text-sm">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {(suppliers || []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
              <Input
                placeholder="e.g. Invoice #1234"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="h-10 sm:h-9 text-base sm:text-sm"
              />
            </div>
          </div>

          {/* Product search */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Add Product</label>
            <div className="relative">
              <Input
                placeholder="Search product by name or barcode…"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="h-10 sm:h-9 text-base sm:text-sm"
              />
              {filteredProducts.length > 0 && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-md shadow-md overflow-hidden">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addLine(p)}
                      className="w-full flex items-center justify-between px-3 py-3 sm:py-2 text-sm hover:bg-muted text-left"
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground text-xs">Stock: {p.quantity}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lines */}
          <div>
            {lines.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg py-10 text-center text-muted-foreground text-sm">
                Search and add products above
              </div>
            ) : (
              <>
              {/* Mobile: one card per line */}
              <div className="sm:hidden space-y-3">
                {lines.map(line => (
                  <div key={line.product_id} className="border border-border rounded-lg p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{line.product_name}</p>
                        <p className="text-xs text-muted-foreground">In stock: {line.current_qty}</p>
                      </div>
                      <Button size="icon" variant="ghost" className="h-9 w-9 -mt-1 -mr-1 text-destructive shrink-0" onClick={() => removeLine(line.product_id)} aria-label={`Remove ${line.product_name}`}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Qty received</label>
                        <Input
                          type="number" inputMode="numeric" min={1}
                          value={line.quantity_received}
                          onChange={e => updateLine(line.product_id, 'quantity_received', Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-10 text-base text-center"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Cost / unit</label>
                        <Input
                          type="number" inputMode="decimal" min={0} step="0.01"
                          value={line.cost_per_unit}
                          onChange={e => updateLine(line.product_id, 'cost_per_unit', parseFloat(e.target.value) || 0)}
                          className="h-10 text-base text-right"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-sm pt-1 border-t border-border">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-semibold">{money(line.quantity_received * line.cost_per_unit)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
              <Table className="border border-border rounded-lg min-w-[540px]">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs border-r border-border">Product</TableHead>
                    <TableHead className="text-xs text-center border-r border-border w-[80px]">Current</TableHead>
                    <TableHead className="text-xs text-center border-r border-border w-[100px]">Qty Received</TableHead>
                    <TableHead className="text-xs text-right border-r border-border w-[120px]">Cost / Unit</TableHead>
                    <TableHead className="text-xs text-right border-r border-border w-[110px]">Subtotal</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map(line => (
                    <TableRow key={line.product_id} className="border-b border-border">
                      <TableCell className="text-sm font-medium border-r border-border py-2">{line.product_name}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground border-r border-border py-2">{line.current_qty}</TableCell>
                      <TableCell className="border-r border-border p-1">
                        <Input
                          type="number" min={1}
                          value={line.quantity_received}
                          onChange={e => updateLine(line.product_id, 'quantity_received', Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-7 text-center text-sm [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      </TableCell>
                      <TableCell className="border-r border-border p-1">
                        <Input
                          type="number" min={0} step="0.01"
                          value={line.cost_per_unit}
                          onChange={e => updateLine(line.product_id, 'cost_per_unit', parseFloat(e.target.value) || 0)}
                          className="h-7 text-right text-sm [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold border-r border-border py-2">
                        {money(line.quantity_received * line.cost_per_unit)}
                      </TableCell>
                      <TableCell className="p-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeLine(line.product_id)}>
                          <Trash2 size={12} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              </>
            )}
          </div>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6 space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">
                Total cost <span className="text-xs">({lines.length} product{lines.length !== 1 ? 's' : ''})</span>
              </span>
              <span className="font-bold text-lg text-primary">{money(totalCost)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 sm:flex-none h-11 sm:h-10" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createReceiving.isPending || lines.length === 0} className="flex-1 sm:flex-none gap-2 h-11 sm:h-10">
                <PackagePlus size={15} />
                {createReceiving.isPending ? 'Saving…' : 'Receive'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
