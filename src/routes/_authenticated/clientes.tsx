import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/lilito/EmptyState";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — LILITO" }] }),
  component: Clientes,
});

function Clientes() {
  const { auth } = useAuth();
  const { data } = useQuery({
    queryKey: ["clientes"],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader eyebrow="Carteira" title="Clientes" description="Sua carteira ativa e familiares." />
      {!data || data.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum cliente ainda" description="Quando um prospect for promovido a Cliente no Funil, aparecerá aqui." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((c: any) => (
            <Card key={c.id} className="p-5 bg-surface border-border">
              <h3 className="font-display text-xl">{c.nome}</h3>
              {c.familia && <p className="text-xs text-muted-foreground">{c.familia}</p>}
              <div className="hairline-gold my-3 opacity-40" />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="caps-tracking text-muted-foreground text-[0.65rem]">PA Total</p><p className="text-gold">R$ {Number(c.pa_total ?? 0).toLocaleString("pt-BR")}</p></div>
                <div><p className="caps-tracking text-muted-foreground text-[0.65rem]">Capital</p><p>R$ {Number(c.capital_segurado ?? 0).toLocaleString("pt-BR")}</p></div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
