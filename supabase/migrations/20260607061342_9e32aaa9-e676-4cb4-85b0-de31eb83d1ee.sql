
-- Enums
DO $$ BEGIN
  CREATE TYPE public.onboarding_status AS ENUM (
    'nao_aplicavel','documentacao_pendente','exames_pendentes','entrevista_pendente',
    'pagamento_pendente','em_underwriting','outras_pendencias','emitida'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.joint_status AS ENUM ('nenhum','pendente','aprovado','rejeitado','confirmado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.meta_periodo AS ENUM ('mensal','trimestral','anual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend tipo_evento with VINCA categories
ALTER TYPE public.tipo_evento ADD VALUE IF NOT EXISTS 'pessoal';
ALTER TYPE public.tipo_evento ADD VALUE IF NOT EXISTS 'treinamento';
ALTER TYPE public.tipo_evento ADD VALUE IF NOT EXISTS 'reuniao_agencia';
ALTER TYPE public.tipo_evento ADD VALUE IF NOT EXISTS 'bloqueio';
ALTER TYPE public.tipo_evento ADD VALUE IF NOT EXISTS 'lembrete';

-- Apolices onboarding
ALTER TABLE public.apolices
  ADD COLUMN IF NOT EXISTS onboarding_status public.onboarding_status NOT NULL DEFAULT 'nao_aplicavel',
  ADD COLUMN IF NOT EXISTS data_fechamento timestamptz,
  ADD COLUMN IF NOT EXISTS data_emissao timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_observacao text;

-- Joint status on event
ALTER TABLE public.agenda_eventos
  ADD COLUMN IF NOT EXISTS joint_status public.joint_status NOT NULL DEFAULT 'nenhum',
  ADD COLUMN IF NOT EXISTS joint_master_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resultado text;

-- =============== Lembretes ===============
CREATE TABLE IF NOT EXISTS public.lembretes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  data date NOT NULL,
  hora time,
  observacao text,
  concluido boolean NOT NULL DEFAULT false,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lembretes TO authenticated;
GRANT ALL ON public.lembretes TO service_role;
ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lembretes: owner or master" ON public.lembretes;
CREATE POLICY "lembretes: owner or master" ON public.lembretes
  FOR ALL TO authenticated
  USING (consultor_id = auth.uid() OR is_master(auth.uid()))
  WITH CHECK (consultor_id = auth.uid() OR is_master(auth.uid()));
DROP TRIGGER IF EXISTS tg_lembretes_updated ON public.lembretes;
CREATE TRIGGER tg_lembretes_updated BEFORE UPDATE ON public.lembretes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== Joint Requests ===============
CREATE TABLE IF NOT EXISTS public.joint_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.agenda_eventos(id) ON DELETE CASCADE,
  consultor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  master_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.joint_status NOT NULL DEFAULT 'pendente',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.joint_requests TO authenticated;
GRANT ALL ON public.joint_requests TO service_role;
ALTER TABLE public.joint_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "joint_requests: owner or master" ON public.joint_requests;
CREATE POLICY "joint_requests: owner or master" ON public.joint_requests
  FOR ALL TO authenticated
  USING (consultor_id = auth.uid() OR is_master(auth.uid()))
  WITH CHECK (consultor_id = auth.uid() OR is_master(auth.uid()));
DROP TRIGGER IF EXISTS tg_joint_updated ON public.joint_requests;
CREATE TRIGGER tg_joint_updated BEFORE UPDATE ON public.joint_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== Metas ===============
CREATE TABLE IF NOT EXISTS public.metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- null = meta da unidade
  periodo public.meta_periodo NOT NULL DEFAULT 'mensal',
  ano int NOT NULL,
  mes int, -- 1..12 quando mensal; trimestre 1..4 quando trimestral
  meta_apolices int NOT NULL DEFAULT 0,
  meta_pa numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_metas_consultor ON public.metas(consultor_id, ano, mes);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas TO authenticated;
GRANT ALL ON public.metas TO service_role;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metas: read all auth" ON public.metas;
CREATE POLICY "metas: read all auth" ON public.metas
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "metas: master writes" ON public.metas;
CREATE POLICY "metas: master writes" ON public.metas
  FOR ALL TO authenticated
  USING (is_master(auth.uid()))
  WITH CHECK (is_master(auth.uid()));
DROP TRIGGER IF EXISTS tg_metas_updated ON public.metas;
CREATE TRIGGER tg_metas_updated BEFORE UPDATE ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== Configurações ===============
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  atualizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.configuracoes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "config: read all auth" ON public.configuracoes;
CREATE POLICY "config: read all auth" ON public.configuracoes
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "config: master writes" ON public.configuracoes;
CREATE POLICY "config: master writes" ON public.configuracoes
  FOR ALL TO authenticated
  USING (is_master(auth.uid()))
  WITH CHECK (is_master(auth.uid()));
DROP TRIGGER IF EXISTS tg_config_updated ON public.configuracoes;
CREATE TRIGGER tg_config_updated BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== Frases de Cultura ===============
CREATE TABLE IF NOT EXISTS public.frases_cultura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.frases_cultura TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.frases_cultura TO authenticated;
GRANT ALL ON public.frases_cultura TO service_role;
ALTER TABLE public.frases_cultura ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "frases: read all" ON public.frases_cultura;
CREATE POLICY "frases: read all" ON public.frases_cultura
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "frases: master writes" ON public.frases_cultura;
CREATE POLICY "frases: master writes" ON public.frases_cultura
  FOR ALL TO authenticated
  USING (is_master(auth.uid()))
  WITH CHECK (is_master(auth.uid()));
DROP TRIGGER IF EXISTS tg_frases_updated ON public.frases_cultura;
CREATE TRIGGER tg_frases_updated BEFORE UPDATE ON public.frases_cultura
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed cultura
INSERT INTO public.frases_cultura (texto, ordem) VALUES
  ('Quem resolve a semana resolve o mês.', 1),
  ('Isso é simples. Mas não é fácil.', 2),
  ('Todo mundo quer ir para o céu. Mas ninguém quer morrer.', 3),
  ('O copo tem borda. O oceano não.', 4),
  ('C = C — Contribuição é igual à Compensação.', 5),
  ('O que você faz diariamente determina seu resultado mensal.', 6)
ON CONFLICT DO NOTHING;
