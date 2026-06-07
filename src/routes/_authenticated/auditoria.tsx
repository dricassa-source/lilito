import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — LILITO" }] }),
  component: Auditoria,
});

type Consultor = { id: string; nome: string };

function Auditoria() {
  const { auth } = useAuth();
  const isMaster = auth?.isMaster ?? false;

  const { data: consultores } = useQuery({
    queryKey: ["consultores-all", auth?.user.id, isMaster],
    enabled: !!auth,
    queryFn: async () => {
      if (!auth) return [] as Consultor[];
      if (!isMaster) {
        const { data } = await supabase.from("profiles").select("id,nome").eq("id", auth.user.id);
        return (data ?? []) as Consultor[];
      }
      const { data: roles } = await supabase.from("user_roles").select("user_id");
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (!ids.length) return [] as Consultor[];
      const { data } = await supabase.from("profiles").select("id,nome").in("id", ids);
      return (data ?? []) as Consultor[];
    },
  });

  const { data: audit } = useQuery({
    queryKey: ["auditoria", consultores?.map((c) => c.id).join(",")],
    enabled: !!consultores && consultores.length > 0,
    queryFn: async () => {
      const ids = consultores!.map((c) => c.id);

      const [prospects, recs, eventos, ativ] = await Promise.all([
        supabase.from("prospects").select("id,nome,telefone,quem_recomendou,consultor_id,etapa_funil,entrou_etapa_em"),
        supabase.from("prospects").select("id,nome,telefone,quem_recomendou,consultor_id").eq("origem", "recomendacao"),
        supabase.from("agenda_eventos").select("id,tipo,resultado,inicio,consultor_id").lte("inicio", new Date().toISOString()),
        supabase.from("atividades").select("id,consultor_id"),
      ]);

      const byConsultor = new Map<string, {
        nome: string; total: number; ganhou: number; perdeu: number;
        recsIncompletas: number; semTelefone: number; eventosSemResultado: number;
        delaysAbandonados: number; cadastrosIncompletos: number; semAtividade: boolean;
      }>();
      for (const c of consultores!) {
        byConsultor.set(c.id, {
          nome: c.nome, total: 0, ganhou: 0, perdeu: 0,
          recsIncompletas: 0, semTelefone: 0, eventosSemResultado: 0,
          delaysAbandonados: 0, cadastrosIncompletos: 0, semAtividade: true,
        });
      }

      for (const p of (prospects.data ?? []) as any[]) {
        const c = byConsultor.get(p.consultor_id); if (!c) continue;
        c.total++;
        if (!p.telefone) { c.semTelefone++; c.perdeu++; } else c.ganhou++;
        if (!p.nome || (!p.telefone && !p.quem_recomendou)) c.cadastrosIncompletos++;
      }
      for (const r of (recs.data ?? []) as any[]) {
        const c = byConsultor.get(r.consultor_id); if (!c) continue;
        if (!r.telefone || !r.quem_recomendou) c.recsIncompletas++;
      }
      for (const e of (eventos.data ?? []) as any[]) {
        const c = byConsultor.get(e.consultor_id); if (!c) continue;
        if (!e.resultado) { c.eventosSemResultado++; c.perdeu++; } else c.ganhou++;
      }
      for (const a of (ativ.data ?? []) as any[]) {
        const c = byConsultor.get(a.consultor_id); if (c) c.semAtividade = false;
      }

      const rows = Array.from(byConsultor.entries()).map(([id, v]) => {
        const denom = v.ganhou + v.perdeu;
        const score = denom > 0 ? Math.round((v.ganhou / denom) * 100) : 100;
        return { id, ...v, score };
      });
      rows.sort((a, b) => b.score - a.score);
      return rows;
    },
  });

  const totals = (audit ?? []).reduce(
    (acc, r) => {
      acc.recsInc += r.recsIncompletas;
      acc.semTel += r.semTelefone;
      acc.evSemRes += r.eventosSemResultado;
      acc.semAtv += r.semAtividade ? 1 : 0;
      return acc;
    },
    { recsInc: 0, semTel: 0, evSemRes: 0, semAtv: 0 },
  );

  return (
    <div>
      <PageHeader eyebrow="Integridade dos dados" title="Auditoria & Score de Qualidade"
        description="Nenhum número sem evidência. Nenhuma produção sem registro." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4 bg-surface border-border">
          <p className="caps-tracking text-muted-foreground">Recomendações incompletas</p>
          <p className="font-display text-2xl mt-1">{totals.recsInc}</p>
        </Card>
        <Card className="p-4 bg-surface border-border">
          <p className="caps-tracking text-muted-foreground">Prospects sem telefone</p>
          <p className="font-display text-2xl mt-1">{totals.semTel}</p>
        </Card>
        <Card className="p-4 bg-surface border-border">
          <p className="caps-tracking text-muted-foreground">Eventos sem resultado</p>
          <p className="font-display text-2xl mt-1">{totals.evSemRes}</p>
        </Card>
        <Card className="p-4 bg-surface border-border">
          <p className="caps-tracking text-muted-foreground">Consultores sem atividade</p>
          <p className="font-display text-2xl mt-1">{totals.semAtv}</p>
        </Card>
      </div>

      <Card className="p-5 bg-surface border-border">
        <p className="caps-tracking text-gold mb-4 flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" /> Score de Qualidade por Consultor
        </p>
        <div className="divide-y divide-border">
          {(audit ?? []).map((r) => (
            <div key={r.id} className="py-3 grid grid-cols-12 gap-3 items-center">
              <div className="col-span-12 md:col-span-3">
                <p className="font-medium text-sm">{r.nome}</p>
                {r.semAtividade && (
                  <Badge variant="outline" className="border-destructive text-destructive mt-1">
                    Sem atividade
                  </Badge>
                )}
              </div>
              <div className="col-span-8 md:col-span-5">
                <Progress value={r.score} className="h-2" />
              </div>
              <div className="col-span-4 md:col-span-1 text-right">
                <span className={`font-display text-xl ${r.score >= 80 ? "text-gold" : r.score >= 60 ? "text-foreground" : "text-destructive"}`}>
                  {r.score}%
                </span>
              </div>
              <div className="col-span-12 md:col-span-3 flex flex-wrap gap-1 text-xs text-muted-foreground">
                {r.recsIncompletas > 0 && <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{r.recsIncompletas} rec.</span>}
                {r.semTelefone > 0 && <span>📵 {r.semTelefone}</span>}
                {r.eventosSemResultado > 0 && <span>📅⚠ {r.eventosSemResultado}</span>}
              </div>
            </div>
          ))}
          {(!audit || audit.length === 0) && (
            <p className="text-sm text-muted-foreground py-4">Sem dados ainda.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
