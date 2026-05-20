CREATE OR REPLACE FUNCTION public.admin_remove_money(_user_id uuid, _amount numeric, _note text DEFAULT 'Admin deduction')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _bal NUMERIC;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _bal IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF _bal < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.wallets SET balance = balance - _amount, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO public.wallet_transactions (user_id, type, amount, description)
    VALUES (_user_id, 'admin_remove', -_amount, _note);
  PERFORM public.notify(_user_id, '⚠️ Balance Adjusted',
    '৳' || _amount || ' deducted from your wallet by admin. Reason: ' || _note, '/wallet', 'admin_remove');
END;
$$;