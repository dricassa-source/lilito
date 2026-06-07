import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConsultorScope } from "@/hooks/useConsultorScope";
import { ConsultorFilter } from "@/components/lilito/ConsultorFilter";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { useMemo, useState } from "react";
import { startOfWeek, endOfWeek, addWeeks, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/resultado-semanal")({
  head: () => ({ meta: [{ title: "Resultado Semanal — LILITO" }] }),
  component: ResultadoSemanal,
});


function formatBRL(n: number) { return `R$ ${Math.round(n).toLocaleString("pt-BR")}`; }

function ResultadoSemanal() {
  const { auth } = useAuth();
  const { scopeIds } = useConsultorScope();
  const [weekOffset, setWeekOffset] = useState(0);

  const { start, end, nextStart, nextEnd } = useMemo(() => {
    const base = addWeeks(new Date(), weekOffset);
    const s = startOfWeek(base, { weekStartsOn: 1 });
    const e = endOfWeek(base, { weekStartsOn: 1 });
    return {
      start: s, end: e,
      nextStart: addWeeks(s, 1), nextEnd: addWeeks(e, 1),
    };
  }, [weekOffset]);

  const { data } = useQuery({
    queryKey: ["resultado-semanal", start.toISOString(), scopeIds.join(",")],
    enabled: !!auth && scopeIds.length > 0,
    queryFn: async () => {
      const startISO = start.toISOString(), endISO = end.toISOString();
      const nextStartISO = nextStart.toISOString(), nextEndISO = nextEnd.toISOString();
      const ids = scopeIds;

      const [eventos, ativ, apolices, recs, eventosProx] = await Promise.all([
        supabase.from("agenda_eventos").select("tipo,resultado,inicio,consultor_id")
          .in("consultor_id", ids).gte("inicio", startISO).lte("inicio", endISO),
        supabase.from("atividades").select("tipo,created_at,consultor_id")
          .in("consultor_id", ids).gte("created_at", startISO).lte("created_at", endISO),
        supabase.from("apolices").select("premio_atual,capital_segurado,data_fechamento,data_emissao,consultor_id,onboarding_status")
          .in("consultor_id", ids)
          .or(`data_fechamento.gte.${startISO},data_emissao.gte.${startISO}`),
        supabase.from("prospects").select("id,created_at,consultor_id,telefone,quem_recomendou")
          .in("consultor_id", ids).gte("created_at", startISO).lte("created_at", endISO)
          .eq("origem", "recomendacao"),
        supabase.from("agenda_eventos").select("tipo,inicio,consultor_id")
          .in("consultor_id", ids).gte("inicio", nextStartISO).lte("inicio", nextEndISO),
      ]);


      const ev = eventos.data ?? [];
      const ab_fone = (ativ.data ?? []).filter((a) => a.tipo === "ligacao").length;
      const abs = ev.filter((e) => e.tipo === "ab").length;
      const fechAg = ev.filter((e) => e.tipo === "fechamento").length;
      const fechRea = ev.filter((e) => e.tipo === "fechamento" && e.resultado).length;
      const revisitas = ev.filter((e) => e.tipo === "revisita").length;
      const entregas = ev.filter((e) => e.tipo === "entrega_apolice").length;

      const ap = apolices.data ?? [];
      const inWeek = (iso?: string | null) => iso && new Date(iso) >= start && new Date(iso) <= end;
      const fechWeek = ap.filter((a) => inWeek(a.data_fechamento));
      const emWeek = ap.filter((a) => inWeek(a.data_emissao));
      const propostas = fechWeek.length;
      const pa = fechWeek.reduce((s, a) => s + Number(a.premio_atual ?? 0), 0);
      const cs = fechWeek.reduce((s, a) => s + Number(a.capital_segurado ?? 0), 0);

      const recsCount = (recs.data ?? []).length;
      const recsComplete = (recs.data ?? []).filter((r) => r.telefone && r.quem_recomendou).length;

      const evP = eventosProx.data ?? [];
      const previsao = {
        abs: evP.filter((e) => e.tipo === "ab").length,
        fech: evP.filter((e) => e.tipo === "fechamento").length,
        revisitas: evP.filter((e) => e.tipo === "revisita").length,
      };

      return {
        ab_fone, abs, fechAg, fechRea, propostas, pa, cs, recsCount, recsComplete,
        revisitas, entregas, emWeek: emWeek.length, previsao,
      };
    },
  });

  const alerts: string[] = [];
  if (data) {
    if (data.abs < 10) alerts.push(`🔴 Menos de 10 ABs na semana (${data.abs}).`);
    if (data.ab_fone < 20) alerts.push(`🔴 Menos de 20 contatos HOT/Ligações (${data.ab_fone}).`);
    if (data.recsCount < 50) alerts.push(`🟡 Apenas ${data.recsCount} recomendações captadas.`);
    if (data.propostas === 0) alerts.push("🔴 Nenhuma proposta fechada nesta semana.");
    if (data.recsCount > data.recsComplete)
      alerts.push(`⚠️ ${data.recsCount - data.recsComplete} recomendações incompletas (sem telefone/recomendante).`);
  }

  return (
    <div>
      <PageHeader eyebrow="Operação" title="Resultado Semanal"
        description="Métricas auditáveis — calculadas direto das atividades registradas." />
      <ConsultorFilter />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="caps-tracking text-gold">
          {format(start, "dd/MM", { locale: ptBR })} → {format(end, "dd/MM/yyyy", { locale: ptBR })}
        </span>
        <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Esta semana</Button>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="AB Fone (ligações)" value={data?.ab_fone ?? "—"} />
        <Stat label="ABs realizadas" value={data?.abs ?? "—"} />
        <Stat label="Fechamentos agendados" value={data?.fechAg ?? "—"} />
        <Stat label="Fechamentos realizados" value={data?.fechRea ?? "—"} />
        <Stat label="Propostas fechadas" value={data?.propostas ?? "—"} />
        <Stat label="PA fechado" value={data ? formatBRL(data.pa) : "—"} />
        <Stat label="Capital segurado" value={data ? formatBRL(data.cs) : "—"} />
        <Stat label="Recomendações" value={data?.recsCount ?? "—"} sub={data ? `${data.recsComplete} completas` : ""} />
        <Stat label="Revisitas" value={data?.revisitas ?? "—"} />
        <Stat label="Entregas de apólice" value={data?.entregas ?? "—"} />
        <Stat label="Apólices emitidas" value={data?.emWeek ?? "—"} />
      </div>

      <Card className="p-5 bg-surface border-border mb-6">
        <p className="caps-tracking text-gold mb-3">Previsão — próxima semana</p>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="ABs agendadas" value={data?.previsao.abs ?? "—"} />
          <Stat label="Fechamentos agendados" value={data?.previsao.fech ?? "—"} />
          <Stat label="Revisitas agendadas" value={data?.previsao.revisitas ?? "—"} />
        </div>
      </Card>

      {alerts.length > 0 && (
        <Card className="p-5 bg-surface border-destructive/40">
          <p className="caps-tracking text-destructive mb-3 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Alertas de performance
          </p>
          <ul className="space-y-2 text-sm">
            {alerts.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <Card className="p-4 bg-surface border-border">
      <p className="caps-tracking text-muted-foreground">{label}</p>
      <p className="font-display text-2xl mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
}
