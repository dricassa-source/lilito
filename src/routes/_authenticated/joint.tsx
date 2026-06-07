import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/lilito/EmptyState";
import { Users2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/joint")({
  head: () => ({ meta: [{ title: "Joint Work — LILITO" }] }),
  component: JointPage,
});

const STATUS_BADGE: Record<string, string> = {
  pendente: "border-yellow-500 text-yellow-500",
  aprovado: "border-green-500 text-green-500",
  rejeitado: "border-destructive text-destructive",
  confirmado: "border-gold text-gold",
};

function JointPage() {
  const { auth } = useAuth();
  const isMaster = auth?.isMaster ?? false;
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["joint-requests", auth?.user.id, isMaster],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase.from("joint_requests")
        .select("*, agenda_eventos(titulo,inicio,tipo,consultor_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.consultor_id)));
      const nomes: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,nome").in("id", ids);
        for (const p of profs ?? []) nomes[p.id] = p.nome;
      }
      return (data ?? []).map((r: any) => ({ ...r, consultor_nome: nomes[r.consultor_id] ?? "—" }));
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status, eventoId }: { id: string; status: "aprovado" | "rejeitado"; eventoId: string }) => {
      const { error } = await supabase.from("joint_requests").update({
        status, master_id: auth!.user.id, decided_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      await supabase.from("agenda_eventos").update({
        joint_status: status === "aprovado" ? "confirmado" : "rejeitado",
        joint_master_id: status === "aprovado" ? auth!.user.id : null,
      }).eq("id", eventoId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["joint-requests"] });
      qc.invalidateQueries({ queryKey: ["eventos"] });
      toast.success("Solicitação atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pendentes = (data ?? []).filter((r: any) => r.status === "pendente");
  const decididas = (data ?? []).filter((r: any) => r.status !== "pendente");

  return (
    <div>
      <PageHeader eyebrow="Acompanhamento Master" title="Joint Work"
        description={isMaster ? "Aprove ou rejeite solicitações de Joint da equipe." : "Acompanhe suas solicitações de Joint enviadas ao Master."} />

      {isMaster && (
        <>
          <p className="caps-tracking text-gold mb-3">Aguardando aprovação ({pendentes.length})</p>
          {pendentes.length === 0 ? (
            <EmptyState icon={Users2} title="Sem solicitações pendentes" description="As próximas solicitações de Joint aparecerão aqui." />
          ) : (
            <Card className="bg-surface border-border divide-y divide-border mb-6">
              {pendentes.map((r: any) => (
                <div key={r.id} className="p-4 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{r.agenda_eventos?.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.consultor_nome} ·{" "}
                      {r.agenda_eventos?.inicio && format(new Date(r.agenda_eventos.inicio), "dd MMM HH:mm", { locale: ptBR })}
                      {" · "}{r.agenda_eventos?.tipo}
                    </p>
                    {r.observacao && <p className="text-xs text-muted-foreground mt-1">{r.observacao}</p>}
                  </div>
                  <Button size="sm" variant="outline" className="gap-1"
                    onClick={() => decide.mutate({ id: r.id, status: "rejeitado", eventoId: r.evento_id })}>
                    <X className="h-3.5 w-3.5" /> Rejeitar
                  </Button>
                  <Button size="sm" className="gap-1"
                    onClick={() => decide.mutate({ id: r.id, status: "aprovado", eventoId: r.evento_id })}>
                    <Check className="h-3.5 w-3.5" /> Aprovar
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      <p className="caps-tracking text-muted-foreground mb-3">Histórico</p>
      <Card className="bg-surface border-border divide-y divide-border">
        {decididas.length === 0 && <p className="p-6 text-sm text-muted-foreground">Sem histórico ainda.</p>}
        {decididas.map((r: any) => (
          <div key={r.id} className="p-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">{r.agenda_eventos?.titulo}</p>
              <p className="text-xs text-muted-foreground">
                {r.consultor_nome} ·{" "}
                {r.agenda_eventos?.inicio && format(new Date(r.agenda_eventos.inicio), "dd MMM HH:mm", { locale: ptBR })}
              </p>
            </div>
            <Badge variant="outline" className={STATUS_BADGE[r.status] ?? ""}>{r.status}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
