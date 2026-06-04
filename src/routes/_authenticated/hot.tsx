import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/lilito/PageHeader";
import { EmptyState } from "@/components/lilito/EmptyState";
import { Flame, Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hot")({
  head: () => ({ meta: [{ title: "HOT — LILITO" }] }),
  component: Hot,
});

const ACTIONS = [
  { v: "agendou", l: "Agendou", etapa: "ab" },
  { v: "pensando", l: "Pensando", etapa: null },
  { v: "ligar_depois", l: "Ligar depois", etapa: null },
  { v: "nao_atendeu", l: "Não atendeu", etapa: null },
  { v: "sem_interesse", l: "Sem interesse", etapa: "perdido" },
] as const;

function Hot() {
  const { auth } = useAuth();
  const qc = useQueryClient();

  const { data: fila } = useQuery({
    queryKey: ["hot-fila"],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .eq("etapa_funil", "hot")
        .eq("status_hot", "pendente")
        .order("nota_qualificacao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const atual = fila?.[0];

  async function registrar(status: string, novaEtapa: string | null) {
    if (!atual || !auth) return;
    const updates: any = { status_hot: status, ultima_interacao: new Date().toISOString() };
    if (novaEtapa) { updates.etapa_funil = novaEtapa; updates.entrou_etapa_em = new Date().toISOString(); }
    const followUp = new Date(); followUp.setDate(followUp.getDate() + 3);
    await Promise.all([
      supabase.from("prospects").update(updates).eq("id", atual.id),
      supabase.from("atividades").insert({
        consultor_id: auth.user.id, prospect_id: atual.id, tipo: "ligacao",
        resultado: status, follow_up_em: ["pensando","ligar_depois","nao_atendeu"].includes(status) ? followUp.toISOString() : null,
      }),
    ]);
    toast.success("Ação registrada.");
    qc.invalidateQueries({ queryKey: ["hot-fila"] });
  }

  function ligar() {
    if (atual?.telefone) window.open(`tel:${atual.telefone}`);
  }
  function whatsapp() {
    if (atual?.telefone) window.open(`https://wa.me/${atual.telefone.replace(/\D/g, "")}`, "_blank");
  }

  return (
    <div>
      <PageHeader eyebrow="Fila diária" title="HOT" description="Contatos quentes priorizados por qualificação." />

      {!atual ? (
        <EmptyState icon={Flame} title="Fila vazia" description="Promova prospects qualificados para a etapa HOT no Funil." />
      ) : (
        <div className="max-w-2xl mx-auto">
          <Card className="bg-surface border-gold/30 p-8 shadow-elegant">
            <p className="caps-tracking text-gold text-center">Próximo da fila</p>
            <h2 className="font-display text-5xl text-center mt-3">{atual.nome}</h2>
            <p className="text-center text-muted-foreground mt-2">
              {[atual.especialidade_medica, atual.cidade].filter(Boolean).join(" · ")}
            </p>
            <div className="hairline-gold my-6" />
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="caps-tracking text-muted-foreground">Score</p><p className="font-display text-2xl text-gold">{atual.nota_qualificacao}</p></div>
              <div><p className="caps-tracking text-muted-foreground">PA est.</p><p className="font-display text-2xl">R$ {Number(atual.pa_estimado ?? 0).toLocaleString("pt-BR")}</p></div>
              <div><p className="caps-tracking text-muted-foreground">Indicado</p><p className="text-sm mt-2">{atual.quem_recomendou ?? "—"}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-8">
              <Button onClick={ligar} className="gold-gradient text-background"><Phone className="h-4 w-4 mr-2" />Ligar agora</Button>
              <Button onClick={whatsapp} variant="outline"><MessageCircle className="h-4 w-4 mr-2" />WhatsApp</Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
              {ACTIONS.map((a) => (
                <Button key={a.v} size="sm" variant="ghost" onClick={() => registrar(a.v, a.etapa)} className="text-xs hover:text-gold">
                  {a.l}
                </Button>
              ))}
            </div>
          </Card>
          <p className="text-center text-xs text-muted-foreground mt-4">
            {fila!.length} {fila!.length === 1 ? "prospect na fila" : "prospects na fila"}
          </p>
        </div>
      )}
    </div>
  );
}
