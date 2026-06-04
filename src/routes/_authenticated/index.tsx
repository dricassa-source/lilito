import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Flame, CalendarDays, AlertTriangle, Users2, Cake, Target } from "lucide-react";

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

function MeuDia() {
  const { auth } = useAuth();
  const uid = auth?.user.id;

  const { data: stats } = useQuery({
    queryKey: ["meu-dia", uid],
    enabled: !!uid,
    queryFn: async () => {
      const today = new Date();
      const start = new Date(today); start.setHours(0,0,0,0);
      const end = new Date(today); end.setHours(23,59,59,999);

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

  return (
    <div>
      <PageHeader
        eyebrow="Hoje"
        title={`Bom dia, ${auth?.profile?.nome?.split(" ")[0] ?? ""}`}
        description="Sua plataforma de relacionamento e gestão comercial."
      />

      <div className="relative overflow-hidden rounded-md border border-gold/30 bg-gradient-to-r from-surface to-surface-elevated p-6 mb-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
        <p className="caps-tracking text-gold">Mantra da semana</p>
        <p className="font-display text-3xl text-foreground mt-2 italic">
          "Quem resolve a semana resolve o mês."
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={AlertTriangle} label="Follow-ups vencidos" value={stats?.followups ?? "—"} to="/atividades" />
        <StatCard icon={CalendarDays} label="Reuniões de hoje" value={stats?.eventos ?? "—"} to="/calendario" />
        <StatCard icon={Flame} label="HOTs pendentes" value={stats?.hot ?? "—"} to="/hot" />
        <StatCard icon={Users2} label="Recomendações recebidas" value={stats?.recomendacoes ?? "—"} to="/recomendacoes" />
        <StatCard icon={Cake} label="Aniversariantes" value="—" sub="Em breve" />
        <StatCard icon={Target} label="Meta semanal" value="0 / 3" sub="Planos da semana" />
      </div>
    </div>
  );
}
