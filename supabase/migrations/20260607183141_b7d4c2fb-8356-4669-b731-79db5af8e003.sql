
ALTER TABLE public.hot_listas ALTER COLUMN data_inicio DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.hot_lista_prospects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lista_id UUID NOT NULL REFERENCES public.hot_listas(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lista_id, prospect_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hot_lista_prospects TO authenticated;
GRANT ALL ON public.hot_lista_prospects TO service_role;

ALTER TABLE public.hot_lista_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultor gerencia membros das suas listas HOT"
ON public.hot_lista_prospects
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hot_listas l
    WHERE l.id = hot_lista_prospects.lista_id
      AND (l.consultor_id = auth.uid() OR public.is_master(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hot_listas l
    WHERE l.id = hot_lista_prospects.lista_id
      AND (l.consultor_id = auth.uid() OR public.is_master(auth.uid()))
  )
);

CREATE INDEX IF NOT EXISTS idx_hot_lp_lista ON public.hot_lista_prospects(lista_id);
CREATE INDEX IF NOT EXISTS idx_hot_lp_prospect ON public.hot_lista_prospects(prospect_id);
