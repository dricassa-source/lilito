import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ciclo-revisao")({
  head: () => ({ meta: [{ title: "Ciclo de Revisão — LILITO" }] }),
  component: () => (
    <div>
      <PageHeader eyebrow="Fase 2" title="Ciclo de Revisão" description="Kanban de revisões periódicas da carteira." />
      <Card className="p-12 bg-surface border-gold/20 text-center">
        <RefreshCcw className="h-12 w-12 text-gold mx-auto opacity-60" strokeWidth={1.2} />
        <h2 className="font-display text-3xl mt-4">Em breve — Fase 2</h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Kanban automático: Ativos · Precisa Revisão · Revisão Agendada · Concluída. Critério: 6 meses sem contato.
        </p>
      </Card>
    </div>
  ),
});
