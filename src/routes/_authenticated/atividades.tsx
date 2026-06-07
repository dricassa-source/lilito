import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConsultorScope, applyScope } from "@/hooks/useConsultorScope";
import { ConsultorFilter } from "@/components/lilito/ConsultorFilter";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/lilito/EmptyState";
import { ListChecks } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/atividades")({
  head: () => ({ meta: [{ title: "Atividades — LILITO" }] }),
  component: Atividades,
});

function Atividades() {
  const { auth } = useAuth();
  const { scopeIds } = useConsultorScope();
  const { data } = useQuery({
    queryKey: ["atividades", scopeIds.join(",")],
    enabled: !!auth && scopeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await applyScope(
        supabase.from("atividades").select("*,prospects(nome)"),
        scopeIds,
      ).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader eyebrow="Produtividade" title="Atividades" description="Histórico completo de interações." />
      <ConsultorFilter />
      {!data || data.length === 0 ? (
        <EmptyState icon={ListChecks} title="Sem atividades ainda" description="Cada ligação, agendamento e fechamento aparecerá aqui." />
      ) : (
        <Card className="bg-surface border-border divide-y divide-border">
          {data.map((a: any) => (
            <div key={a.id} className="p-4 flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{a.prospects?.nome ?? "—"}</p>
                <p className="text-xs text-muted-foreground caps-tracking mt-1">{a.tipo}</p>
                {a.resultado && <p className="text-sm mt-1 text-foreground/80">{a.resultado}</p>}
              </div>
              <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}</p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
