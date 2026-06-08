
CREATE OR REPLACE FUNCTION public.cleanup_orphans()
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

  DELETE FROM public.atividades
    WHERE (prospect_id IS NOT NULL AND prospect_id NOT IN (SELECT id FROM public.prospects))
       OR (cliente_id  IS NOT NULL AND cliente_id  NOT IN (SELECT id FROM public.clientes));
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('atividades', n);

  DELETE FROM public.agenda_eventos
    WHERE (prospect_id IS NOT NULL AND prospect_id NOT IN (SELECT id FROM public.prospects))
       OR (cliente_id  IS NOT NULL AND cliente_id  NOT IN (SELECT id FROM public.clientes));
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('agenda_eventos', n);

  DELETE FROM public.lembretes
    WHERE prospect_id IS NOT NULL AND prospect_id NOT IN (SELECT id FROM public.prospects);
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('lembretes', n);

  DELETE FROM public.hot_lista_prospects
    WHERE prospect_id NOT IN (SELECT id FROM public.prospects)
       OR lista_id    NOT IN (SELECT id FROM public.hot_listas);
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('hot_lista_prospects', n);

  DELETE FROM public.apolices
    WHERE (prospect_id IS NOT NULL AND prospect_id NOT IN (SELECT id FROM public.prospects))
       OR (cliente_id  IS NOT NULL AND cliente_id  NOT IN (SELECT id FROM public.clientes));
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('apolices', n);

  DELETE FROM public.notificacoes
    WHERE prospect_id IS NOT NULL AND prospect_id NOT IN (SELECT id FROM public.prospects);
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('notificacoes', n);

  RETURN r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_orphans() TO authenticated;
