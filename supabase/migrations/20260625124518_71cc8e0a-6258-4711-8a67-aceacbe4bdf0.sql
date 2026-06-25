
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND earnings IS NOT DISTINCT FROM (SELECT earnings FROM public.profiles WHERE id = auth.uid())
    AND wins IS NOT DISTINCT FROM (SELECT wins FROM public.profiles WHERE id = auth.uid())
    AND xp IS NOT DISTINCT FROM (SELECT xp FROM public.profiles WHERE id = auth.uid())
    AND rank IS NOT DISTINCT FROM (SELECT rank FROM public.profiles WHERE id = auth.uid())
    AND is_banned IS NOT DISTINCT FROM (SELECT is_banned FROM public.profiles WHERE id = auth.uid())
    AND total_kills IS NOT DISTINCT FROM (SELECT total_kills FROM public.profiles WHERE id = auth.uid())
    AND matches_played IS NOT DISTINCT FROM (SELECT matches_played FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "update own read" ON public.notifications;
CREATE POLICY "update own read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
