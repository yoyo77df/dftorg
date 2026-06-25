
-- Allow admins to delete deposits, withdrawals, transactions, participants, tournaments (already covered), profiles
CREATE POLICY "admins delete deposits" ON public.deposits FOR DELETE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete withdrawals" ON public.withdrawals FOR DELETE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete txns" ON public.wallet_transactions FOR DELETE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete participants" ON public.tournament_participants FOR DELETE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete profiles" ON public.profiles FOR DELETE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete notifications" ON public.notifications FOR DELETE USING (has_role(auth.uid(), 'admin'));
