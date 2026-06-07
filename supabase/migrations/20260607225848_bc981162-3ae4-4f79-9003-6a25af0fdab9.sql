ALTER TABLE public.compromissos_recorrentes
  ADD COLUMN IF NOT EXISTS excecoes date[] NOT NULL DEFAULT '{}'::date[],
  ADD COLUMN IF NOT EXISTS data_final date NULL;