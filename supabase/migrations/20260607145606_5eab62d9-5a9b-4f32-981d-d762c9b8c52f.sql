
CREATE OR REPLACE FUNCTION public.prospects_calc_score()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  p_renda    NUMERIC := COALESCE(NEW.renda_estimada, 0);
  p_patr     NUMERIC := COALESCE(NEW.patrimonio_estimado, 0);
  p_prof     TEXT    := LOWER(COALESCE(NEW.especialidade_medica, ''));
  pts_renda  INT := 0;
  pts_patr   INT := 0;
  pts_prof   INT := 0;
  total      INT;
  bucket     SMALLINT;
BEGIN
  -- Pontos por renda mensal
  IF p_renda >= 80000 THEN pts_renda := 4;
  ELSIF p_renda >= 40000 THEN pts_renda := 3;
  ELSIF p_renda >= 20000 THEN pts_renda := 2;
  ELSIF p_renda >= 10000 THEN pts_renda := 1;
  ELSE pts_renda := 0;
  END IF;

  -- Pontos por patrimônio
  IF p_patr >= 5000000 THEN pts_patr := 4;
  ELSIF p_patr >= 3000000 THEN pts_patr := 3;
  ELSIF p_patr >= 1000000 THEN pts_patr := 2;
  ELSIF p_patr >= 500000  THEN pts_patr := 1;
  ELSE pts_patr := 0;
  END IF;

  -- Peso da profissão (Médico/Dentista/Empresário > Advogado/Engenheiro > demais)
  IF p_prof ~ '(médic|medic|dentist|empres|cirurgi)' THEN pts_prof := 2;
  ELSIF p_prof ~ '(advog|engenh|arquit|executiv)' THEN pts_prof := 1;
  ELSE pts_prof := 0;
  END IF;

  total := pts_renda + pts_patr + pts_prof;

  IF total >= 8 THEN bucket := 5;
  ELSIF total >= 6 THEN bucket := 4;
  ELSIF total >= 4 THEN bucket := 3;
  ELSIF total >= 2 THEN bucket := 2;
  ELSE bucket := 1;
  END IF;

  NEW.score := bucket;
  RETURN NEW;
END;
$function$;

-- Recalcula score de todos os prospects existentes
UPDATE public.prospects SET updated_at = now();
