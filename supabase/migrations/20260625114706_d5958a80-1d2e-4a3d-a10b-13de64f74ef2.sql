
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tournament_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tournament_join_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deposit_created_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deposit_status_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.withdrawal_created_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.withdrawal_status_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_block_privileged_self_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.participants_block_payment_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, text, text, text) FROM PUBLIC;
