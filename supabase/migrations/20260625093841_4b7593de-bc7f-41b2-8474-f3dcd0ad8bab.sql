DROP POLICY IF EXISTS "admins manage tournaments" ON public.tournaments;
CREATE POLICY "public manage tournaments" ON public.tournaments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO anon, authenticated;