import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExpenses, useAddExpense, useUpdateExpense, useDeleteExpense, EXPENSE_CATEGORIES } from '@/hooks/useExpenses';
import { useExpenseCategories } from '@/hooks/useExpenseCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormSheet, FormField, formInputClass } from '@/components/FormSheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, Trash2, Receipt, Truck, Settings as SettingsIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useMoney } from '@/hooks/useCurrencySettings';

const categoryColors: Record<string, string> = {
  rent: 'bg-accent/20 text-accent',
  utilities: 'bg-warning/20 text-warning',
  salaries: 'bg-primary/20 text-primary',
  supplies: 'bg-secondary text-secondary-foreground',
  transport: 'bg-info/20 text-info',
  other: 'bg-muted text-muted-foreground',
};

export default function Expenses() {
  const { t } = useTranslation();
  const { fmt: money, code: currencyCode } = useMoney();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const { data: expenses, isLoading } = useExpenses();
  const { data: customCategories } = useExpenseCategories();
  const { data: suppliers } = useSuppliers();
  const addExpense = useAddExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [supplierId, setSupplierId] = useState<string>('none');

  // All categories from DB (defaults are seeded on first launch)
  const allCategories = (customCategories || []).map(c => c.name);

  const resetForm = () => { setTitle(''); setAmount(''); setCategory('other'); setDescription(''); setDate(''); setSupplierId('none'); };

  const filtered = (expenses || []).filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) || e.category.includes(search.toLowerCase())
  );

  const totalExpenses = (expenses || []).reduce((s, e) => s + e.amount, 0);

  const openAdd = () => { resetForm(); setEditingId(null); setSheetOpen(true); };
  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) { resetForm(); setEditingId(null); }
  };

  const handleSubmit = async () => {
    const payload = {
      title,
      amount: Number(amount),
      category,
      description: description || undefined,
      date: date || undefined,
      supplier_id: supplierId === 'none' ? null : supplierId,
    };
    try {
      if (editingId) {
        await updateExpense.mutateAsync({ id: editingId, ...payload });
        toast.success(t('expenses.updated'));
      } else {
        await addExpense.mutateAsync(payload);
        toast.success(t('expenses.added'));
      }
      setSheetOpen(false);
      resetForm();
      setEditingId(null);
    } catch (err: any) { toast.error(err.message); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try { await deleteExpense.mutateAsync(id); toast.success(t('expenses.deleted')); } catch (err: any) { toast.error(err.message); }
  };

  const startEdit = (expense: any) => {
    setTitle(expense.title); setAmount(String(expense.amount)); setCategory(expense.category);
    setDescription(expense.description || '');
    setDate(expense.date ? format(new Date(expense.date), 'yyyy-MM-dd') : '');
    setSupplierId(expense.supplier_id || 'none');
    setEditingId(expense.id);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('expenses.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('expenses.totalLabel', { amount: totalExpenses.toLocaleString(), currency: currencyCode })}</p>
        </div>
        <Button className="hidden gradient-primary border-0 gap-1 md:inline-flex" onClick={openAdd}>
          <Plus size={16} /> {t('common.add')}
        </Button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('expenses.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
      </div>

      {isLoading && <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>}

      <div className="space-y-2">
        {filtered.map(expense => (
          <Card key={expense.id} className="shadow-card">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Receipt size={14} className="text-muted-foreground" />
                      <p className="font-medium text-card-foreground">{expense.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-destructive">-{money(expense.amount)}</span>
                      <Badge className={`text-xs ${categoryColors[expense.category] || categoryColors.other}`}>{expense.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(expense.date), 'MMM d, yyyy')}</p>
                    {expense.description && <p className="text-xs text-muted-foreground">{expense.description}</p>}
                    {expense.supplier_id && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Truck size={10} /> {(suppliers || []).find(s => s.id === expense.supplier_id)?.name || 'Supplier'}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(expense)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteTarget({ id: expense.id, title: expense.title })}><Trash2 size={14} /></Button>
                  </div>
                </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {search ? t('expenses.noResults') : t('expenses.empty')}
          </p>
        )}
      </div>
      {/* Floating add button (mobile) */}
      {!sheetOpen && (
        <Button onClick={openAdd} aria-label={t('common.add')}
          className="fixed end-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 h-14 w-14 rounded-full gradient-primary border-0 p-0 shadow-lg md:hidden">
          <Plus size={26} />
        </Button>
      )}

      {/* Add / Edit form (one form for both) */}
      <FormSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        title={editingId ? t('expenses.editExpense', 'Edit expense') : t('expenses.addExpense')}
        onSubmit={handleSubmit}
        submitLabel={editingId ? t('common.update') : t('expenses.addExpense')}
        isPending={addExpense.isPending || updateExpense.isPending}
      >
        <FormField label={t('expenses.titleField')} htmlFor="exp-title">
          <Input id="exp-title" className={formInputClass} value={title} onChange={e => setTitle(e.target.value)} required autoComplete="off" />
        </FormField>
        <FormField label={t('expenses.amountField')} htmlFor="exp-amount">
          <Input id="exp-amount" className={formInputClass} type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
        </FormField>
        <FormField label={t('common.category')}>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className={formInputClass}><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>{allCategories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
          </Select>
          <Link to="/settings" className="inline-flex items-center gap-1 pt-1 text-xs text-primary hover:underline">
            <SettingsIcon size={11} /> Manage categories
          </Link>
        </FormField>
        <FormField label="Supplier (optional)">
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className={formInputClass}><SelectValue placeholder="Supplier (optional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— No supplier —</SelectItem>
              {(suppliers || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label={t('common.date')} htmlFor="exp-date">
          <Input id="exp-date" className={formInputClass} type="date" value={date} onChange={e => setDate(e.target.value)} />
        </FormField>
        <FormField label={t('common.description')} htmlFor="exp-desc">
          <Input id="exp-desc" className={formInputClass} value={description} onChange={e => setDescription(e.target.value)} />
        </FormField>
      </FormSheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('expenses.deleteExpense', 'Delete expense')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `${deleteTarget.title} — ` : ''}{t('expenses.deleteConfirm')}
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
