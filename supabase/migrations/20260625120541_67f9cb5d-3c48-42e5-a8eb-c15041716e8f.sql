
-- 1) Restrict tournaments full-row reads to admins only; public uses tournaments_public view
DROP POLICY IF EXISTS "tournaments participant or admin full read" ON public.tournaments;
CREATE POLICY "admins read tournaments" ON public.tournaments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Restrict participants SELECT to self/admin only (remove co-player branch)
DROP POLICY IF EXISTS "participants self admin or coplayer" ON public.tournament_participants;
CREATE POLICY "participants self or admin read" ON public.tournament_participants FOR SELECT TO authenticated
  USING (((auth.uid())::text = user_id) OR public.has_role(auth.uid(), 'admin'));

-- 3) Enforce payment_status on direct user inserts
DROP POLICY IF EXISTS "users insert own participation" ON public.tournament_participants;
CREATE POLICY "users insert own participation" ON public.tournament_participants FOR INSERT TO authenticated
  WITH CHECK (
    (((auth.uid())::text = user_id) AND payment_status = 'pending')
    OR public.has_role(auth.uid(), 'admin')
  );

-- 4) Explicit deny INSERT for wallets and wallet_transactions to non-admin clients
CREATE POLICY "deny direct wallet inserts" ON public.wallets FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "deny direct wallet_txn inserts" ON public.wallet_transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
