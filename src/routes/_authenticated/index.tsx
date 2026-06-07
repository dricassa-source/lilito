import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useConsultorScope, applyScope } from "@/hooks/useConsultorScope";
import { ConsultorFilter } from "@/components/lilito/ConsultorFilter";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/lilito/PageHeader";
import { ScoreStars } from "@/components/lilito/ScoreStars";
import { NovoLembrete } from "./lembretes";
import {
  Flame, CalendarDays, AlertTriangle, Cake, Bell, Check,
  PhoneCall, Plus, Trash2, MessageCircle, Calendar as CalIcon,
  Target, Clock, AlertOctagon,
} from "lucide-react";
import { format, startOfDay, endOfDay, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState } from "react";


export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Meu Dia — LILITO" }] }),
  component: MeuDia,
});

function StatCard({ icon: Icon, label, value, sub, to, tone }: any) {
  const content = (
    <Card className={`p-4 bg-surface border-border hover:border-gold/40 transition-colors group h-full ${tone === "warn" ? "border-yellow-500/40" : ""} ${tone === "danger" ? "border-destructive/40" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="caps-tracking text-muted-foreground text-[0.6rem]">{label}</p>
          <p className="font-display text-3xl text-foreground mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <Icon className={`h-5 w-5 opacity-70 group-hover:opacity-100 ${tone === "danger" ? "text-destructive" : tone === "warn" ? "text-yellow-500" : "text-gold"}`} strokeWidth={1.3} />
      </div>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function whatsappLink(tel?: string | null) {
  if (!tel) return null;
  const clean = tel.replace(/\D+/g, "");
  if (!clean) return null;
  const withCc = clean.startsWith("55") ? clean : `55${clean}`;
  return `https://wa.me/${withCc}`;
}

function MeuDia() {
  const { auth } = useAuth();
  const uid = auth?.user.id;
  const isMaster = auth?.isMaster ?? false;
  const { scopeIds } = useConsultorScope();
  const scopeKey = scopeIds.join(",");

  const today = new Date();
  const dayStart = startOfDay(today).toISOString();
  const dayEnd = endOfDay(today).toISOString();

  const { data: stats } = useQuery({
    queryKey: ["meu-dia-stats", scopeKey],
    enabled: !!uid && scopeIds.length > 0,
    queryFn: async () => {
      const [hot, eventos, followups, delays] = await Promise.all([
        applyScope(supabase.from("prospects").select("id", { count: "exact", head: true })
          .eq("etapa_funil", "hot").eq("status_hot", "pendente"), scopeIds),
        applyScope(supabase.from("agenda_eventos").select("id", { count: "exact", head: true })
          .gte("inicio", dayStart).lte("inicio", dayEnd), scopeIds),
        applyScope(supabase.from("atividades").select("id", { count: "exact", head: true })
          .lte("follow_up_em", new Date().toISOString()).not("follow_up_em", "is", null), scopeIds),
        applyScope(supabase.from("agenda_eventos").select("id", { count: "exact", head: true })
          .eq("delay_resolvido", false).not("delay_em", "is", null), scopeIds),
      ]);
      return {
        hot: hot.count ?? 0,
        eventos: eventos.count ?? 0,
        followups: followups.count ?? 0,
        delays: delays.count ?? 0,
      };
    },
  });

  const { data: reunioesHoje } = useQuery({
    queryKey: ["meu-dia-reunioes", scopeKey, dayStart],
    enabled: !!uid && scopeIds.length > 0,
    queryFn: async () => {
      const { data } = await applyScope(
        supabase.from("agenda_eventos")
          .select("id,titulo,tipo,inicio,fim,prospect_id")
          .gte("inicio", dayStart).lte("inicio", dayEnd),
        scopeIds,
      ).order("inicio", { ascending: true });
      return data ?? [];
    },
  });

  const { data: agendaSemana } = useQuery({
    queryKey: ["meu-dia-agenda-semana", scopeKey],
    enabled: !!uid && scopeIds.length > 0,
    queryFn: async () => {
      const weekStart = startOfDay(today);
      const end = endOfDay(addDays(weekStart, 6)).toISOString();
      const { data } = await applyScope(
        supabase.from("agenda_eventos")
          .select("id,titulo,tipo,inicio,prospect_id,delay_em,delay_resolvido")
          .gte("inicio", weekStart.toISOString()).lte("inicio", end),
        scopeIds,
      ).order("inicio", { ascending: true });
      return data ?? [];
    },
  });

  const { data: followupsList } = useQuery({
    queryKey: ["meu-dia-followups", scopeKey],
    enabled: !!uid && scopeIds.length > 0,
    queryFn: async () => {
      const { data } = await applyScope(
        supabase.from("atividades")
          .select("id,prospect_id,follow_up_em,observacao,prospects(nome,telefone,score)")
          .lte("follow_up_em", new Date().toISOString())
          .not("follow_up_em", "is", null),
        scopeIds,
      ).order("follow_up_em", { ascending: true }).limit(50);
      // Dedupe por prospect_id (mantém o mais antigo = mais atrasado)
      const seen = new Set<string>();
      const dedup: any[] = [];
      for (const a of data ?? []) {
        const key = a.prospect_id ?? a.id;
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(a);
      }
      return dedup.slice(0, 8);
    },
  });

  const { data: aniversariantes } = useQuery({
    queryKey: ["meu-dia-aniversariantes", scopeKey],
    enabled: !!uid && scopeIds.length > 0,
    queryFn: async () => {
      const { data } = await applyScope(
        supabase.from("prospects")
          .select("id,nome,data_nascimento,telefone,etapa_funil")
          .not("data_nascimento", "is", null),
        scopeIds,
      );
      const now = new Date();
      const list = (data ?? []).map((p: any) => {
        const dn = new Date(p.data_nascimento);
        const proximo = new Date(now.getFullYear(), dn.getMonth(), dn.getDate());
        if (proximo < startOfDay(now)) proximo.setFullYear(now.getFullYear() + 1);
        return { ...p, proximo, diasFaltam: differenceInDays(startOfDay(proximo), startOfDay(now)) };
      }).sort((a, b) => a.diasFaltam - b.diasFaltam);
      return list;
    },
  });

  const { data: alertas } = useQuery({
    queryKey: ["meu-dia-alertas", scopeKey],
    enabled: !!uid && scopeIds.length > 0,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const [parados, delaysAtivos, semResultado] = await Promise.all([
        applyScope(supabase.from("prospects").select("id", { count: "exact", head: true })
          .not("etapa_funil", "in", "(cliente,pos_venda,perdido)")
          .lte("entrou_etapa_em", sevenDaysAgo), scopeIds),
        applyScope(supabase.from("agenda_eventos").select("id", { count: "exact", head: true })
          .eq("delay_resolvido", false).not("delay_em", "is", null), scopeIds),
        applyScope(supabase.from("agenda_eventos").select("id", { count: "exact", head: true })
          .lt("fim", new Date().toISOString()).is("resultado", null), scopeIds),
      ]);
      return {
        parados: parados.count ?? 0,
        delays: delaysAtivos.count ?? 0,
        semResultado: semResultado.count ?? 0,
      };
    },
  });


  return (
    <div>
      <PageHeader
        eyebrow={isMaster ? "Painel da Unidade" : "Hoje"}
        title={`Bom dia, ${auth?.profile?.nome?.split(" ")[0] ?? ""}`}
        description="Sua tela de execução da operação VINCA."
      />
      <ConsultorFilter />

      <LembretesHoje />


      <p className="caps-tracking text-muted-foreground mb-3 mt-2">Resumo rápido</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={AlertTriangle} label="Follow-ups vencidos" value={stats?.followups ?? "—"} to="/atividades" tone={stats?.followups ? "warn" : undefined} />
        <StatCard icon={CalendarDays} label="Reuniões hoje" value={stats?.eventos ?? "—"} to="/calendario" />
        <StatCard icon={Flame} label="HOTs pendentes" value={stats?.hot ?? "—"} to="/hot" />
        <StatCard icon={Clock} label="Em Delay" value={stats?.delays ?? "—"} to="/em-delay" tone={stats?.delays ? "danger" : undefined} />
      </div>

      <div className="flex gap-2 mb-6">
        <Link to="/hot" className="flex-1">
          <Button className="w-full gold-gradient text-background h-12">
            <PhoneCall className="h-4 w-4 mr-2" /> Iniciar Ligações (HOT)
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <DesafiosDoDia uid={uid ?? ""} />
        <MinhaAgenda items={agendaSemana ?? []} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <FollowupsBloco items={followupsList ?? []} />
        <ReunioesBloco items={reunioesHoje ?? []} />
      </div>

      <AlertasOperacionais alertas={alertas} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <Aniversariantes items={aniversariantes ?? []} />
        <FraseRotativa />
      </div>
    </div>
  );
}

function Aniversariantes({ items }: { items: any[] }) {
  const hoje = items.filter((p) => p.diasFaltam === 0);
  const proximo = items.find((p) => p.diasFaltam > 0);
  return (
    <Card className="p-5 bg-surface border-border">
      <p className="caps-tracking text-gold flex items-center gap-2 text-[0.6rem] mb-3">
        <Cake className="h-3.5 w-3.5" /> Aniversariantes
      </p>
      {hoje.length === 0 && !proximo ? (
        <p className="text-sm text-muted-foreground">Sem aniversários registrados.</p>
      ) : (
        <div className="space-y-3">
          {hoje.length > 0 && (
            <div>
              <p className="caps-tracking text-emerald-500 text-[0.55rem] mb-1">Hoje</p>
              <ul className="space-y-1">
                {hoje.map((p) => (
                  <li key={p.id} className="text-sm flex items-center gap-2">
                    🎂 <span className="font-medium">{p.nome}</span>
                    <span className="text-xs text-muted-foreground">— Hoje</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {proximo && (
            <div>
              <p className="caps-tracking text-muted-foreground text-[0.55rem] mb-1">Próximo</p>
              <p className="text-sm flex items-center gap-2">
                🎂 <span className="font-medium">{proximo.nome}</span>
              </p>
              <p className="text-xs text-muted-foreground ml-6">
                {format(proximo.proximo, "dd/MM", { locale: ptBR })} · em {proximo.diasFaltam} dia{proximo.diasFaltam === 1 ? "" : "s"}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function FraseRotativa() {
  const { data } = useQuery({
    queryKey: ["frases-ativas"],
    queryFn: async () => {
      const { data } = await supabase.from("frases_cultura").select("texto").eq("ativo", true).order("ordem");
      return (data ?? []).map((f) => f.texto);
    },
  });
  const list = data && data.length > 0 ? data : ["Quem resolve a semana resolve o mês."];
  const idx = Math.floor(Date.now() / (1000 * 60 * 60 * 6)) % list.length;
  return (
    <Card className="p-5 bg-surface border-border relative overflow-hidden">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/10 blur-3xl" />
      <p className="caps-tracking text-gold text-[0.6rem]">Cultura VINCA</p>
      <p className="font-display text-lg text-foreground mt-1 italic">"{list[idx]}"</p>
    </Card>
  );
}

function LembretesHoje() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const { scopeIds } = useConsultorScope();
  const hoje = format(new Date(), "yyyy-MM-dd");
  const { data } = useQuery({
    queryKey: ["lembretes-meu-dia", scopeIds.join(","), hoje],
    enabled: !!auth && scopeIds.length > 0,
    queryFn: async () => {
      const { data } = await applyScope(
        supabase.from("lembretes")
          .select("id,titulo,hora,observacao")
          .eq("concluido", false).lte("data", hoje),
        scopeIds,
      ).order("data").order("hora").limit(10);
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("lembretes").update({ concluido: true, concluido_em: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lembretes-meu-dia"] }),
  });

  if (!data || data.length === 0) return null;

  return (
    <Card className="p-4 bg-surface border-border mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="caps-tracking text-gold flex items-center gap-2 text-[0.6rem]">
          <Bell className="h-3.5 w-3.5" /> Lembretes ({data.length})
        </p>
        <NovoLembrete onSaved={() => qc.invalidateQueries({ queryKey: ["lembretes-meu-dia"] })} />
      </div>
      <ul className="divide-y divide-border">
        {data.map((l) => (
          <li key={l.id} className="py-2 flex items-center gap-2">
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => toggle.mutate(l.id)}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <div className="flex-1">
              <p className="text-sm">{l.titulo}{l.hora ? <span className="text-muted-foreground ml-2 text-xs">{l.hora.slice(0,5)}</span> : null}</p>
              {l.observacao && <p className="text-xs text-muted-foreground">{l.observacao}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

type Desafio = { id: string; texto: string; feito: boolean };

function DesafiosDoDia({ uid }: { uid: string }) {
  const hoje = format(new Date(), "yyyy-MM-dd");
  const key = `desafios:${uid}:${hoje}`;
  const [items, setItems] = useState<Desafio[]>([]);
  const [novo, setNovo] = useState("");

  useEffect(() => {
    if (!uid) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        setItems(JSON.parse(raw));
      } else {
        setItems([
          { id: crypto.randomUUID(), texto: "Fazer 20 HOTs", feito: false },
          { id: crypto.randomUUID(), texto: "Realizar 3 ABs", feito: false },
          { id: crypto.randomUUID(), texto: "Captar 10 recomendações", feito: false },
        ]);
      }
    } catch { /* noop */ }
  }, [key, uid]);

  function persist(next: Desafio[]) {
    setItems(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* noop */ }
  }

  function add() {
    const t = novo.trim();
    if (!t) return;
    persist([...items, { id: crypto.randomUUID(), texto: t, feito: false }]);
    setNovo("");
  }
  function toggle(id: string) {
    persist(items.map((d) => d.id === id ? { ...d, feito: !d.feito } : d));
  }
  function remove(id: string) {
    persist(items.filter((d) => d.id !== id));
  }

  const done = items.filter((d) => d.feito).length;
  return (
    <Card className="p-4 bg-surface border-border">
      <div className="flex items-center justify-between mb-3">
        <p className="caps-tracking text-gold flex items-center gap-2 text-[0.6rem]">
          <Target className="h-3.5 w-3.5" /> Desafios do dia ({done}/{items.length})
        </p>
      </div>
      <ul className="divide-y divide-border mb-3 max-h-48 overflow-y-auto">
        {items.length === 0 && <li className="py-2 text-xs text-muted-foreground">Adicione seu primeiro desafio do dia.</li>}
        {items.map((d) => (
          <li key={d.id} className="py-2 flex items-center gap-2">
            <Button size="icon" variant={d.feito ? "default" : "outline"} className="h-7 w-7" onClick={() => toggle(d.id)}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <span className={`flex-1 text-sm ${d.feito ? "line-through text-muted-foreground" : ""}`}>{d.texto}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => remove(d.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Novo desafio..."
          className="h-9"
        />
        <Button size="icon" onClick={add} className="h-9 w-9 gold-gradient text-background"><Plus className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}

function MinhaAgenda({ items }: { items: any[] }) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const byDay = days.map((d) => ({
    date: d,
    items: items.filter((e) => isSameDayLocal(new Date(e.inicio), d)),
  }));
  return (
    <Card className="p-4 bg-surface border-border">
      <div className="flex items-center justify-between mb-3">
        <p className="caps-tracking text-gold flex items-center gap-2 text-[0.6rem]">
          <CalIcon className="h-3.5 w-3.5" /> Mini agenda semanal
        </p>
        <Link to="/calendario" className="text-xs text-muted-foreground hover:text-gold">Abrir calendário completo →</Link>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {byDay.map(({ date, items: dayItems }) => {
          const isToday = isSameDayLocal(date, today);
          return (
            <div key={date.toISOString()} className={`rounded-md border ${isToday ? "border-gold/60 bg-gold/5" : "border-border bg-background/40"} p-1.5 min-h-[120px] flex flex-col`}>
              <div className="text-center mb-1.5">
                <p className="caps-tracking text-muted-foreground text-[0.55rem] leading-none">
                  {format(date, "EEE", { locale: ptBR }).slice(0, 3).toUpperCase()}
                </p>
                <p className={`font-display text-base leading-none mt-0.5 ${isToday ? "text-gold" : "text-foreground"}`}>{format(date, "d")}</p>
              </div>
              <div className="space-y-1 overflow-hidden">
                {dayItems.slice(0, 3).map((e) => {
                  const c = ETAPA_DOT[e.tipo] ?? "bg-muted text-muted-foreground";
                  return (
                    <Link to="/calendario" key={e.id}>
                      <div className={`${c} rounded px-1 py-0.5 text-[9px] truncate cursor-pointer hover:opacity-80`} title={`${format(new Date(e.inicio), "HH:mm")} · ${e.titulo}`}>
                        {format(new Date(e.inicio), "HH:mm")} {e.titulo}
                      </div>
                    </Link>
                  );
                })}
                {dayItems.length > 3 && (
                  <p className="text-[9px] text-muted-foreground text-center">+{dayItems.length - 3}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function isSameDayLocal(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const ETAPA_DOT: Record<string, string> = {
  hot: "bg-orange-500/30 text-orange-200",
  ab: "bg-yellow-500/30 text-yellow-200",
  revisita: "bg-blue-500/30 text-blue-200",
  fechamento: "bg-emerald-600/30 text-emerald-200",
  entrega_apolice: "bg-emerald-300/30 text-emerald-100",
  onboarding: "bg-emerald-300/30 text-emerald-100",
  joint_work: "bg-gold/30 text-gold",
  recorrente: "bg-gold/20 text-gold",
  bloqueio: "bg-muted text-muted-foreground",
};

function FollowupsBloco({ items }: { items: any[] }) {
  return (
    <Card className="p-4 bg-surface border-border">
      <p className="caps-tracking text-gold flex items-center gap-2 text-[0.6rem] mb-3">
        <AlertTriangle className="h-3.5 w-3.5" /> Follow-ups vencidos ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum follow-up em atraso. Bom trabalho.</p>
      ) : (
        <ul className="divide-y divide-border max-h-56 overflow-y-auto">
          {items.map((a) => {
            const p = a.prospects as any;
            const dias = a.follow_up_em ? differenceInDays(new Date(), new Date(a.follow_up_em)) : 0;
            const wa = whatsappLink(p?.telefone);
            return (
              <li key={a.id} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm truncate flex items-center gap-2">
                    {p?.nome ?? "—"}
                    <ScoreStars score={p?.score ?? 1} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p?.telefone ?? "Sem telefone"} · {dias}d de atraso
                  </p>
                </div>
                <div className="flex gap-1">
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-emerald-500"><MessageCircle className="h-4 w-4" /></Button>
                    </a>
                  )}
                  <Link to="/calendario">
                    <Button size="icon" variant="ghost" className="h-8 w-8"><CalIcon className="h-4 w-4" /></Button>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ReunioesBloco({ items }: { items: any[] }) {
  return (
    <Card className="p-4 bg-surface border-border">
      <p className="caps-tracking text-gold flex items-center gap-2 text-[0.6rem] mb-3">
        <CalendarDays className="h-3.5 w-3.5" /> Reuniões do dia ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma reunião agendada para hoje.</p>
      ) : (
        <ul className="divide-y divide-border max-h-56 overflow-y-auto">
          {items.map((e) => (
            <li key={e.id} className="py-2">
              <p className="text-sm flex items-center gap-2">
                <span className="font-mono text-xs text-gold">{format(new Date(e.inicio), "HH:mm")}</span>
                <span className="truncate">{e.titulo}</span>
              </p>
              <p className="text-xs text-muted-foreground capitalize">{e.tipo}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AlertasOperacionais({ alertas }: { alertas: { parados: number; delays: number; semResultado: number } | undefined }) {
  const a = alertas ?? { parados: 0, delays: 0, semResultado: 0 };
  const total = a.parados + a.delays + a.semResultado;
  return (
    <Card className={`p-4 bg-surface ${total > 0 ? "border-destructive/40" : "border-border"}`}>
      <p className="caps-tracking text-gold flex items-center gap-2 text-[0.6rem] mb-3">
        <AlertOctagon className="h-3.5 w-3.5" /> Alertas operacionais
      </p>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pendência crítica.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <Link to="/funil" className="p-3 rounded-md border border-border hover:border-gold/40 transition-colors">
            <p className="text-xs text-muted-foreground">Prospects parados &gt; 7d</p>
            <p className="font-display text-2xl mt-1">{a.parados}</p>
          </Link>
          <Link to="/em-delay" className="p-3 rounded-md border border-border hover:border-gold/40 transition-colors">
            <p className="text-xs text-muted-foreground">Delays ativos</p>
            <p className="font-display text-2xl mt-1 text-destructive">{a.delays}</p>
          </Link>
          <Link to="/calendario" className="p-3 rounded-md border border-border hover:border-gold/40 transition-colors">
            <p className="text-xs text-muted-foreground">Eventos sem resultado</p>
            <p className="font-display text-2xl mt-1">{a.semResultado}</p>
          </Link>
        </div>
      )}
    </Card>
  );
}
