import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pos-venda")({
  head: () => ({ meta: [{ title: "Pós-venda — LILITO" }] }),
  component: () => <Placeholder />,
});

function Placeholder() {
  return (
    <div>
      <PageHeader eyebrow="Fase 2" title="Pós-venda" description="Life events e gestão de relacionamento contínuo." />
      <Card className="p-12 bg-surface border-gold/20 text-center">
        <Heart className="h-12 w-12 text-gold mx-auto opacity-60" strokeWidth={1.2} />
        <h2 className="font-display text-3xl mt-4">Em breve — Fase 2</h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Detecção automática de life events (casamento, filho, holding, sucessão patrimonial) e sugestões de revisão.
        </p>
      </Card>
    </div>
  );
}
