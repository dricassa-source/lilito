import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/planejamento")({
  head: () => ({ meta: [{ title: "Planejamento — LILITO" }] }),
  component: () => (
    <div>
      <PageHeader eyebrow="Fase 2" title="Planejamento" description="Metas individuais e ranking da unidade." />
      <Card className="p-12 bg-surface border-gold/20 text-center">
        <Trophy className="h-12 w-12 text-gold mx-auto opacity-60" strokeWidth={1.2} />
        <h2 className="font-display text-3xl mt-4">Em breve — Fase 2</h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          PA, comissão, conversão, ranking, produção mensal e anual. Estrutura para acompanhar metas individuais e da unidade.
        </p>
      </Card>
    </div>
  ),
});
