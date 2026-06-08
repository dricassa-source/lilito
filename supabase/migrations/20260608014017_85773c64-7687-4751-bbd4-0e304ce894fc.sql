
CREATE OR REPLACE FUNCTION public.reset_homologacao()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r jsonb := '{}'::jsonb;
  n int;
BEGIN
  IF NOT public.is_master(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.notificacoes;             GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('notificacoes', n);
  DELETE FROM public.lembretes;                GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('lembretes', n);
  DELETE FROM public.atividades;               GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('atividades', n);
  DELETE FROM public.agenda_eventos;           GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('agenda_eventos', n);
  DELETE FROM public.apolices_analises_historico; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('apolices_analises_historico', n);
  DELETE FROM public.apolices;                 GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('apolices', n);
  DELETE FROM public.joint_requests;           GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('joint_requests', n);
  DELETE FROM public.hot_lista_prospects;      GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('hot_lista_prospects', n);
  DELETE FROM public.hot_listas;               GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('hot_listas', n);
  DELETE FROM public.prospects;                GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('prospects', n);
  DELETE FROM public.clientes;                 GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('clientes', n);
  DELETE FROM public.metas;                    GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('metas', n);

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_homologacao() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reset_homologacao() TO authenticated;
