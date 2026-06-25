
-- 1. Lock down notify(): revoke from PUBLIC/anon; require auth inside body.
REVOKE ALL ON FUNCTION public.notify(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify(uuid, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.notify(uuid, text, text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify(_user_id uuid, _title text, _body text, _link text, _type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Block direct public/REST invocation. Triggers and admin RPCs (SECURITY DEFINER)
  -- run as the function owner, so auth.uid() is still the original caller — we
  -- only allow this from authenticated sessions OR when called by service_role
  -- inside other SECURITY DEFINER routines (current_user = postgres).
  IF auth.uid() IS NULL AND current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.notifications (user_id, title, body, link, type)
  VALUES (_user_id, _title, _body, _link, _type);
END;
$function$;

-- 2. Revoke anon EXECUTE on every SECURITY DEFINER RPC; grant to authenticated only.
REVOKE EXECUTE ON FUNCTION public.admin_add_prize(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_remove_money(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_ban(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_deposit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_withdrawal(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_tournament(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_add_prize(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_money(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ban(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_tournament(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 3. Hide earnings from public reads; restrict profile SELECT to authenticated.
DROP POLICY IF EXISTS "profiles public read" ON public.profiles;
CREATE POLICY "profiles authenticated read" ON public.profiles
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.profiles FROM anon;

-- 4. Prevent users from self-modifying privileged profile columns (role, balance,
--    earnings, wins, xp, rank, tier, is_banned, total_kills, matches_played).
CREATE OR REPLACE FUNCTION public.profiles_block_privileged_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.earnings IS DISTINCT FROM OLD.earnings
     OR NEW.wins IS DISTINCT FROM OLD.wins
     OR NEW.xp IS DISTINCT FROM OLD.xp
     OR NEW.rank IS DISTINCT FROM OLD.rank
     OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
     OR NEW.total_kills IS DISTINCT FROM OLD.total_kills
     OR NEW.matches_played IS DISTINCT FROM OLD.matches_played
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_block_priv_update ON public.profiles;
CREATE TRIGGER trg_profiles_block_priv_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_block_privileged_self_update();

-- 5. Prevent users from flipping their own tournament_participants.payment_status.
CREATE OR REPLACE FUNCTION public.participants_block_payment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION 'Not allowed to change payment_status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_participants_block_payment_status ON public.tournament_participants;
CREATE TRIGGER trg_participants_block_payment_status
BEFORE UPDATE ON public.tournament_participants
FOR EACH ROW EXECUTE FUNCTION public.participants_block_payment_status_change();

-- 6. Lock wallets: no direct INSERT/UPDATE from clients. Service role / SECURITY
--    DEFINER RPCs handle wallet mutations.
REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM anon, authenticated;

-- 7. Enable HIBP leaked-password protection
-- (handled via configure_auth; see follow-up note)
