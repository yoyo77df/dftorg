
-- Tournaments: admin-only writes
DROP POLICY IF EXISTS "public manage tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "admins manage tournaments" ON public.tournaments;
CREATE POLICY "admins manage tournaments" ON public.tournaments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tournament participants: owner-or-admin writes
DROP POLICY IF EXISTS "participants public create" ON public.tournament_participants;
DROP POLICY IF EXISTS "participants public manage" ON public.tournament_participants;
DROP POLICY IF EXISTS "participants public delete" ON public.tournament_participants;

CREATE POLICY "users insert own participation" ON public.tournament_participants
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users update own participation" ON public.tournament_participants
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid()::text = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users delete own participation" ON public.tournament_participants
  FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id OR public.has_role(auth.uid(), 'admin'));

-- join_tournament: use auth.uid() instead of caller-supplied id
DROP FUNCTION IF EXISTS public.join_tournament(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.join_tournament(uuid, text, text);

CREATE OR REPLACE FUNCTION public.join_tournament(_tournament_id uuid, _team_name text, _igl_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _t public.tournaments;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _t FROM public.tournaments WHERE id = _tournament_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  IF _t.joined_slots >= _t.total_slots THEN RAISE EXCEPTION 'Tournament is full'; END IF;
  IF _t.status NOT IN ('upcoming','live') THEN RAISE EXCEPTION 'Tournament is closed'; END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_participants WHERE tournament_id = _tournament_id AND user_id = _uid::text) THEN
    RAISE EXCEPTION 'Already joined';
  END IF;

  INSERT INTO public.tournament_participants (tournament_id, user_id, team_name, igl_name)
    VALUES (_tournament_id, _uid::text, _team_name, _igl_name);
  UPDATE public.tournaments SET joined_slots = joined_slots + 1,
    status = CASE WHEN joined_slots + 1 >= total_slots THEN 'full' ELSE status END,
    updated_at = now() WHERE id = _tournament_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.join_tournament(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_tournament(uuid, text, text) TO authenticated;
