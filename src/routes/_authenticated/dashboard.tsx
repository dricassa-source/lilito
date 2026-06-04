import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LILITO" }] }),
  component: Dashboard,
});

function KPI({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-5 bg-surface border-border">
      <p className="caps-tracking text-muted-foreground">{label}</p>
      <p className="font-display text-3xl text-foreground mt-2">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
}

function Dashboard() {
  const { auth } = useAuth();
  const [scope, setScope] = useState<"individual" | "equipe">("individual");
  const isMaster = auth?.isMaster ?? false;
  const onlyMine = scope === "individual" || !isMaster;

  const { data } = useQuery({
    queryKey: ["dashboard", scope, auth?.user.id],
    enabled: !!auth,
    queryFn: async () => {
      const base = (q: any) => (onlyMine && auth ? q.eq("consultor_id", auth.user.id) : q);
      const [hot, ab, fech, clientes, prospects, ranking] = await Promise.all([
        base(supabase.from("prospects").select("*", { count: "exact", head: true }).eq("etapa_funil", "hot")),
        base(supabase.from("prospects").select("*", { count: "exact", head: true }).eq("etapa_funil", "ab")),
        base(supabase.from("prospects").select("*", { count: "exact", head: true }).eq("etapa_funil", "fechamento")),
        base(supabase.from("clientes").select("*", { count: "exact", head: true })),
        base(supabase.from("prospects").select("pa_estimado")),
        isMaster ? supabase.from("profiles").select("id,nome").eq("ativo", true) : Promise.resolve({ data: [] as any[] }),
      ]);
      const paTotal = (prospects.data ?? []).reduce((s: number, r: any) => s + Number(r.pa_estimado ?? 0), 0);
      return {
        hot: hot.count ?? 0,
        ab: ab.count ?? 0,
        fechamentos: fech.count ?? 0,
        clientes: clientes.count ?? 0,
        paTotal,
        comissao: paTotal * 0.6,
        equipe: ranking.data ?? [],
      };
    },
  });

  return (
    <div>
      <PageHeader eyebrow="Indicadores" title="Dashboard" description="Visão consolidada de produção e conversão." />

      {isMaster && (
        <Tabs value={scope} onValueChange={(v) => setScope(v as any)} className="mb-6">
          <TabsList className="bg-surface border border-border">
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="HOTs" value={data?.hot ?? "—"} />
        <KPI label="ABs" value={data?.ab ?? "—"} />
        <KPI label="Fechamentos" value={data?.fechamentos ?? "—"} />
        <KPI label="Clientes" value={data?.clientes ?? "—"} />
        <KPI label="PA Estimado" value={data ? `R$ ${data.paTotal.toLocaleString("pt-BR")}` : "—"} />
        <KPI label="Comissão" value={data ? `R$ ${Math.round(data.comissao).toLocaleString("pt-BR")}` : "—"} sub="projetada" />
      </div>

      {isMaster && scope === "equipe" && (
        <Card className="mt-8 p-6 bg-surface border-border">
          <p className="caps-tracking text-gold mb-4">Equipe ativa</p>
          {(data?.equipe ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem consultores cadastrados.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(data?.equipe ?? []).map((c: any) => (
                <li key={c.id} className="py-3 flex items-center justify-between">
                  <span className="text-foreground">{c.nome}</span>
                  <span className="text-xs text-muted-foreground">Consultor</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
