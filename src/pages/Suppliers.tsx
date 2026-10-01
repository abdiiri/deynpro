import { useState } from 'react';
import { useSuppliers, useAddSupplier, useUpdateSupplier, useDeleteSupplier, Supplier } from '@/hooks/useSuppliers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormSheet, FormField, formInputClass } from '@/components/FormSheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, Pencil, Trash2, Phone, FileText, MapPin, FileSpreadsheet, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useShopSettings } from '@/hooks/useShopSettings';
import { exportToExcel } from '@/lib/excelExport';

export default function Suppliers() {
  const { data: shopSettings } = useShopSettings();
  const { data: suppliers, isLoading } = useSuppliers();
  const addSupplier = useAddSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const filtered = suppliers?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || '').includes(search)
  ) || [];

  const resetForm = () => { setName(''); setPhone(''); setDescription(''); setAddress(''); setEditingId(null); };
  const openAdd = () => { resetForm(); setSheetOpen(true); };
  const openEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setName(supplier.name);
    setPhone(supplier.phone || '');
    setDescription(supplier.description || '');
    setAddress(supplier.address || '');
    setSheetOpen(true);
  };
  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) resetForm();
  };

  const handleExportExcel = () => {
    const rows = (suppliers || []).map(sp => ({
      Name: sp.name,
      Phone: sp.phone || '',
      Description: sp.description || '',
      Address: sp.address || '',
    }));
    exportToExcel(`${shopSettings?.shop_name || 'Shop'}_Suppliers`, [{ name: 'Suppliers', rows }]);
    toast.success('Excel downloaded');
  };

  const handleSubmit = async () => {
    const data = { name, phone: phone || undefined, description: description || undefined, address: address || undefined };
    try {
      if (editingId) {
        await updateSupplier.mutateAsync({ id: editingId, ...data });
        toast.success('Supplier updated!');
      } else {
        await addSupplier.mutateAsync(data);
        toast.success('Supplier added!');
      }
      setSheetOpen(false);
      resetForm();
    } catch (err: any) { toast.error(err.message); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await deleteSupplier.mutateAsync(id);
      toast.success('Supplier deleted');
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Suppliers</h1>
          <p className="text-sm text-muted-foreground">{suppliers?.length || 0} total</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Desktop actions */}
          <Button variant="outline" className="hidden gap-1 md:inline-flex" onClick={handleExportExcel}>
            <FileSpreadsheet size={16} /> Excel
          </Button>
          <Button className="hidden gradient-primary border-0 gap-1 md:inline-flex" onClick={openAdd}>
            <Plus size={16} /> Add
          </Button>
          {/* Mobile overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="More">
                <MoreVertical size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel}><FileSpreadsheet size={14} className="me-2" /> Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
      </div>

      {isLoading && <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>}

      <div className="space-y-2">
        {filtered.map(supplier => (
          <Card key={supplier.id} className="shadow-card">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-card-foreground">{supplier.name}</p>
                    {supplier.phone && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone size={12} /> {supplier.phone}</p>}
                    {supplier.description && <p className="text-sm text-muted-foreground flex items-center gap-1"><FileText size={12} /> {supplier.description}</p>}
                    {supplier.address && <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin size={12} /> {supplier.address}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(supplier)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteTarget({ id: supplier.id, name: supplier.name })}><Trash2 size={14} /></Button>
                  </div>
                </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {search ? 'No suppliers found' : 'No suppliers yet. Add your first one!'}
          </p>
        )}
      </div>
      {/* Floating add button (mobile) */}
      {!sheetOpen && (
        <Button onClick={openAdd} aria-label="Add supplier"
          className="fixed end-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 h-14 w-14 rounded-full gradient-primary border-0 p-0 shadow-lg md:hidden">
          <Plus size={26} />
        </Button>
      )}

      {/* Add / Edit form */}
      <FormSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        title={editingId ? 'Edit Supplier' : 'Add Supplier'}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update' : 'Add Supplier'}
        isPending={addSupplier.isPending || updateSupplier.isPending}
      >
        <FormField label="Supplier name *" htmlFor="sup-name">
          <Input id="sup-name" className={formInputClass} value={name} onChange={e => setName(e.target.value)} required autoComplete="off" />
        </FormField>
        <FormField label="Phone" htmlFor="sup-phone">
          <Input id="sup-phone" className={formInputClass} type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="off" />
        </FormField>
        <FormField label="Description" htmlFor="sup-desc" hint="e.g. Wholesale rice">
          <Input id="sup-desc" className={formInputClass} value={description} onChange={e => setDescription(e.target.value)} />
        </FormField>
        <FormField label="Address" htmlFor="sup-addr">
          <Input id="sup-addr" className={formInputClass} value={address} onChange={e => setAddress(e.target.value)} />
        </FormField>
      </FormSheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `${deleteTarget.name} — ` : ''}Delete this supplier?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
