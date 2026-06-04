
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('master', 'consultor');
CREATE TYPE public.etapa_funil AS ENUM ('recomendacao','hot','ab','analise_apolice','fechamento','implantacao','cliente','pos_venda','perdido');
CREATE TYPE public.origem_prospect AS ENUM ('recomendacao','prospeccao_ativa','hospital','evento','redes_sociais','parceria','reativacao');
CREATE TYPE public.status_hot AS ENUM ('pendente','agendou','pensando','ligar_depois','nao_atendeu','sem_interesse');
CREATE TYPE public.tipo_atividade AS ENUM ('ligacao','whatsapp','agendamento','ab','fechamento','revisita','joint_work','analise_apolice','review','recomendacao');
CREATE TYPE public.tipo_evento AS ENUM ('ab','fechamento','revisita','joint_work','review');
CREATE TYPE public.seguradora AS ENUM ('metlife','prudential','icatu','mag','bradesco','sulamerica','porto','azos','outra');
CREATE TYPE public.tipo_apolice AS ENUM ('whole_life','temporario');
CREATE TYPE public.status_apolice AS ENUM ('em_analise','apresentado','em_negociacao','migrado','nao_migrado');
CREATE TYPE public.status_analise_ia AS ENUM ('nao_analisado','em_processamento','concluido','erro');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  telefone TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_master(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'master'::public.app_role) $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Trigger: cria profile + role consultor no signup; primeiro usuário vira master
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total_users INT;
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)));
  SELECT COUNT(*) INTO total_users FROM auth.users;
  IF total_users <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'master');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'consultor');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Policies profiles
CREATE POLICY "profiles: self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "profiles: self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "profiles: master insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "profiles: master delete" ON public.profiles FOR DELETE TO authenticated USING (public.is_master(auth.uid()));

-- Policies user_roles
CREATE POLICY "user_roles: self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "user_roles: master manage" ON public.user_roles FOR ALL TO authenticated USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

CREATE TRIGGER tg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROSPECTS ============
CREATE TABLE public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  cidade TEXT,
  especialidade_medica TEXT,
  estado_civil TEXT,
  filhos INT DEFAULT 0,
  conjuge TEXT,
  renda_estimada NUMERIC,
  patrimonio_estimado NUMERIC,
  quem_recomendou TEXT,
  observacoes TEXT,
  origem public.origem_prospect NOT NULL DEFAULT 'recomendacao',
  etapa_funil public.etapa_funil NOT NULL DEFAULT 'recomendacao',
  status_hot public.status_hot DEFAULT 'pendente',
  score_patrimonio INT DEFAULT 0,
  score_renda INT DEFAULT 0,
  score_necessidade INT DEFAULT 0,
  score_influencia INT DEFAULT 0,
  nota_qualificacao INT GENERATED ALWAYS AS (score_patrimonio + score_renda + score_necessidade + score_influencia) STORED,
  pa_estimado NUMERIC DEFAULT 0,
  ultima_interacao TIMESTAMPTZ,
  entrou_etapa_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo_perda TEXT,
  data_nascimento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO authenticated;
GRANT ALL ON public.prospects TO service_role;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prospects: consultor owns or master" ON public.prospects FOR ALL TO authenticated
  USING (consultor_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (consultor_id = auth.uid() OR public.is_master(auth.uid()));
CREATE TRIGGER tg_prospects_updated BEFORE UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_prospects_consultor ON public.prospects(consultor_id);
CREATE INDEX idx_prospects_etapa ON public.prospects(etapa_funil);

-- ============ CLIENTES ============
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  familia TEXT,
  telefone TEXT,
  email TEXT,
  pa_total NUMERIC DEFAULT 0,
  capital_segurado NUMERIC DEFAULT 0,
  ultima_revisao DATE,
  proxima_revisao DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes: consultor owns or master" ON public.clientes FOR ALL TO authenticated
  USING (consultor_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (consultor_id = auth.uid() OR public.is_master(auth.uid()));
CREATE TRIGGER tg_clientes_updated BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_clientes_consultor ON public.clientes(consultor_id);

-- ============ ATIVIDADES ============
CREATE TABLE public.atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo public.tipo_atividade NOT NULL,
  resultado TEXT,
  observacao TEXT,
  follow_up_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividades TO authenticated;
GRANT ALL ON public.atividades TO service_role;
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atividades: consultor owns or master" ON public.atividades FOR ALL TO authenticated
  USING (consultor_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (consultor_id = auth.uid() OR public.is_master(auth.uid()));
CREATE INDEX idx_atividades_consultor ON public.atividades(consultor_id);
CREATE INDEX idx_atividades_prospect ON public.atividades(prospect_id);

-- ============ AGENDA ============
CREATE TABLE public.agenda_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  tipo public.tipo_evento NOT NULL,
  titulo TEXT NOT NULL,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  local TEXT,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'agendado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_eventos TO authenticated;
GRANT ALL ON public.agenda_eventos TO service_role;
ALTER TABLE public.agenda_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agenda: consultor owns or master" ON public.agenda_eventos FOR ALL TO authenticated
  USING (consultor_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (consultor_id = auth.uid() OR public.is_master(auth.uid()));
CREATE TRIGGER tg_agenda_updated BEFORE UPDATE ON public.agenda_eventos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_agenda_consultor_inicio ON public.agenda_eventos(consultor_id, inicio);

-- ============ APOLICES ============
CREATE TABLE public.apolices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  seguradora public.seguradora NOT NULL DEFAULT 'outra',
  produto TEXT,
  tipo public.tipo_apolice,
  capital_segurado NUMERIC,
  premio_atual NUMERIC,
  prazo TEXT,
  resgate BOOLEAN DEFAULT false,
  coberturas JSONB DEFAULT '[]'::jsonb,
  exclusoes JSONB DEFAULT '[]'::jsonb,
  doencas_graves BOOLEAN DEFAULT false,
  invalidez BOOLEAN DEFAULT false,
  cirurgias BOOLEAN DEFAULT false,
  funeral BOOLEAN DEFAULT false,
  observacoes_consultor TEXT,
  estrategia_recomendacao TEXT,
  status public.status_apolice NOT NULL DEFAULT 'em_analise',
  pdf_path TEXT,
  -- Campos para IA (Fase 1.1)
  resumo_ia TEXT,
  pontos_fortes JSONB,
  pontos_fracos JSONB,
  observacoes_ia TEXT,
  comparativo_metlife JSONB,
  ultima_analise_ia TIMESTAMPTZ,
  status_analise_ia public.status_analise_ia NOT NULL DEFAULT 'nao_analisado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cliente_id IS NOT NULL OR prospect_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apolices TO authenticated;
GRANT ALL ON public.apolices TO service_role;
ALTER TABLE public.apolices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apolices: consultor owns or master" ON public.apolices FOR ALL TO authenticated
  USING (consultor_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (consultor_id = auth.uid() OR public.is_master(auth.uid()));
CREATE TRIGGER tg_apolices_updated BEFORE UPDATE ON public.apolices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_apolices_consultor ON public.apolices(consultor_id);

-- ============ APOLICES ANALISES HISTORICO ============
CREATE TABLE public.apolices_analises_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apolice_id UUID NOT NULL REFERENCES public.apolices(id) ON DELETE CASCADE,
  consultor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  modelo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apolices_analises_historico TO authenticated;
GRANT ALL ON public.apolices_analises_historico TO service_role;
ALTER TABLE public.apolices_analises_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apolices_hist: consultor owns or master" ON public.apolices_analises_historico FOR ALL TO authenticated
  USING (consultor_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (consultor_id = auth.uid() OR public.is_master(auth.uid()));

-- ============ NOTIFICACOES ============
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  payload JSONB,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notificacoes: own" ON public.notificacoes FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_master(auth.uid()));

-- ============ STORAGE POLICIES (apolices-pdf bucket) ============
CREATE POLICY "apolices-pdf read own or master" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'apolices-pdf' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_master(auth.uid())));
CREATE POLICY "apolices-pdf insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'apolices-pdf' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "apolices-pdf update own or master" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'apolices-pdf' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_master(auth.uid())));
CREATE POLICY "apolices-pdf delete own or master" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'apolices-pdf' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_master(auth.uid())));
