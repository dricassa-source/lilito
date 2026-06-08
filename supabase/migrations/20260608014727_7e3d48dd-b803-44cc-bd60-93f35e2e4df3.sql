
CREATE OR REPLACE FUNCTION public.reset_homologacao()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r jsonb := '{}'::jsonb;
  n int;
BEGIN
  IF NOT public.is_master(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 1) Dependentes primeiro (sempre com WHERE id IS NOT NULL para evitar DELETE sem filtro)
  DELETE FROM public.notificacoes WHERE id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('notificacoes', n);

  DELETE FROM public.lembretes WHERE id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('lembretes', n);

  DELETE FROM public.atividades WHERE id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('atividades', n);

  DELETE FROM public.agenda_eventos WHERE id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('agenda_eventos', n);

  DELETE FROM public.apolices_analises_historico WHERE id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('apolices_analises_historico', n);

  DELETE FROM public.apolices WHERE id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('apolices', n);

  DELETE FROM public.joint_requests WHERE id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('joint_requests', n);

  DELETE FROM public.hot_lista_prospects WHERE prospect_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('hot_lista_prospects', n);

  DELETE FROM public.hot_listas WHERE id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('hot_listas', n);

  -- 2) Entidades raiz
  DELETE FROM public.prospects WHERE id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('prospects', n);

  DELETE FROM public.clientes WHERE id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('clientes', n);

  DELETE FROM public.metas WHERE id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('metas', n);

  RETURN r;
END;
$function$;
