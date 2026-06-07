import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const LS_KEY = "lilito.scope.consultorId";

export interface ConsultorOption {
  id: string;
  nome: string;
}

/**
 * Escopo unificado Master/Consultor.
 * - Consultor: consultorId = próprio id (não editável).
 * - Master: consultorId = null (Unidade) ou id selecionado.
 * scopeIds: lista de ids para queries `.in("consultor_id", scopeIds)`.
 */
export function useConsultorScope() {
  const { auth } = useAuth();
  const isMaster = auth?.isMaster ?? false;
  const meuId = auth?.user.id ?? null;

  const { data: consultores } = useQuery({
    queryKey: ["scope-consultores"],
    enabled: !!auth,
    queryFn: async (): Promise<ConsultorOption[]> => {
      // Inclui todos os perfis ativos (master também atende clientes).
      const { data } = await supabase
        .from("profiles")
        .select("id,nome,ativo")
        .eq("ativo", true)
        .order("nome");
      return (data ?? []).map((p: any) => ({ id: p.id, nome: p.nome }));
    },
  });

  const [consultorId, setConsultorIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(LS_KEY);
  });

  // Consultor: força próprio id.
  useEffect(() => {
    if (!auth) return;
    if (!isMaster && meuId && consultorId !== meuId) {
      setConsultorIdState(meuId);
    }
  }, [auth, isMaster, meuId, consultorId]);

  const setConsultorId = (id: string | null) => {
    if (!isMaster) return;
    setConsultorIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(LS_KEY, id);
      else window.localStorage.removeItem(LS_KEY);
    }
  };

  const effectiveId = isMaster ? consultorId : meuId;
  const scopeIds: string[] = effectiveId
    ? [effectiveId]
    : (consultores ?? []).map((c) => c.id);

  return {
    isMaster,
    consultores: consultores ?? [],
    consultorId: effectiveId, // null = Unidade (master)
    setConsultorId,
    scopeIds,
    meuId,
  };
}
