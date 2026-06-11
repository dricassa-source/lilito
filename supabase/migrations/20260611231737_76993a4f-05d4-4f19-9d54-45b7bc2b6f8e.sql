-- Revoke public/anon EXECUTE on SECURITY DEFINER and trigger helper functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_master(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_orphans() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_orphans() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reset_homologacao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_homologacao() TO authenticated, service_role;

-- Trigger-only helpers: no one needs direct EXECUTE
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prospects_calc_score() FROM PUBLIC, anon, authenticated;