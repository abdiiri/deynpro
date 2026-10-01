import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCustomer, useCustomerTransactions, useCustomerBalance, useAddTransaction, useDeleteTransaction, useUpdateTransaction } from '@/hooks/useCustomers';
import { useShopSettings } from '@/hooks/useShopSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormSheet, FormField, formInputClass } from '@/components/FormSheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CustomerStatementModal } from '@/components/CustomerStatementModal';
import { ArrowLeft, Plus, Minus, Phone, MessageCircle, Clock, AlertTriangle, Trash2, Pencil, FileText } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useMoney } from '@/hooks/useCurrencySettings';

function formatPhone(phone: string) {
  let clean = phone.replace(/\s+/g, '');
  if (clean.startsWith('0')) clean = '254' + clean.slice(1);
  if (!clean.startsWith('+')) clean = '+' + clean;
  return clean.replace('+', '');
}

function openWhatsApp(phone: string, message: string) {
  const num = formatPhone(phone);
  const url = `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

export default function CustomerDetails() {
  const { fmt: money, code: currencyCode } = useMoney();
  const { t } = useTranslation();
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading: custLoading } = useCustomer(id!);
  const { data: transactions, isLoading: txLoading } = useCustomerTransactions(id!);
  const { data: shopSettings } = useShopSettings();
  const balance = useCustomerBalance(id!);
  const addTransaction = useAddTransaction();
  const deleteTx = useDeleteTransaction();
  const updateTx = useUpdateTransaction();
  const [statementOpen, setStatementOpen] = useState(false);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [txType, setTxType] = useState<'debt' | 'payment'>('debt');
  const [dialogOpen, setDialogOpen] = useState(false);

  const [editTx, setEditTx] = useState<any>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  const openTxSheet = (type: 'debt' | 'payment') => {
    setTxType(type);
    setAmount(''); setDescription(''); setDueDate('');
    setDialogOpen(true);
  };

  const handleAddTx = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error(t('customers.invalidAmount'));
      return;
    }
    try {
      await addTransaction.mutateAsync({
        customer_id: id!,
        type: txType,
        amount: numAmount,
        description: description || undefined,
        due_date: txType === 'debt' && dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      toast.success(txType === 'debt' ? t('customers.debtAdded') : t('customers.paymentRecorded'));
      setAmount(''); setDescription(''); setDueDate(''); setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openEditDialog = (tx: any) => {
    setEditTx(tx);
    setEditAmount(String(tx.amount));
    setEditDescription(tx.description || '');
    setEditDueDate(tx.due_date ? format(new Date(tx.due_date), 'yyyy-MM-dd') : '');
  };

  const handleEditTx = async () => {
    const numAmount = parseFloat(editAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error(t('customers.invalidAmount'));
      return;
    }
    try {
      await updateTx.mutateAsync({
        id: editTx.id,
        amount: numAmount,
        description: editDescription || undefined,
        due_date: editTx.type === 'debt' && editDueDate ? new Date(editDueDate).toISOString() : undefined,
      });
      toast.success(t('customers.txUpdated'));
      setEditTx(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSendReminder = (tx: any) => {
    if (!customer) return;
    const dueClause = tx.due_date
      ? t('whatsapp.dueClause', { date: format(new Date(tx.due_date), 'MMM d, yyyy') })
      : '';
    const msg = t('whatsapp.debtReminder', {
      name: customer.name,
      amount: tx.amount.toLocaleString(),
      currency: currencyCode,
      dueClause,
    });
    openWhatsApp(customer.phone, msg);
  };

  const handleWhatsApp = () => {
    if (!customer) return;
    const msg = balance.balance > 0
      ? t('whatsapp.debtSummary', { name: customer.name, amount: balance.balance.toLocaleString(), currency: currencyCode })
      : t('whatsapp.thanks', { name: customer.name });
    openWhatsApp(customer.phone, msg);
  };

  const overdueDebts = transactions?.filter(
    tx => tx.type === 'debt' && tx.due_date && isPast(parseISO(tx.due_date))
  ) || [];

  if (custLoading) return <div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-32 bg-muted rounded-xl" /></div>;

  const confirmDeleteTx = () => {
    if (!deleteTxId) return;
    const txId = deleteTxId;
    setDeleteTxId(null);
    deleteTx.mutate(txId, {
      onSuccess: () => toast.success(t('customers.txDeleted')),
      onError: (err: any) => toast.error(err.message),
    });
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> {t('common.back')}
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{customer?.name}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone size={12} /> {customer?.phone}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setStatementOpen(true)}
          >
            <FileText size={16} /> {t('customers.statement')}
          </Button>
          <Button
            size="sm"
            className="gap-1 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,38%)] text-white border-0"
            onClick={handleWhatsApp}
          >
            <MessageCircle size={16} /> WhatsApp
          </Button>
        </div>
      </div>

      <CustomerStatementModal
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        customer={customer || null}
        transactions={transactions || []}
        shop={shopSettings}
      />

      <div className="grid grid-cols-3 gap-2 [&>*]:min-w-0">
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t('customers.totalDebt')}</p>
            <p className="text-sm sm:text-lg font-bold text-destructive break-words">{money(balance.totalDebt)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t('customers.paid')}</p>
            <p className="text-sm sm:text-lg font-bold text-success break-words">{money(balance.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t('customers.balance')}</p>
            <p className={`text-lg font-bold ${balance.balance > 0 ? 'text-destructive' : 'text-success'}`}>
              {money(balance.balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Loyalty points + credit limit row */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="shadow-card border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">⭐ Loyalty Points</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {(customer?.loyalty_points || 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              1 pt per {money(100)} spent · {money((customer?.loyalty_points || 0) * 10)} redeemable
            </p>
          </CardContent>
        </Card>

        <Card className={`shadow-card ${(customer?.credit_limit || 0) > 0 && balance.balance > (customer?.credit_limit || 0) * 0.8 ? 'border-destructive/30 bg-destructive/5' : 'border-blue-500/20 bg-blue-500/5'}`}>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">💳 Credit Limit</p>
            {(customer?.credit_limit || 0) > 0 ? (
              <>
                <div className="flex items-baseline gap-1">
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {money(Math.max(0, (customer?.credit_limit || 0) - balance.balance))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">available</p>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${balance.balance > (customer?.credit_limit || 0) ? 'bg-destructive' : balance.balance > (customer?.credit_limit || 0) * 0.8 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, ((balance.balance) / (customer?.credit_limit || 1)) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {money(balance.balance)} used of {money(customer?.credit_limit || 0)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No limit set</p>
            )}
          </CardContent>
        </Card>
      </div>

      {overdueDebts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-destructive" />
              <p className="text-sm font-semibold text-destructive">{t('customers.overdueAlert', { count: overdueDebts.length })}</p>
            </div>
            {overdueDebts.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm text-card-foreground">{money(tx.amount)}</p>
                  <p className="text-xs text-muted-foreground">{t('dashboard.due')}: {format(new Date(tx.due_date!), 'MMM d, yyyy')}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1 text-xs border-[hsl(142,70%,45%)] text-[hsl(142,70%,45%)]" onClick={() => handleSendReminder(tx)}>
                  <MessageCircle size={14} /> {t('dashboard.remind')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button className="flex-1 h-11 gradient-primary border-0 gap-1" onClick={() => openTxSheet('debt')}>
          <Plus size={16} /> {t('customers.addDebt')}
        </Button>
        <Button variant="outline" className="flex-1 h-11 gap-1 border-primary text-primary" onClick={() => openTxSheet('payment')}>
          <Minus size={16} /> {t('customers.recordPayment')}
        </Button>
      </div>

      {/* Add debt / record payment */}
      <FormSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={txType === 'debt' ? t('customers.addDebt') : t('customers.recordPayment')}
        onSubmit={handleAddTx}
        submitLabel={txType === 'debt' ? t('customers.addDebt') : t('customers.recordPayment')}
        isPending={addTransaction.isPending}
      >
        <FormField label={t('customers.amountKes', { currency: currencyCode })} htmlFor="tx-amount">
          <Input id="tx-amount" className={formInputClass} type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
        </FormField>
        <FormField label={t('customers.descOptional')} htmlFor="tx-desc">
          <Input id="tx-desc" className={formInputClass} value={description} onChange={e => setDescription(e.target.value)} />
        </FormField>
        {txType === 'debt' && (
          <FormField label={t('customers.dueDateOptional')} htmlFor="tx-due">
            <Input id="tx-due" className={formInputClass} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </FormField>
        )}
      </FormSheet>

      {/* Edit transaction */}
      <FormSheet
        open={!!editTx}
        onOpenChange={(open) => { if (!open) setEditTx(null); }}
        title={t('customers.editTx')}
        onSubmit={handleEditTx}
        submitLabel={t('common.update')}
        isPending={updateTx.isPending}
      >
        <FormField label={t('customers.amountKes', { currency: currencyCode })} htmlFor="edit-amount">
          <Input id="edit-amount" className={formInputClass} type="number" inputMode="decimal" min="0.01" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} required />
        </FormField>
        <FormField label={t('common.description')} htmlFor="edit-desc">
          <Input id="edit-desc" className={formInputClass} value={editDescription} onChange={e => setEditDescription(e.target.value)} />
        </FormField>
        {editTx?.type === 'debt' && (
          <FormField label={t('customers.dueDate')} htmlFor="edit-due">
            <Input id="edit-due" className={formInputClass} type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
          </FormField>
        )}
      </FormSheet>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('customers.transactionHistory')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {txLoading && <div className="h-20 bg-muted rounded animate-pulse" />}
          {!txLoading && (transactions?.length || 0) === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t('customers.noTransactions')}</p>
          )}
          {transactions?.map(tx => (
            <div key={tx.id} className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-card-foreground capitalize">{tx.description || tx.type}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(tx.date), 'MMM d, yyyy')}
                  {tx.type === 'debt' && tx.due_date && (
                    <span className={isPast(parseISO(tx.due_date)) ? ' text-destructive' : ''}>
                      {' '}· {t('dashboard.due')}: {format(new Date(tx.due_date), 'MMM d')}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {tx.type === 'debt' && tx.due_date && isPast(parseISO(tx.due_date)) && (
                  <button onClick={() => handleSendReminder(tx)} className="text-[hsl(142,70%,45%)] p-1">
                    <MessageCircle size={14} />
                  </button>
                )}
                <span className={`text-sm font-semibold ${tx.type === 'payment' ? 'text-success' : 'text-destructive'}`}>
                  {tx.type === 'payment' ? '-' : '+'}{money(tx.amount)}
                </span>
                <button onClick={() => openEditDialog(tx)} className="text-muted-foreground hover:text-primary p-2">
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setDeleteTxId(tx.id)}
                  className="text-muted-foreground hover:text-destructive p-2"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTxId} onOpenChange={(o) => { if (!o) setDeleteTxId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('customers.deleteTransaction', 'Delete transaction')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('customers.deleteTxConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTx} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
