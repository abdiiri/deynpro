import { useState, useRef } from 'react';
import { useShopSettings } from '@/hooks/useShopSettings';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCustomers, useAddCustomer, useUpdateCustomer, useDeleteCustomer } from '@/hooks/useCustomers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, ChevronRight, Pencil, Trash2, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { exportToExcel } from '@/lib/excelExport';
import * as XLSX from 'xlsx';

export default function Customers() {
  const { data: shopSettings } = useShopSettings();
  const { t } = useTranslation();
  const { data: customers, isLoading } = useCustomers();
  const addCustomer = useAddCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
        const n = row['Name'] || row['name'];
        const p = String(row['Phone'] || row['phone'] || '');
        if (!n || !p) continue;
        await addCustomer.mutateAsync({ name: n, phone: p });
        imported++;
      }
      toast.success(`Imported ${imported} customer${imported !== 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error('Import failed: ' + err.message);
    }
  };

  const filtered = customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  ) || [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateCustomer.mutateAsync({ id: editingId, name, phone, credit_limit: parseFloat(creditLimit) || 0 });
        toast.success(t('customers.updated'));
      } else {
        await addCustomer.mutateAsync({ name, phone, credit_limit: parseFloat(creditLimit) || 0 });
        toast.success(t('customers.added'));
      }
      setName(''); setPhone(''); setCreditLimit('0'); setDialogOpen(false); setEditingId(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEdit = (e: React.MouseEvent, customer: any) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(customer.id);
    setName(customer.name);
    setPhone(customer.phone);
    setCreditLimit(String(customer.credit_limit || 0));
    setDialogOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: string, customerName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(t('customers.deleteConfirm', { name: customerName }))) return;
    try {
      await deleteCustomer.mutateAsync(id);
      toast.success(t('customers.deleted'));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('customers.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('customers.total', { count: customers?.length || 0 })}</p>
        </div>
        <div className="flex gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
          <Button variant="outline" className="gap-1" onClick={() => importRef.current?.click()}>
            <Upload size={16} /> Import
          </Button>
          <Button variant="outline" className="gap-1" onClick={() => {
            const rows = (customers || []).map(c => ({
              [t('common.name')]: c.name,
              [t('common.phone')]: c.phone,
              [t('common.date')]: c.created_at,
            }));
            exportToExcel(`\${shopSettings?.shop_name || 'Shop'}_Customers`, [{ name: t('customers.title'), rows }]);
            toast.success(t('common.excelDownloaded'));
          }}>
            <FileSpreadsheet size={16} /> {t('common.excel')}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) { setEditingId(null); setName(''); setPhone(''); }
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary border-0 gap-1">
                <Plus size={16} /> {t('common.add')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? t('customers.editCustomer') : t('customers.addCustomer')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <Input placeholder={t('customers.customerName')} value={name} onChange={e => setName(e.target.value)} required />
                <Input placeholder={t('customers.phonePlaceholder')} value={phone} onChange={e => setPhone(e.target.value)} required />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Credit Limit (KES) — 0 = unlimited</label>
                  <Input
                    type="number" min="0" step="100"
                    placeholder="0"
                    value={creditLimit}
                    onChange={e => setCreditLimit(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full gradient-primary border-0" disabled={addCustomer.isPending || updateCustomer.isPending}>
                  {editingId ? t('common.update') : t('customers.addCustomer')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('common.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(customer => (
          <Link key={customer.id} to={`/customers/${customer.id}`}>
            <Card className="shadow-card hover:shadow-card-hover transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-card-foreground">{customer.name}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                    {(customer.loyalty_points || 0) > 0 && (
                      <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                        ⭐ {customer.loyalty_points} pts
                      </span>
                    )}
                    {(customer.credit_limit || 0) > 0 && (
                      <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                        Limit: KES {customer.credit_limit.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleEdit(e, customer)}>
                    <Pencil size={14} className="text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleDelete(e, customer.id, customer.name)}>
                    <Trash2 size={14} className="text-destructive" />
                  </Button>
                  <ChevronRight size={18} className="text-muted-foreground rtl:rotate-180" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {search ? t('customers.noResults') : t('customers.empty')}
          </p>
        )}
      </div>
    </div>
  );
}
