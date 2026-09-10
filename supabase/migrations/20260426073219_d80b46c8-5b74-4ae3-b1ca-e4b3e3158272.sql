-- Add updated_at + deleted_at (soft delete) to all sync-relevant tables.
-- These are the foundation for last-write-wins bi-directional sync.

-- 1. customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. suppliers
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4. sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 5. sale_items
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 6. expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 7. expense_categories
ALTER TABLE public.expense_categories
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 8. transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 9. stock_alerts
ALTER TABLE public.stock_alerts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- shop_settings already has updated_at; just add deleted_at for consistency
ALTER TABLE public.shop_settings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Indexes to make sync pulls fast (filter by updated_at > last_synced_at)
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON public.customers(updated_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_updated_at ON public.suppliers(updated_at);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON public.products(updated_at);
CREATE INDEX IF NOT EXISTS idx_sales_updated_at ON public.sales(updated_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_updated_at ON public.sale_items(updated_at);
CREATE INDEX IF NOT EXISTS idx_expenses_updated_at ON public.expenses(updated_at);
CREATE INDEX IF NOT EXISTS idx_expense_categories_updated_at ON public.expense_categories(updated_at);
CREATE INDEX IF NOT EXISTS idx_transactions_updated_at ON public.transactions(updated_at);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_updated_at ON public.stock_alerts(updated_at);

-- Auto-touch updated_at on every UPDATE.
-- public.update_updated_at_column() already exists; reuse it.
DO $$
DECLARE
  t TEXT;
  trg_name TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','suppliers','products','sales','sale_items',
    'expenses','expense_categories','transactions','stock_alerts'
  ]
  LOOP
    trg_name := 'set_updated_at_' || t;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trg_name, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      trg_name, t
    );
  END LOOP;
END $$;