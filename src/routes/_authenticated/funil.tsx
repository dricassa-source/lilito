import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/lilito/PageHeader";
import { DndContext, useDraggable, useDroppable, DragOverlay, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScoreStars } from "@/components/lilito/ScoreStars";
import { toast } from "sonner";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

function tempoEtapaDot(dias: number) {
  if (dias <= 7) return "bg-emerald-500";
  if (dias <= 14) return "bg-yellow-500";
  return "bg-red-500";
}

export const Route = createFileRoute("/_authenticated/funil")({
  head: () => ({ meta: [{ title: "Funil — LILITO" }] }),
  component: Funil,
});

// Arquitetura oficial LILITO: Originação → HOT → AB → Fechamento → Onboarding → Cliente
const COLUNAS = [
  { id: "recomendacao", label: "Originação" },
  { id: "hot", label: "HOT" },
  { id: "ab", label: "AB" },
  { id: "fechamento", label: "Fechamento" },
  { id: "implantacao", label: "Onboarding" },
  { id: "cliente", label: "Cliente" },
] as const;

const ETAPAS_ATIVAS = COLUNAS.map((c) => c.id) as readonly string[];

function daysInStage(iso: string | null) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function ProspectCard({ p, dragging, onClick }: { p: any; dragging?: boolean; onClick?: () => void }) {
  const dias = daysInStage(p.entrou_etapa_em);
  return (
    <Card
      className={`p-3 bg-surface-elevated border-border ${dragging ? "shadow-elegant" : ""} ${onClick ? "cursor-pointer hover:border-gold/40 transition-colors" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-foreground text-sm leading-tight flex-1 min-w-0 truncate">{p.nome}</p>
        <ScoreStars score={p.score ?? 1} />
      </div>
      {p.especialidade_medica && <p className="text-xs text-muted-foreground mt-0.5">{p.especialidade_medica}</p>}
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${tempoEtapaDot(dias)}`} />
          {dias}d na etapa
        </span>
        <span className="text-gold">R$ {Math.round(Number(p.pa_estimado ?? 0) / 1000)}k</span>
      </div>
    </Card>
  );
}

function Draggable({ p, onOpen }: { p: any; onOpen: (p: any) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: p.id, data: p });
  // Pointer activation: dnd-kit will only start a drag after movement; a clean click bubbles to onClick.
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? "opacity-30" : ""}>
      <ProspectCard p={p} onClick={() => onOpen(p)} />
    </div>
  );
}

function Coluna({ id, label, items, onOpen }: { id: string; label: string; items: any[]; onOpen: (p: any) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex-shrink-0 w-64 ${isOver ? "ring-1 ring-gold/50" : ""}`}>
      <div className="bg-surface border border-border rounded-md p-3 h-full">
        <div className="flex items-center justify-between mb-3">
          <p className="caps-tracking text-gold text-[0.65rem]">{label}</p>
          <span className="text-xs text-muted-foreground">{items.length}</span>
        </div>
        <div className="space-y-2 min-h-[100px]">
          {items.map((p) => <Draggable key={p.id} p={p} onOpen={onOpen} />)}
        </div>
      </div>
    </div>
  );
}

function Funil() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openProspect, setOpenProspect] = useState<any | null>(null);

  const { data: prospects } = useQuery({
    queryKey: ["funil"],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase.from("prospects").select("*").order("entrou_etapa_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: atividades } = useQuery({
    queryKey: ["funil-atividades", openProspect?.id],
    enabled: !!openProspect,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atividades")
        .select("id, tipo, resultado, observacao, created_at")
        .eq("prospect_id", openProspect!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const byCol: Record<string, any[]> = {};
  COLUNAS.forEach((c) => (byCol[c.id] = []));
  (prospects ?? []).forEach((p: any) => {
    if (byCol[p.etapa_funil]) byCol[p.etapa_funil].push(p);
  });

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const newEtapa = e.over?.id as string | undefined;
    const p = e.active.data.current as any;
    if (!p || !newEtapa || newEtapa === p.etapa_funil) return;
    if (!ETAPAS_ATIVAS.includes(newEtapa)) return;

    qc.setQueryData(["funil"], (old: any[] | undefined) =>
      (old ?? []).map((x) => x.id === p.id ? { ...x, etapa_funil: newEtapa, entrou_etapa_em: new Date().toISOString() } : x));

    const { error } = await supabase.from("prospects")
      .update({ etapa_funil: newEtapa as any, entrou_etapa_em: new Date().toISOString() })
      .eq("id", p.id);
    if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: ["funil"] }); return; }

    await supabase.from("atividades").insert({
      consultor_id: auth!.user.id, prospect_id: p.id, tipo: "agendamento",
      resultado: `Movido para ${COLUNAS.find((c) => c.id === newEtapa)?.label ?? newEtapa}`,
    });

    // Conversão automática para Cliente quando arrastado para a coluna Cliente
    if (newEtapa === "cliente") {
      const { data: existing } = await supabase.from("clientes").select("id").eq("prospect_id", p.id).maybeSingle();
      if (!existing) {
        await supabase.from("clientes").insert({
          consultor_id: p.consultor_id,
          prospect_id: p.id,
          nome: p.nome,
          telefone: p.telefone,
          pa_total: Number(p.pa_estimado ?? 0),
        });
        qc.invalidateQueries({ queryKey: ["clientes"] });
      }
    }

    toast.success("Etapa atualizada.");
  }

  const activeP = prospects?.find((x: any) => x.id === activeId);

  return (
    <div>
      <PageHeader
        eyebrow="Pipeline"
        title="Funil"
        description="Originação → HOT → AB → Fechamento → Onboarding → Cliente. Arraste cartões ou clique para ver detalhes."
      />
      <DndContext onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUNAS.map((c) => <Coluna key={c.id} id={c.id} label={c.label} items={byCol[c.id]} onOpen={setOpenProspect} />)}
        </div>
        <DragOverlay>{activeP ? <ProspectCard p={activeP} dragging /> : null}</DragOverlay>
      </DndContext>

      <Sheet open={!!openProspect} onOpenChange={(o) => !o && setOpenProspect(null)}>
        <SheetContent className="bg-surface border-border w-full sm:max-w-md overflow-y-auto">
          {openProspect && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl flex items-center gap-2 flex-wrap">
                  {openProspect.nome}
                  <ScoreStars score={openProspect.score ?? 1} />
                </SheetTitle>
                <SheetDescription>
                  {COLUNAS.find((c) => c.id === openProspect.etapa_funil)?.label ?? openProspect.etapa_funil}
                  {" · "}
                  {daysInStage(openProspect.entrou_etapa_em)}d nesta etapa
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5 text-sm">
                <section>
                  <p className="caps-tracking text-gold text-[0.65rem] mb-2">Dados pessoais</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Telefone" value={openProspect.telefone} />
                    <Field label="Cidade" value={openProspect.cidade} />
                    <Field label="Profissão" value={openProspect.especialidade_medica} />
                    <Field label="Estado civil" value={openProspect.estado_civil} />
                    <Field label="Filhos" value={openProspect.filhos != null ? String(openProspect.filhos) : null} />
                    <Field label="Cônjuge" value={openProspect.conjuge} />
                  </div>
                </section>

                <section>
                  <p className="caps-tracking text-gold text-[0.65rem] mb-2">Patrimônio e renda</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Renda estimada" value={openProspect.renda_estimada != null ? `R$ ${Number(openProspect.renda_estimada).toLocaleString("pt-BR")}` : null} />
                    <Field label="Patrimônio" value={openProspect.patrimonio_estimado != null ? `R$ ${Number(openProspect.patrimonio_estimado).toLocaleString("pt-BR")}` : null} />
                    <Field label="PA estimado" value={`R$ ${Number(openProspect.pa_estimado ?? 0).toLocaleString("pt-BR")}`} />
                    <Field label="Nota qualificação" value={openProspect.nota_qualificacao != null ? String(openProspect.nota_qualificacao) : null} />
                  </div>
                </section>

                <section>
                  <p className="caps-tracking text-gold text-[0.65rem] mb-2">Recomendação</p>
                  <Field label="Quem recomendou" value={openProspect.quem_recomendou} />
                  {openProspect.observacoes && (
                    <p className="text-muted-foreground text-xs mt-2 leading-relaxed">{openProspect.observacoes}</p>
                  )}
                </section>

                <section>
                  <p className="caps-tracking text-gold text-[0.65rem] mb-2">Tempo e próxima ação</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Última interação"
                      value={openProspect.ultima_interacao ? format(new Date(openProspect.ultima_interacao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : null}
                    />
                    <Field
                      label="Dias desde interação"
                      value={openProspect.ultima_interacao ? `${differenceInDays(new Date(), new Date(openProspect.ultima_interacao))}d` : "—"}
                    />
                  </div>
                </section>

                <section>
                  <p className="caps-tracking text-gold text-[0.65rem] mb-2">Histórico</p>
                  {!atividades || atividades.length === 0 ? (
                    <p className="text-muted-foreground text-xs">Nenhuma atividade registrada.</p>
                  ) : (
                    <ul className="space-y-2">
                      {atividades.map((a) => (
                        <li key={a.id} className="border-l-2 border-gold/40 pl-3">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(a.created_at), "dd/MM HH:mm", { locale: ptBR })} · {a.tipo}
                          </p>
                          {a.resultado && <p className="text-sm">{a.resultado}</p>}
                          {a.observacao && <p className="text-xs text-muted-foreground">{a.observacao}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="caps-tracking text-muted-foreground text-[0.6rem]">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}
