
-- Ban flag on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- Admin: add prize money (or any credit) to a user's wallet
CREATE OR REPLACE FUNCTION public.admin_add_prize(_user_id uuid, _amount numeric, _note text DEFAULT 'Prize money')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets SET balance = balance + _amount, updated_at = now() WHERE user_id = _user_id;
  UPDATE public.profiles SET earnings = earnings + _amount, updated_at = now() WHERE id = _user_id;
  INSERT INTO public.wallet_transactions (user_id, type, amount, description)
    VALUES (_user_id, 'prize', _amount, _note);
END;
$$;

-- Admin: ban / unban a user
CREATE OR REPLACE FUNCTION public.admin_set_ban(_user_id uuid, _banned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.profiles SET is_banned = _banned, updated_at = now() WHERE id = _user_id;
END;
$$;
