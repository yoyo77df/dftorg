
DROP POLICY IF EXISTS "tournaments public read" ON public.tournaments;

CREATE POLICY "tournaments participant or admin full read" ON public.tournaments
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.tournament_participants tp
    WHERE tp.tournament_id = tournaments.id AND tp.user_id = (auth.uid())::text
  )
);

CREATE OR REPLACE VIEW public.tournaments_public AS
SELECT id, title, game, mode, banner_url, description, rules, map,
       entry_fee, prize_pool, prize_first, prize_second, prize_third,
       total_slots, joined_slots, start_time, status, created_at, updated_at
FROM public.tournaments;

GRANT SELECT ON public.tournaments_public TO anon, authenticated;

DROP POLICY IF EXISTS "participants public read" ON public.tournament_participants;
CREATE POLICY "participants self admin or coplayer" ON public.tournament_participants
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR (auth.uid())::text = user_id
  OR EXISTS (
    SELECT 1 FROM public.tournament_participants me
    WHERE me.tournament_id = tournament_participants.tournament_id
      AND me.user_id = (auth.uid())::text
  )
);

CREATE OR REPLACE FUNCTION public.join_tournament(_tournament_id uuid, _team_name text, _igl_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _t public.tournaments;
  _bal numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _t FROM public.tournaments WHERE id = _tournament_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  IF _t.joined_slots >= _t.total_slots THEN RAISE EXCEPTION 'Tournament is full'; END IF;
  IF _t.status NOT IN ('upcoming','live') THEN RAISE EXCEPTION 'Tournament is closed'; END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_participants WHERE tournament_id = _tournament_id AND user_id = _uid::text) THEN
    RAISE EXCEPTION 'Already joined';
  END IF;

  IF COALESCE(_t.entry_fee, 0) > 0 THEN
    SELECT balance INTO _bal FROM public.wallets WHERE user_id = _uid FOR UPDATE;
    IF _bal IS NULL OR _bal < _t.entry_fee THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
    UPDATE public.wallets SET balance = balance - _t.entry_fee, updated_at = now() WHERE user_id = _uid;
    INSERT INTO public.wallet_transactions (user_id, type, amount, description)
      VALUES (_uid, 'tournament_entry', -_t.entry_fee, 'Entry: ' || _t.title);
  END IF;

  INSERT INTO public.tournament_participants (tournament_id, user_id, team_name, igl_name, payment_status)
    VALUES (_tournament_id, _uid::text, _team_name, _igl_name,
            CASE WHEN COALESCE(_t.entry_fee,0) > 0 THEN 'paid' ELSE 'free' END);
  UPDATE public.tournaments SET joined_slots = joined_slots + 1,
    status = CASE WHEN joined_slots + 1 >= total_slots THEN 'full' ELSE status END,
    updated_at = now() WHERE id = _tournament_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;
