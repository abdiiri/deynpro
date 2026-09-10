-- Shop settings (one row per user)
CREATE TABLE public.shop_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  shop_name text NOT NULL DEFAULT '',
  phone text,
  address text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shop settings" ON public.shop_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shop settings" ON public.shop_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shop settings" ON public.shop_settings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shop settings" ON public.shop_settings
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all shop settings" ON public.shop_settings
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Expense categories (per user)
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT 'muted',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories" ON public.expense_categories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.expense_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.expense_categories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.expense_categories
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all categories" ON public.expense_categories
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Add description to suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS description text;

-- Add supplier_id to expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- updated_at trigger for shop_settings
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_shop_settings_updated_at
BEFORE UPDATE ON public.shop_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();