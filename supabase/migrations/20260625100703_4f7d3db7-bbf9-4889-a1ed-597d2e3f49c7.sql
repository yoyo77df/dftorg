DROP POLICY IF EXISTS "users join tournaments" ON public.tournament_participants;
DROP POLICY IF EXISTS "admins manage participants" ON public.tournament_participants;
DROP POLICY IF EXISTS "admins delete participants" ON public.tournament_participants;
DROP POLICY IF EXISTS "participants public read" ON public.tournament_participants;
DROP POLICY IF EXISTS "participants public create" ON public.tournament_participants;
DROP POLICY IF EXISTS "participants public manage" ON public.tournament_participants;
DROP POLICY IF EXISTS "participants public delete" ON public.tournament_participants;

ALTER TABLE public.tournament_participants
  DROP CONSTRAINT IF EXISTS tournament_participants_user_id_fkey;

ALTER TABLE public.tournament_participants
  ALTER COLUMN user_id TYPE text USING user_id::text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_participants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_participants TO authenticated;
GRANT ALL ON public.tournament_participants TO service_role;

CREATE POLICY "participants public read"
ON public.tournament_participants
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "participants public create"
ON public.tournament_participants
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "participants public manage"
ON public.tournament_participants
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "participants public delete"
ON public.tournament_participants
FOR DELETE
TO anon, authenticated
USING (true);

DROP FUNCTION IF EXISTS public.join_tournament(uuid, text, text);
DROP FUNCTION IF EXISTS public.join_tournament(uuid, text, text, text);

CREATE FUNCTION public.join_tournament(_tournament_id uuid, _team_name text, _igl_name text, _user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid text := _user_id;
  _t public.tournaments;
BEGIN
  IF _uid IS NULL OR length(trim(_uid)) = 0 THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _t FROM public.tournaments WHERE id = _tournament_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'; END IF;
  IF _t.joined_slots >= _t.total_slots THEN RAISE EXCEPTION 'Tournament is full'; END IF;
  IF _t.status NOT IN ('upcoming','live') THEN RAISE EXCEPTION 'Tournament is closed'; END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_participants WHERE tournament_id = _tournament_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'Already joined';
  END IF;

  INSERT INTO public.tournament_participants (tournament_id, user_id, team_name, igl_name)
    VALUES (_tournament_id, _uid, _team_name, _igl_name);
  UPDATE public.tournaments SET joined_slots = joined_slots + 1,
    status = CASE WHEN joined_slots + 1 >= total_slots THEN 'full' ELSE status END,
    updated_at = now() WHERE id = _tournament_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;