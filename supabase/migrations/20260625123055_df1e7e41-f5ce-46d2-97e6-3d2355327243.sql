
-- 1) Attach the privileged-field block trigger to profiles (function existed, trigger did not)
DROP TRIGGER IF EXISTS profiles_block_privileged_self_update_trg ON public.profiles;
CREATE TRIGGER profiles_block_privileged_self_update_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_block_privileged_self_update();

-- Also attach the participants payment_status guard
DROP TRIGGER IF EXISTS participants_block_payment_status_change_trg ON public.tournament_participants;
CREATE TRIGGER participants_block_payment_status_change_trg
BEFORE UPDATE ON public.tournament_participants
FOR EACH ROW EXECUTE FUNCTION public.participants_block_payment_status_change();

-- 2) Allow confirmed paid/free participants to SELECT their tournament row (incl. room credentials)
DROP POLICY IF EXISTS "participants read joined tournaments" ON public.tournaments;
CREATE POLICY "participants read joined tournaments"
ON public.tournaments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tournament_participants tp
    WHERE tp.tournament_id = tournaments.id
      AND tp.user_id = auth.uid()::text
      AND tp.payment_status IN ('paid','free')
  )
);
