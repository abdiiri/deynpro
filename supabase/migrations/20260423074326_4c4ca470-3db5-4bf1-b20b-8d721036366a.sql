ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT blocked FROM public.user_roles WHERE user_id = _user_id LIMIT 1), false)
$$;