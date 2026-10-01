import { useState, useRef } from 'react';
import { useShopSettings } from '@/hooks/useShopSettings';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCustomers, useAddCustomer, useUpdateCustomer, useDeleteCustomer } from '@/hooks/useCustomers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FormSheet, FormField, formInputClass } from '@/components/FormSheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, ChevronRight, Pencil, Trash2, FileSpreadsheet, Upload, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useMoney } from '@/hooks/useCurrencySettings';
import { exportToExcel } from '@/lib/excelExport';
import * as XLSX from 'xlsx';

export default function Customers() {
  const { data: shopSettings } = useShopSettings();
  const { t } = useTranslation();
  const { fmt: money, code: currencyCode } = useMoney();
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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

  const handleExportExcel = () => {
    const rows = (customers || []).map(c => ({
      [t('common.name')]: c.name,
      [t('common.phone')]: c.phone,
      [t('common.date')]: c.created_at,
    }));
    exportToExcel(`${shopSettings?.shop_name || 'Shop'}_Customers`, [{ name: t('customers.title'), rows }]);
    toast.success(t('common.excelDownloaded'));
  };

  const resetForm = () => { setName(''); setPhone(''); setCreditLimit('0'); setEditingId(null); };
  const openAdd = () => { resetForm(); setDialogOpen(true); };
  const handleSheetOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const filtered = customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  ) || [];

  const handleAdd = async () => {
    try {
      if (editingId) {
        await updateCustomer.mutateAsync({ id: editingId, name, phone, credit_limit: parseFloat(creditLimit) || 0 });
        toast.success(t('customers.updated'));
      } else {
        await addCustomer.mutateAsync({ name, phone, credit_limit: parseFloat(creditLimit) || 0 });
        toast.success(t('customers.added'));
      }
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEdit = (customer: any) => {
    setEditingId(customer.id);
    setName(customer.name);
    setPhone(customer.phone);
    setCreditLimit(String(customer.credit_limit || 0));
    setDialogOpen(true);
  };

  const handleDelete = (id: string, customerName: string) => {
    setDeleteTarget({ id, name: customerName });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteCustomer.mutateAsync(id);
      toast.success(t('customers.deleted'));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('customers.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('customers.total', { count: customers?.length || 0 })}</p>
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
          <Button className="hidden gradient-primary border-0 gap-1 md:inline-flex" onClick={openAdd}>
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
          <Card key={customer.id} className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardContent className="flex items-center p-0">
              <Link to={`/customers/${customer.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-2 p-4 pe-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-card-foreground">{customer.name}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                    {(customer.loyalty_points || 0) > 0 && (
                      <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                        ⭐ {customer.loyalty_points} pts
                      </span>
                    )}
                    {(customer.credit_limit || 0) > 0 && (
                      <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                        Limit: {money(customer.credit_limit)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground rtl:rotate-180" />
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="me-2 h-10 w-10 shrink-0" aria-label={t('common.actions')}>
                    <MoreVertical size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(customer)}>
                    <Pencil size={14} className="me-2" /> {t('common.edit', 'Edit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDelete(customer.id, customer.name)} className="text-destructive focus:text-destructive">
                    <Trash2 size={14} className="me-2" /> {t('common.delete', 'Delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {search ? t('customers.noResults') : t('customers.empty')}
          </p>
        )}
      </div>
      {/* Floating add button (mobile) */}
      {!dialogOpen && (
        <Button onClick={openAdd} aria-label={t('common.add')}
          className="fixed end-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 h-14 w-14 rounded-full gradient-primary border-0 p-0 shadow-lg md:hidden">
          <Plus size={26} />
        </Button>
      )}

      {/* Add / Edit form */}
      <FormSheet
        open={dialogOpen}
        onOpenChange={handleSheetOpenChange}
        title={editingId ? t('customers.editCustomer') : t('customers.addCustomer')}
        onSubmit={handleAdd}
        submitLabel={editingId ? t('common.update') : t('customers.addCustomer')}
        isPending={addCustomer.isPending || updateCustomer.isPending}
      >
        <FormField label={`${t('customers.customerName')} *`} htmlFor="cust-name">
          <Input id="cust-name" className={formInputClass} value={name} onChange={e => setName(e.target.value)} required autoComplete="off" />
        </FormField>
        <FormField label={`${t('common.phone')} *`} htmlFor="cust-phone" hint="e.g. 0712345678">
          <Input id="cust-phone" className={formInputClass} type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} required autoComplete="off" />
        </FormField>
        <FormField label={`Credit Limit (${currencyCode})`} htmlFor="cust-limit" hint="0 = unlimited">
          <Input id="cust-limit" className={formInputClass} type="number" inputMode="decimal" min="0" step="any" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} />
        </FormField>
      </FormSheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('customers.deleteCustomer', 'Delete customer')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? t('customers.deleteConfirm', { name: deleteTarget.name }) : ''}
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
