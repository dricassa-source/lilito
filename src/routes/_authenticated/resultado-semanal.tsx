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

      const [eventos, apolices, recs, eventosProx] = await Promise.all([
        supabase.from("agenda_eventos")
          .select("tipo,inicio,consultor_id,delay_em,delay_resolvido,pendencia_tipo")
          .in("consultor_id", ids).gte("inicio", startISO).lte("inicio", endISO),
        supabase.from("apolices").select("premio_atual,capital_segurado,data_fechamento,consultor_id")
          .in("consultor_id", ids)
          .gte("data_fechamento", startISO).lte("data_fechamento", endISO),
        supabase.from("prospects").select("id,created_at,consultor_id,telefone,nome,quem_recomendou")
          .in("consultor_id", ids).gte("created_at", startISO).lte("created_at", endISO)
          .eq("origem", "recomendacao"),
        supabase.from("agenda_eventos").select("tipo,inicio,consultor_id")
          .in("consultor_id", ids).gte("inicio", nextStartISO).lte("inicio", nextEndISO),
      ]);

      const ev = eventos.data ?? [];
      // delay genérico (cicatriz vermelha) = qualquer evento que entrou em Delay (ativo ou resolvido), exceto F2
      const temDelay = (e: any) => e.delay_em != null && e.pendencia_tipo !== "f2";
      // F2 travado = pendência F2 ainda não resolvida
      const f2Travado = (e: any) => e.pendencia_tipo === "f2" && !e.delay_resolvido;

      const abs = ev.filter((e) => e.tipo === "ab");
      const fechs = ev.filter((e) => e.tipo === "fechamento");
      const ents = ev.filter((e) => e.tipo === "entrega_apolice");

      const absAg = abs.length;
      const absRea = abs.filter((e) => !temDelay(e)).length;
      const fechAg = fechs.length;
      const fechRea = fechs.filter((e) => !temDelay(e) && !f2Travado(e)).length;
      const entregas = ents.filter((e) => !temDelay(e)).length;

      const ap = apolices.data ?? [];
      const propostas = ap.length;
      const pa = ap.reduce((s, a) => s + Number(a.premio_atual ?? 0), 0);
      const cs = ap.reduce((s, a) => s + Number(a.capital_segurado ?? 0), 0);

      const recsList = (recs.data ?? []).filter((r) => r.nome && r.telefone);
      const recsCount = recsList.length;
      const recsComplete = recsList.filter((r) => r.quem_recomendou).length;

      const evP = eventosProx.data ?? [];
      const previsao = {
        abs: evP.filter((e) => e.tipo === "ab").length,
        fech: evP.filter((e) => e.tipo === "fechamento").length,
      };

      return {
        absAg, absRea, fechAg, fechRea, propostas, pa, cs,
        recsCount, recsComplete, entregas, previsao,
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


      <Card className="p-5 bg-surface border-border mb-6">
        <p className="caps-tracking text-gold mb-3">📊 Produção da semana</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Stat label="📞 AB Fone" value={data?.ab_fone ?? "—"} />
          <Stat label="📅 ABs Agendadas" value={data?.previsao ? "—" : "—"} sub="(agenda atual)" />
          <Stat label="🤝 ABs Realizadas" value={data?.abs ?? "—"} />
          <Stat label="💰 Fechamentos Agendados" value={data?.fechAg ?? "—"} />
          <Stat label="🏆 Fechamentos Realizados" value={data?.fechRea ?? "—"} />
          <Stat label="📄 Propostas Fechadas" value={data?.propostas ?? "—"} />
          <Stat label="💵 PA Fechado" value={data ? formatBRL(data.pa) : "—"} />
          <Stat label="🛡️ Capital Segurado" value={data ? formatBRL(data.cs) : "—"} />
          <Stat label="👥 Recomendações Captadas" value={data?.recsCount ?? "—"} sub={data ? `${data.recsComplete} completas` : ""} />
          <Stat label="📦 Entregas de Apólice" value={data?.entregas ?? "—"} />
        </div>
      </Card>

      <Card className="p-5 bg-surface border-gold/30 mb-6">
        <p className="caps-tracking text-gold mb-3">🔮 Próxima semana</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="📅 ABs Agendadas" value={data?.previsao.abs ?? "—"} />
          <Stat label="💰 Fechamentos Agendados" value={data?.previsao.fech ?? "—"} />
          <Stat label="📄 Previsão de Propostas" value={data?.previsao.fech ?? "—"} sub="≈ fechamentos agendados" />
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
