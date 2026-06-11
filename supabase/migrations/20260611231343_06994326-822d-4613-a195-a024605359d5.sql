ALTER TABLE public.agenda_eventos ADD COLUMN IF NOT EXISTS pendencia_tipo TEXT;
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_pendencia_f2
  ON public.agenda_eventos (delay_resolvido, delay_em) WHERE pendencia_tipo = 'f2';