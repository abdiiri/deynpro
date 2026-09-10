CREATE POLICY "Users can delete own transactions"
ON public.transactions
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM customers
  WHERE customers.id = transactions.customer_id AND customers.user_id = auth.uid()
));

CREATE POLICY "Users can update own transactions"
ON public.transactions
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM customers
  WHERE customers.id = transactions.customer_id AND customers.user_id = auth.uid()
));