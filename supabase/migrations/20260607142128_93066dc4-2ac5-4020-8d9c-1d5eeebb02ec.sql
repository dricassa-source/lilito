
-- 1. agenda_eventos: delay + joint + recorrencia
ALTER TABLE public.agenda_eventos
  ADD COLUMN IF NOT EXISTS delay_motivo TEXT,
  ADD COLUMN IF NOT EXISTS delay_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delay_resolvido BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS etapa_origem TEXT,
  ADD COLUMN IF NOT EXISTS joint_consultor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recorrencia_id UUID;

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_delay ON public.agenda_eventos (delay_resolvido, delay_em) WHERE delay_em IS NOT NULL;

-- 2. profiles.unidade
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unidade TEXT;

-- 3. prospects.score (1-5)
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS score SMALLINT;

CREATE OR REPLACE FUNCTION public.prospects_calc_score()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  s_renda INT := COALESCE(NEW.score_renda, 0);
  s_patr  INT := COALESCE(NEW.score_patrimonio, 0);
  s_nec   INT := COALESCE(NEW.score_necessidade, 0);
  s_inf   INT := COALESCE(NEW.score_influencia, 0);
  total   NUMERIC;
  bucket  SMALLINT;
BEGIN
  IF NEW.nota_qualificacao IS NOT NULL THEN
    total := NEW.nota_qualificacao;
    IF total >= 80 THEN bucket := 5;
    ELSIF total >= 60 THEN bucket := 4;
    ELSIF total >= 40 THEN bucket := 3;
    ELSIF total >= 20 THEN bucket := 2;
    ELSE bucket := 1;
    END IF;
  ELSE
    total := (s_renda + s_patr + s_nec + s_inf);
    IF total >= 16 THEN bucket := 5;
    ELSIF total >= 12 THEN bucket := 4;
    ELSIF total >= 8 THEN bucket := 3;
    ELSIF total >= 4 THEN bucket := 2;
    ELSE bucket := 1;
    END IF;
  END IF;
  NEW.score := bucket;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prospects_calc_score ON public.prospects;
CREATE TRIGGER trg_prospects_calc_score BEFORE INSERT OR UPDATE ON public.prospects
FOR EACH ROW EXECUTE FUNCTION public.prospects_calc_score();

UPDATE public.prospects SET updated_at = updated_at WHERE score IS NULL;

-- 4. compromissos_recorrentes
CREATE TABLE IF NOT EXISTS public.compromissos_recorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('reuniao_unidade','treinamento','rote','ab_fone','outro')),
  data_inicial DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  frequencia TEXT NOT NULL CHECK (frequencia IN ('semanal','quinzenal','mensal')),
  participantes UUID[] NOT NULL DEFAULT '{}',
  criado_por UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compromissos_recorrentes TO authenticated;
GRANT ALL ON public.compromissos_recorrentes TO service_role;

ALTER TABLE public.compromissos_recorrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master gerencia recorrentes" ON public.compromissos_recorrentes
  FOR ALL TO authenticated
  USING (public.is_master(auth.uid()))
  WITH CHECK (public.is_master(auth.uid()));

CREATE POLICY "Participantes leem recorrentes" ON public.compromissos_recorrentes
  FOR SELECT TO authenticated
  USING (auth.uid() = ANY(participantes) OR auth.uid() = criado_por OR public.is_master(auth.uid()));

CREATE TRIGGER trg_recorrentes_updated_at BEFORE UPDATE ON public.compromissos_recorrentes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
