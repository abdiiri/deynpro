import { useState } from 'react';
import { useSuppliers, useAddSupplier, useUpdateSupplier, useDeleteSupplier, Supplier } from '@/hooks/useSuppliers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, Phone, FileText, MapPin } from 'lucide-react';
import { toast } from 'sonner';

function SupplierForm({ supplier, onSubmit, isPending, onCancel }: {
  supplier?: Supplier;
  onSubmit: (data: { name: string; phone?: string; description?: string; address?: string }) => void;
  isPending: boolean;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(supplier?.name || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [description, setDescription] = useState(supplier?.description || '');
  const [address, setAddress] = useState(supplier?.address || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, phone: phone || undefined, description: description || undefined, address: address || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input placeholder="Supplier name *" value={name} onChange={e => setName(e.target.value)} required />
      <Input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
      <Input placeholder="Description (e.g. Wholesale rice)" value={description} onChange={e => setDescription(e.target.value)} />
      <Input placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} />
      <div className="flex gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>}
        <Button type="submit" className="flex-1 gradient-primary border-0" disabled={isPending}>
          {isPending ? 'Saving...' : supplier ? 'Update' : 'Add Supplier'}
        </Button>
      </div>
    </form>
  );
}

export default function Suppliers() {
  const { data: suppliers, isLoading } = useSuppliers();
  const addSupplier = useAddSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = suppliers?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || '').includes(search)
  ) || [];

  const handleAdd = async (data: { name: string; phone?: string; description?: string; address?: string }) => {
    try {
      await addSupplier.mutateAsync(data);
      toast.success('Supplier added!');
      setAddOpen(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleUpdate = async (id: string, data: { name: string; phone?: string; description?: string; address?: string }) => {
    try {
      await updateSupplier.mutateAsync({ id, ...data });
      toast.success('Supplier updated!');
      setEditingId(null);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this supplier?')) return;
    try {
      await deleteSupplier.mutateAsync(id);
      toast.success('Supplier deleted');
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Suppliers</h1>
          <p className="text-sm text-muted-foreground">{suppliers?.length || 0} total</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary border-0 gap-1"><Plus size={16} /> Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Supplier</DialogTitle></DialogHeader>
            <SupplierForm onSubmit={handleAdd} isPending={addSupplier.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading && <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>}

      <div className="space-y-2">
        {filtered.map(supplier => (
          <Card key={supplier.id} className="shadow-card">
            <CardContent className="p-4">
              {editingId === supplier.id ? (
                <SupplierForm
                  supplier={supplier}
                  onSubmit={(data) => handleUpdate(supplier.id, data)}
                  isPending={updateSupplier.isPending}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-card-foreground">{supplier.name}</p>
                    {supplier.phone && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone size={12} /> {supplier.phone}</p>}
                    {supplier.description && <p className="text-sm text-muted-foreground flex items-center gap-1"><FileText size={12} /> {supplier.description}</p>}
                    {supplier.address && <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin size={12} /> {supplier.address}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditingId(supplier.id)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(supplier.id)}><Trash2 size={14} /></Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {search ? 'No suppliers found' : 'No suppliers yet. Add your first one!'}
          </p>
        )}
      </div>
    </div>
  );
}
