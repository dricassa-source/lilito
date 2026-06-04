import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/lilito/PageHeader";
import { DndContext, useDraggable, useDroppable, DragOverlay, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/funil")({
  head: () => ({ meta: [{ title: "Funil — LILITO" }] }),
  component: Funil,
});

const COLUNAS = [
  { id: "recomendacao", label: "Recomendação" },
  { id: "hot", label: "HOT" },
  { id: "ab", label: "AB" },
  { id: "analise_apolice", label: "Análise de Apólice" },
  { id: "fechamento", label: "Fechamento" },
  { id: "implantacao", label: "Implantação" },
  { id: "cliente", label: "Cliente" },
  { id: "pos_venda", label: "Pós-venda" },
] as const;

function daysInStage(iso: string | null) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function ProspectCard({ p, dragging }: { p: any; dragging?: boolean }) {
  return (
    <Card className={`p-3 bg-surface-elevated border-border ${dragging ? "shadow-elegant" : ""}`}>
      <p className="font-medium text-foreground text-sm leading-tight">{p.nome}</p>
      {p.especialidade_medica && <p className="text-xs text-muted-foreground mt-0.5">{p.especialidade_medica}</p>}
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-muted-foreground">{daysInStage(p.entrou_etapa_em)}d na etapa</span>
        <span className="text-gold">R$ {Math.round(Number(p.pa_estimado ?? 0) / 1000)}k</span>
      </div>
    </Card>
  );
}

function Draggable({ p }: { p: any }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: p.id, data: p });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? "opacity-30" : "cursor-grab active:cursor-grabbing"}>
      <ProspectCard p={p} />
    </div>
  );
}

function Coluna({ id, label, items }: { id: string; label: string; items: any[] }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex-shrink-0 w-64 ${isOver ? "ring-1 ring-gold/50" : ""}`}>
      <div className="bg-surface border border-border rounded-md p-3 h-full">
        <div className="flex items-center justify-between mb-3">
          <p className="caps-tracking text-gold text-[0.65rem]">{label}</p>
          <span className="text-xs text-muted-foreground">{items.length}</span>
        </div>
        <div className="space-y-2 min-h-[100px]">
          {items.map((p) => <Draggable key={p.id} p={p} />)}
        </div>
      </div>
    </div>
  );
}

function Funil() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: prospects } = useQuery({
    queryKey: ["funil"],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase.from("prospects").select("*").order("entrou_etapa_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const byCol: Record<string, any[]> = {};
  COLUNAS.forEach((c) => (byCol[c.id] = []));
  (prospects ?? []).forEach((p: any) => { if (byCol[p.etapa_funil]) byCol[p.etapa_funil].push(p); });

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const newEtapa = e.over?.id as string | undefined;
    const p = e.active.data.current as any;
    if (!p || !newEtapa || newEtapa === p.etapa_funil) return;
    qc.setQueryData(["funil"], (old: any[] | undefined) =>
      (old ?? []).map((x) => x.id === p.id ? { ...x, etapa_funil: newEtapa, entrou_etapa_em: new Date().toISOString() } : x));
    const { error } = await supabase.from("prospects")
      .update({ etapa_funil: newEtapa as any, entrou_etapa_em: new Date().toISOString() })
      .eq("id", p.id);
    if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: ["funil"] }); return; }
    await supabase.from("atividades").insert({
      consultor_id: auth!.user.id, prospect_id: p.id, tipo: "agendamento",
      resultado: `Movido para ${newEtapa}`,
    });
    toast.success("Etapa atualizada.");
  }

  const activeP = prospects?.find((x: any) => x.id === activeId);

  return (
    <div>
      <PageHeader eyebrow="Pipeline" title="Funil" description="Arraste cartões entre etapas. Cada movimento registra uma atividade." />
      <DndContext onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUNAS.map((c) => <Coluna key={c.id} id={c.id} label={c.label} items={byCol[c.id]} />)}
        </div>
        <DragOverlay>{activeP ? <ProspectCard p={activeP} dragging /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
