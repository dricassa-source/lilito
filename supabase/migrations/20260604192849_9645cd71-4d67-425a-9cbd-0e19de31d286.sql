ALTER TYPE public.etapa_funil ADD VALUE IF NOT EXISTS 'revisita';
ALTER TYPE public.etapa_funil ADD VALUE IF NOT EXISTS 'entrega_apolice';
ALTER TYPE public.tipo_evento ADD VALUE IF NOT EXISTS 'entrega_apolice';
ALTER TYPE public.tipo_atividade ADD VALUE IF NOT EXISTS 'entrega_apolice';