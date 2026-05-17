
-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- NULL = broadcast to all
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_created ON public.notifications (created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or broadcast" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "update own read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins manage" ON public.notifications
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Helper: insert notification (security definer so triggers can broadcast)
CREATE OR REPLACE FUNCTION public.notify(_user_id UUID, _title TEXT, _body TEXT, _link TEXT, _type TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, link, type)
  VALUES (_user_id, _title, _body, _link, _type);
END;
$$;

-- Tournament events
CREATE OR REPLACE FUNCTION public.tournament_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify(NULL,
      '🏆 New Tournament Released',
      NEW.title || ' — ' || NEW.game || ' ' || NEW.mode || '. Entry ৳' || NEW.entry_fee,
      '/tournaments/' || NEW.id::text,
      'tournament_new');
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.room_id IS DISTINCT FROM NEW.room_id OR OLD.room_password IS DISTINCT FROM NEW.room_password)
       AND NEW.room_id IS NOT NULL AND NEW.room_password IS NOT NULL THEN
      PERFORM public.notify(NULL,
        '🔑 Room ID & Password Released',
        NEW.title || ' — Room details are now live!',
        '/tournaments/' || NEW.id::text,
        'tournament_room');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tournament_notify_trg
AFTER INSERT OR UPDATE ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.tournament_notify();

-- Hook into approve_deposit
CREATE OR REPLACE FUNCTION public.approve_deposit(_deposit_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _d public.deposits;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO _d FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF _d.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;
  UPDATE public.deposits SET status = 'approved', reviewed_at = now() WHERE id = _deposit_id;
  UPDATE public.wallets SET balance = balance + _d.amount, updated_at = now() WHERE user_id = _d.user_id;
  INSERT INTO public.wallet_transactions (user_id, type, amount, description)
    VALUES (_d.user_id, 'deposit', _d.amount, _d.method || ' deposit approved');
  PERFORM public.notify(_d.user_id, '✅ Deposit Approved',
    '৳' || _d.amount || ' added to your wallet via ' || _d.method, '/wallet', 'deposit_approved');
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(_withdrawal_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _w public.withdrawals; _bal NUMERIC;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id = _withdrawal_id FOR UPDATE;
  IF _w.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _w.user_id FOR UPDATE;
  IF _bal < _w.amount THEN RAISE EXCEPTION 'User balance insufficient'; END IF;
  UPDATE public.withdrawals SET status = 'approved', reviewed_at = now() WHERE id = _withdrawal_id;
  UPDATE public.wallets SET balance = balance - _w.amount, updated_at = now() WHERE user_id = _w.user_id;
  INSERT INTO public.wallet_transactions (user_id, type, amount, description)
    VALUES (_w.user_id, 'withdrawal', -_w.amount, _w.method || ' withdrawal approved');
  PERFORM public.notify(_w.user_id, '✅ Withdrawal Approved',
    '৳' || _w.amount || ' sent to ' || _w.phone || ' via ' || _w.method, '/wallet', 'withdrawal_approved');
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_add_prize(_user_id uuid, _amount numeric, _note text DEFAULT 'Prize money'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.wallets SET balance = balance + _amount, updated_at = now() WHERE user_id = _user_id;
  UPDATE public.profiles SET earnings = earnings + _amount, updated_at = now() WHERE id = _user_id;
  INSERT INTO public.wallet_transactions (user_id, type, amount, description)
    VALUES (_user_id, 'prize', _amount, _note);
  PERFORM public.notify(_user_id, '🎁 Prize Credited',
    '৳' || _amount || ' prize money added to your wallet', '/wallet', 'prize');
END;
$function$;

-- Notify on deposit/withdrawal reject (via UPDATE trigger)
CREATE OR REPLACE FUNCTION public.deposit_status_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
    PERFORM public.notify(NEW.user_id, '❌ Deposit Rejected',
      '৳' || NEW.amount || ' deposit request was rejected. Contact support.', '/wallet', 'deposit_rejected');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER deposit_status_notify_trg AFTER UPDATE ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.deposit_status_notify();

CREATE OR REPLACE FUNCTION public.withdrawal_status_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
    PERFORM public.notify(NEW.user_id, '❌ Withdrawal Rejected',
      '৳' || NEW.amount || ' withdrawal request was rejected.', '/wallet', 'withdrawal_rejected');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER withdrawal_status_notify_trg AFTER UPDATE ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.withdrawal_status_notify();

-- Notify when user submits deposit/withdrawal (confirmation)
CREATE OR REPLACE FUNCTION public.deposit_created_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify(NEW.user_id, '⏳ Deposit Submitted',
    '৳' || NEW.amount || ' deposit pending admin approval.', '/wallet', 'deposit_pending');
  RETURN NEW;
END;
$$;
CREATE TRIGGER deposit_created_notify_trg AFTER INSERT ON public.deposits
FOR EACH ROW EXECUTE FUNCTION public.deposit_created_notify();

CREATE OR REPLACE FUNCTION public.withdrawal_created_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify(NEW.user_id, '⏳ Withdrawal Submitted',
    '৳' || NEW.amount || ' withdrawal request pending approval.', '/wallet', 'withdrawal_pending');
  RETURN NEW;
END;
$$;
CREATE TRIGGER withdrawal_created_notify_trg AFTER INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.withdrawal_created_notify();

-- Notify on tournament join
CREATE OR REPLACE FUNCTION public.tournament_join_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _title TEXT;
BEGIN
  SELECT title INTO _title FROM public.tournaments WHERE id = NEW.tournament_id;
  PERFORM public.notify(NEW.user_id, '🎮 Joined Tournament',
    'You joined: ' || COALESCE(_title, 'tournament') || ' as team ' || NEW.team_name,
    '/tournaments/' || NEW.tournament_id::text, 'tournament_join');
  RETURN NEW;
END;
$$;
CREATE TRIGGER tournament_join_notify_trg AFTER INSERT ON public.tournament_participants
FOR EACH ROW EXECUTE FUNCTION public.tournament_join_notify();
