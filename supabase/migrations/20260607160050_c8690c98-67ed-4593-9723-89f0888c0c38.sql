-- Ensure score defaults to 1 (never null/zero), keep trigger on INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.prospects_calc_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  p_renda   NUMERIC := COALESCE(NEW.renda_estimada, 0);
  p_patr    NUMERIC := COALESCE(NEW.patrimonio_estimado, 0);
  p_prof    TEXT    := LOWER(COALESCE(NEW.especialidade_medica, ''));
  pts_renda INT := 0;
  pts_patr  INT := 0;
  pts_prof  INT := 0;
  total     INT;
  bucket    SMALLINT;
BEGIN
  IF p_renda >= 80000 THEN pts_renda := 4;
  ELSIF p_renda >= 40000 THEN pts_renda := 3;
  ELSIF p_renda >= 20000 THEN pts_renda := 2;
  ELSIF p_renda >= 10000 THEN pts_renda := 1;
  END IF;

  IF p_patr >= 5000000 THEN pts_patr := 4;
  ELSIF p_patr >= 3000000 THEN pts_patr := 3;
  ELSIF p_patr >= 1000000 THEN pts_patr := 2;
  ELSIF p_patr >= 500000 THEN pts_patr := 1;
  END IF;

  IF p_prof ~ '(médic|medic|dentist|empres|cirurgi)' THEN pts_prof := 3;
  ELSIF p_prof ~ '(advog|engenh|arquit|executiv|juiz|promotor|notari|magistr)' THEN pts_prof := 2;
  ELSIF p_prof ~ '(propagand|vendedor|representante|estudante)' THEN pts_prof := 0;
  ELSE pts_prof := 1;
  END IF;

  total := pts_renda + pts_patr + pts_prof;

  IF total >= 9 THEN bucket := 5;
  ELSIF total >= 7 THEN bucket := 4;
  ELSIF total >= 5 THEN bucket := 3;
  ELSIF total >= 3 THEN bucket := 2;
  ELSE bucket := 1; -- nunca exibir vazio
  END IF;

  NEW.score := bucket;
  RETURN NEW;
END;
$function$;

-- Backfill: recalcula score em todos os prospects (touch updated_at do trigger BEFORE UPDATE)
UPDATE public.prospects SET updated_at = now() WHERE score IS NULL OR score = 0;
UPDATE public.prospects SET updated_at = now(); -- recalcula todos com novos pesos