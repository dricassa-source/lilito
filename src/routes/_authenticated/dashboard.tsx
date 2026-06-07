import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useConsultorScope, applyScope } from "@/hooks/useConsultorScope";
import { ConsultorFilter } from "@/components/lilito/ConsultorFilter";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreStars } from "@/components/lilito/ScoreStars";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LILITO" }] }),
  component: Dashboard,
});

function brl(n: number | null | undefined) {
  return `R$ ${Math.round(Number(n ?? 0)).toLocaleString("pt-BR")}`;
}

function KPI({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <Card className={`p-5 bg-surface ${accent ? "border-gold/40" : "border-border"}`}>
      <p className="caps-tracking text-muted-foreground text-[0.6rem]">{label}</p>
      <p className={`font-display text-3xl mt-2 ${accent ? "text-gold" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <p className="caps-tracking text-gold mb-3 text-[0.65rem]">{titulo}</p>
      {children}
    </section>
  );
}

function Dashboard() {
  const { auth } = useAuth();
  const { isMaster, scopeIds, consultorId } = useConsultorScope();
  const mostrarEquipe = isMaster && !consultorId; // Unidade (consolidado)

  const { data } = useQuery({
    queryKey: ["dashboard-v2", scopeIds.join(","), auth?.user.id],
    enabled: !!auth && scopeIds.length > 0,
    queryFn: async () => {
      const [prospects, apolices, clientes, agenda, atividades] = await Promise.all([
        applyScope(supabase.from("prospects").select("id,etapa_funil,pa_estimado,score,consultor_id"), scopeIds).then((r) => r.data ?? []),
        applyScope(supabase.from("apolices").select("id,premio_atual,capital_segurado,status,consultor_id,onboarding_status"), scopeIds).then((r) => r.data ?? []),
        applyScope(supabase.from("clientes").select("id,pa_total,capital_segurado,consultor_id"), scopeIds).then((r) => r.data ?? []),
        applyScope(supabase.from("agenda_eventos").select("id,tipo,resultado,fim,delay_em,delay_resolvido,etapa_origem,consultor_id"), scopeIds).then((r) => r.data ?? []),
        applyScope(supabase.from("atividades").select("id,tipo,prospect_id,consultor_id"), scopeIds).then((r) => r.data ?? []),
      ]);


      // Funil
      const funil = {
        recomendacao: 0, hot: 0, ab: 0, fechamento: 0, onboarding: 0, cliente: 0,
      };
      for (const p of prospects as any[]) {
        switch (p.etapa_funil) {
          case "recomendacao": funil.recomendacao++; break;
          case "hot": funil.hot++; break;
          case "ab": funil.ab++; break;
          case "fechamento": funil.fechamento++; break;
          case "implantacao": funil.onboarding++; break;
          case "cliente":
          case "pos_venda": funil.cliente++; break;
        }
      }

      // Produção
      const paFechado = (apolices as any[])
        .filter((a) => ["fechado", "migrado", "emitido"].includes(a.status))
        .reduce((s, a) => s + Number(a.premio_atual ?? 0), 0);
      const paEmitido = (apolices as any[])
        .filter((a) => a.status === "migrado" || a.status === "emitido")
        .reduce((s, a) => s + Number(a.premio_atual ?? 0), 0);
      const capitalSegurado = (apolices as any[])
        .filter((a) => a.status === "migrado" || a.status === "emitido")
        .reduce((s, a) => s + Number(a.capital_segurado ?? 0), 0);
      const comissao = paEmitido * 0.6;

      // Conversão (Funil)
      const taxa = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
      const conv = {
        hotAb: taxa(funil.ab + funil.fechamento + funil.onboarding + funil.cliente, funil.hot + funil.ab + funil.fechamento + funil.onboarding + funil.cliente),
        abFech: taxa(funil.fechamento + funil.onboarding + funil.cliente, funil.ab + funil.fechamento + funil.onboarding + funil.cliente),
        fechOnb: taxa(funil.onboarding + funil.cliente, funil.fechamento + funil.onboarding + funil.cliente),
        onbCli: taxa(funil.cliente, funil.onboarding + funil.cliente),
      };

      // Onboarding
      const onbApolices = (apolices as any[]).filter((a) => a.onboarding_status && a.onboarding_status !== "concluido");
      const onbPa = onbApolices.reduce((s, a) => s + Number(a.premio_atual ?? 0), 0);
      const onbCap = onbApolices.reduce((s, a) => s + Number(a.capital_segurado ?? 0), 0);

      // Delays por etapa de origem
      const delaysAtivos = (agenda as any[]).filter((e) => e.delay_em && !e.delay_resolvido);
      const delaysPorEtapa = {
        ab: delaysAtivos.filter((e) => e.etapa_origem === "ab").length,
        revisita: delaysAtivos.filter((e) => e.etapa_origem === "revisita").length,
        fechamento: delaysAtivos.filter((e) => e.etapa_origem === "fechamento").length,
        entrega: delaysAtivos.filter((e) => e.etapa_origem === "entrega_apolice").length,
      };

      // Qualidade
      const eventosPassados = (agenda as any[]).filter((e) => new Date(e.fim) < new Date());
      const semResultado = eventosPassados.filter((e) => !e.resultado).length;
      const trintaDiasAtras = Date.now() - 30 * 86_400_000;
      const delaysAbandonados = delaysAtivos.filter((e) => new Date(e.delay_em).getTime() < trintaDiasAtras).length;
      const recoIncompletas = (prospects as any[]).filter((p) => !p.score || p.score < 2).length;
      const scoreMedio = prospects.length > 0
        ? (prospects as any[]).reduce((s, p) => s + (p.score ?? 1), 0) / prospects.length
        : 0;

      // Equipe (só faz sentido em visão Unidade consolidada)
      let equipe: { id: string; nome: string; pa: number; capital: number; recos: number; reunioes: number }[] = [];
      if (mostrarEquipe) {
        const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "consultor");
        const ids = (roles ?? []).map((r) => r.user_id);
        if (ids.length) {
          const { data: perfis } = await supabase.from("profiles").select("id,nome").in("id", ids);
          const nomes = new Map((perfis ?? []).map((p) => [p.id, p.nome]));

          const byCons = new Map<string, { pa: number; capital: number; recos: number; reunioes: number }>();
          for (const a of apolices as any[]) {
            if (a.status !== "migrado" && a.status !== "emitido") continue;
            const cur = byCons.get(a.consultor_id) ?? { pa: 0, capital: 0, recos: 0, reunioes: 0 };
            cur.pa += Number(a.premio_atual ?? 0);
            cur.capital += Number(a.capital_segurado ?? 0);
            byCons.set(a.consultor_id, cur);
          }
          for (const p of prospects as any[]) {
            const cur = byCons.get(p.consultor_id) ?? { pa: 0, capital: 0, recos: 0, reunioes: 0 };
            cur.recos += 1;
            byCons.set(p.consultor_id, cur);
          }
          for (const e of agenda as any[]) {
            if (e.resultado) {
              const cur = byCons.get(e.consultor_id) ?? { pa: 0, capital: 0, recos: 0, reunioes: 0 };
              cur.reunioes += 1;
              byCons.set(e.consultor_id, cur);
            }
          }
          equipe = ids
            .map((id) => ({ id, nome: nomes.get(id) ?? "—", ...(byCons.get(id) ?? { pa: 0, capital: 0, recos: 0, reunioes: 0 }) }))
            .sort((a, b) => b.pa - a.pa);
        }
      }
      void atividades;


      return {
        funil, paFechado, paEmitido, capitalSegurado, comissao, conv,
        onb: { count: onbApolices.length, pa: onbPa, cap: onbCap },
        delaysPorEtapa, qualidade: { semResultado, delaysAbandonados, recoIncompletas, scoreMedio },
        equipe,
      };
    },
  });

  const [rankBy, setRankBy] = useState<"pa" | "capital" | "recos" | "reunioes">("pa");
  const rankingOrdenado = useMemo(() => {
    if (!data?.equipe) return [];
    return [...data.equipe].sort((a, b) => Number(b[rankBy]) - Number(a[rankBy]));
  }, [data?.equipe, rankBy]);

  return (
    <div>
      <PageHeader eyebrow="Gestão" title="Dashboard" description="Visão executiva — produção, funil, conversão, equipe e qualidade." />

      <ConsultorFilter />

      {/* HERO — Cards principais em destaque */}
      <section className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <HeroKPI label="PA Fechado" value={data ? brl(data.paFechado) : "—"} accent="gold" />
          <HeroKPI label="Capital Segurado" value={data ? brl(data.capitalSegurado) : "—"} accent="blue" />
          <HeroKPI label="Clientes Emitidos" value={data?.funil.cliente ?? "—"} accent="emerald" />
          <HeroKPI label="Comissão Projetada" value={data ? brl(data.comissao) : "—"} sub="60% do PA emitido" accent="gold" />
        </div>
      </section>

      {/* PIPELINE — Bloco visual principal */}
      <Bloco titulo="Pipeline">
        <Card className="bg-surface border-border p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <PipelineStep label="Originação" qtd={data?.funil.recomendacao ?? 0} pa={0} color="bg-muted" fg="text-muted-foreground" />
            <PipelineStep label="HOT" qtd={data?.funil.hot ?? 0} pa={0} color="bg-orange-500/20" fg="text-orange-500" />
            <PipelineStep label="AB" qtd={data?.funil.ab ?? 0} pa={0} color="bg-yellow-500/20" fg="text-yellow-500" />
            <PipelineStep label="Fechamento" qtd={data?.funil.fechamento ?? 0} pa={data?.paFechado ?? 0} color="bg-emerald-600/20" fg="text-emerald-500" />
            <PipelineStep label="Onboarding" qtd={data?.funil.onboarding ?? 0} pa={data?.onb.pa ?? 0} color="bg-emerald-300/20" fg="text-emerald-300" />
            <PipelineStep label="Cliente" qtd={data?.funil.cliente ?? 0} pa={data?.paEmitido ?? 0} color="bg-gold/20" fg="text-gold" />
          </div>
        </Card>
      </Bloco>

      <Bloco titulo="Onboarding">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPI label="Propostas em Onboarding" value={data?.onb.count ?? "—"} />
          <KPI label="PA Pendente" value={data ? brl(data.onb.pa) : "—"} />
          <KPI label="Capital Pendente" value={data ? brl(data.onb.cap) : "—"} />
        </div>
      </Bloco>

      <Bloco titulo="Delays ativos">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="AB" value={data?.delaysPorEtapa.ab ?? "—"} />
          <KPI label="Revisita" value={data?.delaysPorEtapa.revisita ?? "—"} />
          <KPI label="Fechamento" value={data?.delaysPorEtapa.fechamento ?? "—"} />
          <KPI label="Entrega de Apólice" value={data?.delaysPorEtapa.entrega ?? "—"} />
        </div>
      </Bloco>

      <BlocoColapsavel titulo="Conversão">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="HOT → AB" value={data ? `${data.conv.hotAb}%` : "—"} />
          <KPI label="AB → Fechamento" value={data ? `${data.conv.abFech}%` : "—"} />
          <KPI label="Fech. → Onboarding" value={data ? `${data.conv.fechOnb}%` : "—"} />
          <KPI label="Onboarding → Cliente" value={data ? `${data.conv.onbCli}%` : "—"} />
        </div>
      </BlocoColapsavel>

      <BlocoColapsavel titulo="Qualidade">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Eventos sem resultado" value={data?.qualidade.semResultado ?? "—"} />
          <KPI label="Delays abandonados (>30d)" value={data?.qualidade.delaysAbandonados ?? "—"} />
          <KPI label="Recomendações incompletas" value={data?.qualidade.recoIncompletas ?? "—"} />
          <Card className="p-5 bg-surface border-border">
            <p className="caps-tracking text-muted-foreground text-[0.6rem]">Score médio</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="font-display text-3xl text-foreground">{data?.qualidade.scoreMedio.toFixed(1) ?? "—"}</p>
              <ScoreStars score={Math.round(data?.qualidade.scoreMedio ?? 0) || 1} />
            </div>
          </Card>
        </div>
      </BlocoColapsavel>

      <BlocoColapsavel titulo="Auditoria">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPI label="Eventos sem resultado" value={data?.qualidade.semResultado ?? "—"} />
          <KPI label="Delays abandonados" value={data?.qualidade.delaysAbandonados ?? "—"} />
          <KPI label="PA Emitido" value={data ? brl(data.paEmitido) : "—"} />
        </div>
      </BlocoColapsavel>

      {mostrarEquipe && (
        <Bloco titulo="Equipe — Ranking">
          <Card className="p-6 bg-surface border-border">
            <Tabs value={rankBy} onValueChange={(v) => setRankBy(v as any)} className="mb-4">
              <TabsList className="bg-background border border-border">
                <TabsTrigger value="pa">PA</TabsTrigger>
                <TabsTrigger value="capital">Capital Segurado</TabsTrigger>
                <TabsTrigger value="recos">Recomendações</TabsTrigger>
                <TabsTrigger value="reunioes">Reuniões</TabsTrigger>
              </TabsList>
            </Tabs>
            {rankingOrdenado.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados de equipe.</p>
            ) : (
              <ol className="divide-y divide-border">
                {rankingOrdenado.map((c, idx) => (
                  <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className={`font-display text-2xl w-8 ${idx === 0 ? "text-gold" : "text-muted-foreground"}`}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="text-foreground truncate">{c.nome}</span>
                    </div>
                    <span className="font-display text-lg text-foreground">
                      {rankBy === "pa" || rankBy === "capital" ? brl(c[rankBy]) : c[rankBy]}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </Bloco>
      )}
    </div>
  );
}
