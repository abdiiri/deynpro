
-- Update existing 'customer' roles to 'user'
UPDATE public.user_roles SET role = 'user' WHERE role = 'customer';

-- Update the default on the column
ALTER TABLE public.user_roles ALTER COLUMN role SET DEFAULT 'user'::app_role;

-- Update the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
