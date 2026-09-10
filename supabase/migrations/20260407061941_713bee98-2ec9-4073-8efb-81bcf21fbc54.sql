
-- Allow admins to view all customers
CREATE POLICY "Admins can view all customers"
ON public.customers FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update all customers
CREATE POLICY "Admins can update all customers"
ON public.customers FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete all customers
CREATE POLICY "Admins can delete all customers"
ON public.customers FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all transactions
CREATE POLICY "Admins can view all transactions"
ON public.transactions FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update all transactions
CREATE POLICY "Admins can update all transactions"
ON public.transactions FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete all transactions
CREATE POLICY "Admins can delete all transactions"
ON public.transactions FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));
