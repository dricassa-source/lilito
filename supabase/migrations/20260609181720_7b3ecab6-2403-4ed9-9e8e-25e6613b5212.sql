ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS data_nascimento_conjuge DATE,
  ADD COLUMN IF NOT EXISTS telefone_conjuge TEXT,
  ADD COLUMN IF NOT EXISTS profissao_conjuge TEXT;