import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/lilito/PageHeader";
import {
  Flame,
  CalendarDays,
  AlertTriangle,
  Users2,
  Cake,
  Target,
  Users,
  FileSignature,
  TrendingUp,
  Wallet,
  Crown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Meu Dia — LILITO" }] }),
  component: MeuDia,
});

function StatCard({ icon: Icon, label, value, sub, to }: any) {
  const content = (
    <Card className="p-5 bg-surface border-border hover:border-gold/40 transition-colors group h-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="caps-tracking text-muted-foreground">{label}</p>
          <p className="font-display text-4xl text-foreground mt-2">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <Icon className="h-5 w-5 text-gold opacity-60 group-hover:opacity-100" strokeWidth={1.3} />
      </div>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function formatBRL(n: number) {
  return `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
}

function weekRange() {
  const now = new Date();
  const day = now.getDay(); // 0 sun .. 6 sat
  const diffToMonday = (day + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

function MeuDia() {
  const { auth } = useAuth();
  const uid = auth?.user.id;
  const isMaster = auth?.isMaster ?? false;

  const { data: stats } = useQuery({
    queryKey: ["meu-dia", uid, isMaster],
    enabled: !!uid,
    queryFn: async () => {
      const today = new Date();
      const start = new Date(today); start.setHours(0, 0, 0, 0);
      const end = new Date(today); end.setHours(23, 59, 59, 999);

      const [hot, eventos, followups, recomendacoes] = await Promise.all([
        supabase.from("prospects").select("id", { count: "exact", head: true }).eq("etapa_funil", "hot").eq("status_hot", "pendente"),
        supabase.from("agenda_eventos").select("id", { count: "exact", head: true })
          .gte("inicio", start.toISOString()).lte("inicio", end.toISOString()),
        supabase.from("atividades").select("id", { count: "exact", head: true })
          .lte("follow_up_em", new Date().toISOString()).not("follow_up_em", "is", null),
        supabase.from("prospects").select("id", { count: "exact", head: true }).eq("origem", "recomendacao").eq("etapa_funil", "recomendacao"),
      ]);

      return {
        hot: hot.count ?? 0,
        eventos: eventos.count ?? 0,
        followups: followups.count ?? 0,
        recomendacoes: recomendacoes.count ?? 0,
      };
    },
  });

  const { data: equipe } = useQuery({
    queryKey: ["meu-dia-equipe", uid],
    enabled: !!uid && isMaster,
    queryFn: async () => {
      const { start: wStart, end: wEnd } = weekRange();
      const { start: mStart, end: mEnd } = monthRange();

      const [consultoresRes, planosSemanaRes, paSemanaRes, paMesRes, todosConsultores] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("apolices").select("id", { count: "exact", head: true })
          .eq("status", "migrado")
          .gte("updated_at", wStart.toISOString()).lt("updated_at", wEnd.toISOString()),
        supabase.from("apolices").select("premio_atual,updated_at,status")
          .eq("status", "migrado")
          .gte("updated_at", wStart.toISOString()).lt("updated_at", wEnd.toISOString()),
        supabase.from("apolices").select("premio_atual,consultor_id,updated_at,status")
          .eq("status", "migrado")
          .gte("updated_at", mStart.toISOString()).lt("updated_at", mEnd.toISOString()),
        supabase.from("profiles").select("id,nome").eq("ativo", true),
      ]);

      const paSemana = (paSemanaRes.data ?? []).reduce((s, r: any) => s + Number(r.premio_atual ?? 0), 0);
      const mesRows = (paMesRes.data ?? []) as any[];
      const paMes = mesRows.reduce((s, r) => s + Number(r.premio_atual ?? 0), 0);

      const byConsultor = new Map<string, number>();
      for (const r of mesRows) {
        byConsultor.set(r.consultor_id, (byConsultor.get(r.consultor_id) ?? 0) + Number(r.premio_atual ?? 0));
      }
      const nomes = new Map<string, string>();
      for (const p of (todosConsultores.data ?? []) as any[]) nomes.set(p.id, p.nome);
      const ranking = Array.from(byConsultor.entries())
        .map(([id, pa]) => ({ id, nome: nomes.get(id) ?? "—", pa }))
        .sort((a, b) => b.pa - a.pa)
        .slice(0, 5);

      return {
        consultoresAtivos: consultoresRes.count ?? 0,
        planosSemana: planosSemanaRes.count ?? 0,
        paSemana,
        paMes,
        ranking,
      };
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow={isMaster ? "Painel da Unidade" : "Hoje"}
        title={`Bom dia, ${auth?.profile?.nome?.split(" ")[0] ?? ""}`}
        description={isMaster ? "Visão executiva da operação VINCA." : "Sua plataforma de relacionamento e gestão comercial."}
      />

      <div className="relative overflow-hidden rounded-md border border-gold/30 bg-gradient-to-r from-surface to-surface-elevated p-6 mb-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
        <p className="caps-tracking text-gold">Mantra da semana</p>
        <p className="font-display text-3xl text-foreground mt-2 italic">
          "Quem resolve a semana resolve o mês."
        </p>
      </div>

      {isMaster && (
        <div className="mb-6">
          <p className="caps-tracking text-gold mb-3 flex items-center gap-2">
            <Crown className="h-3.5 w-3.5" strokeWidth={1.4} /> Gestão da Unidade
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Consultores ativos" value={equipe?.consultoresAtivos ?? "—"} to="/administracao" />
            <StatCard icon={FileSignature} label="Planos da semana" value={equipe?.planosSemana ?? "—"} sub="Equipe" />
            <StatCard icon={TrendingUp} label="PA emitido — semana" value={equipe ? formatBRL(equipe.paSemana) : "—"} />
            <StatCard icon={Wallet} label="PA emitido — mês" value={equipe ? formatBRL(equipe.paMes) : "—"} />
          </div>

          <Card className="mt-4 p-6 bg-surface border-border">
            <div className="flex items-center justify-between mb-4">
              <p className="caps-tracking text-gold">Ranking — Produção do mês</p>
              <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-gold transition-colors">
                Ver dashboard completo →
              </Link>
            </div>
            {!equipe || equipe.ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma produção registrada neste mês.</p>
            ) : (
              <ol className="divide-y divide-border">
                {equipe.ranking.map((c, idx) => (
                  <li key={c.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className={`font-display text-2xl w-8 ${idx === 0 ? "text-gold" : "text-muted-foreground"}`}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="text-foreground">{c.nome}</span>
                    </div>
                    <span className="font-display text-lg text-foreground">{formatBRL(c.pa)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}

      <p className="caps-tracking text-muted-foreground mb-3 mt-2">
        {isMaster ? "Sua agenda pessoal" : "Sua operação de hoje"}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={AlertTriangle} label="Follow-ups vencidos" value={stats?.followups ?? "—"} to="/atividades" />
        <StatCard icon={CalendarDays} label="Reuniões de hoje" value={stats?.eventos ?? "—"} to="/calendario" />
        <StatCard icon={Flame} label="HOTs pendentes" value={stats?.hot ?? "—"} to="/hot" />
        <StatCard icon={Users2} label="Recomendações recebidas" value={stats?.recomendacoes ?? "—"} to="/recomendacoes" />
        <StatCard icon={Cake} label="Aniversariantes" value="—" sub="Em breve" />
        {!isMaster && (
          <StatCard icon={Target} label="Meta semanal" value="0 / 3" sub="Planos da semana" />
        )}
      </div>
    </div>
  );
}
