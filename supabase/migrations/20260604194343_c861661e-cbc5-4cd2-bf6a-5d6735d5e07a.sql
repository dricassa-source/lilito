CREATE TABLE public.hot_listas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hot_listas TO authenticated;
GRANT ALL ON public.hot_listas TO service_role;

ALTER TABLE public.hot_listas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultor gerencia suas listas HOT"
  ON public.hot_listas FOR ALL TO authenticated
  USING (consultor_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (consultor_id = auth.uid() OR public.is_master(auth.uid()));

CREATE TRIGGER trg_hot_listas_updated
  BEFORE UPDATE ON public.hot_listas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_hot_listas_consultor ON public.hot_listas(consultor_id);