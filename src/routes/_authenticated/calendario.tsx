import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths, startOfDay, endOfDay,
  isSameDay, isSameMonth, differenceInMinutes,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({ meta: [{ title: "Calendário — LILITO" }] }),
  component: Calendario,
});

const TIPOS = [
  { v: "ab", l: "AB" },
  { v: "revisita", l: "Revisita" },
  { v: "fechamento", l: "Fechamento" },
  { v: "entrega_apolice", l: "Entrega de Apólice" },
  { v: "joint_work", l: "Joint Work" },
  { v: "review", l: "Review" },
] as const;

const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS.map((t) => [t.v, t.l]));

const NATUREZA_COLOR: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  ab:              { bg: "bg-nat-ab/15",         border: "border-nat-ab/60",         text: "text-nat-ab",         dot: "bg-nat-ab" },
  revisita:        { bg: "bg-nat-revisita/15",   border: "border-nat-revisita/60",   text: "text-nat-revisita",   dot: "bg-nat-revisita" },
  fechamento:      { bg: "bg-nat-fechamento/15", border: "border-nat-fechamento/60", text: "text-nat-fechamento", dot: "bg-nat-fechamento" },
  entrega_apolice: { bg: "bg-nat-entrega/15",    border: "border-nat-entrega/60",    text: "text-nat-entrega",    dot: "bg-nat-entrega" },
  joint_work:      { bg: "bg-gold/10",           border: "border-gold/40",           text: "text-gold",           dot: "bg-gold" },
  review:          { bg: "bg-muted",             border: "border-border",            text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

type View = "dia" | "semana" | "mes";

function Calendario() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("semana");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [consultor, setConsultor] = useState<string>("me"); // "me" | "all" | uuid

  const range = useMemo(() => {
    if (view === "dia") return { from: startOfDay(anchor), to: endOfDay(anchor) };
    if (view === "semana") return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) };
    return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  }, [view, anchor]);

  const { data: consultores } = useQuery({
    queryKey: ["consultores"],
    enabled: !!auth?.isMaster,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: eventos } = useQuery({
    queryKey: ["agenda", range.from.toISOString(), range.to.toISOString(), consultor, auth?.user.id],
    enabled: !!auth,
    queryFn: async () => {
      let q = supabase.from("agenda_eventos").select("*")
        .gte("inicio", range.from.toISOString())
        .lte("inicio", range.to.toISOString())
        .order("inicio");
      if (consultor === "me") q = q.eq("consultor_id", auth!.user.id);
      else if (consultor !== "all") q = q.eq("consultor_id", consultor);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Week metrics
  const weekRange = useMemo(() => ({
    from: startOfWeek(anchor, { weekStartsOn: 1 }),
    to: endOfWeek(anchor, { weekStartsOn: 1 }),
  }), [anchor]);

  const { data: semanaEventos } = useQuery({
    queryKey: ["agenda-semana", weekRange.from.toISOString(), consultor, auth?.user.id],
    enabled: !!auth,
    queryFn: async () => {
      let q = supabase.from("agenda_eventos").select("tipo")
        .gte("inicio", weekRange.from.toISOString())
        .lte("inicio", weekRange.to.toISOString());
      if (consultor === "me") q = q.eq("consultor_id", auth!.user.id);
      else if (consultor !== "all") q = q.eq("consultor_id", consultor);
      const { data } = await q;
      return data ?? [];
    },
  });

  const counts = useMemo(() => {
    const c = { ab: 0, revisita: 0, fechamento: 0, entrega_apolice: 0 };
    (semanaEventos ?? []).forEach((e: any) => { if (e.tipo in c) (c as any)[e.tipo]++; });
    return c;
  }, [semanaEventos]);

  function shift(dir: -1 | 1) {
    if (view === "dia") setAnchor(addDays(anchor, dir));
    else if (view === "semana") setAnchor(dir === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1));
    else setAnchor(dir === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1));
  }

  const periodoLabel =
    view === "dia" ? format(anchor, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })
    : view === "semana" ? `${format(weekRange.from, "dd MMM", { locale: ptBR })} — ${format(weekRange.to, "dd MMM yyyy", { locale: ptBR })}`
    : format(anchor, "MMMM yyyy", { locale: ptBR });

  return (
    <div>
      <PageHeader
        eyebrow="Agenda" title="Calendário" description="Agenda operacional da unidade — visualize ABs, revisitas, fechamentos e entregas."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gold-gradient text-background"><Plus className="h-4 w-4 mr-2" />Novo evento</Button></DialogTrigger>
            <NovoEvento onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["agenda"] }); qc.invalidateQueries({ queryKey: ["agenda-semana"] }); }} />
          </Dialog>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => setAnchor(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          <p className="caps-tracking text-gold ml-2">{periodoLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={consultor} onValueChange={setConsultor}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="me">Minha agenda</SelectItem>
              {auth?.isMaster && <SelectItem value="all">Toda a unidade</SelectItem>}
              {auth?.isMaster && (consultores ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="dia">Dia</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* View */}
      {view === "semana" && <WeekGrid from={weekRange.from} eventos={eventos ?? []} />}
      {view === "dia" && <DayGrid day={anchor} eventos={eventos ?? []} />}
      {view === "mes" && <MonthGrid anchor={anchor} eventos={eventos ?? []} />}

      {/* Footer metrics */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="ABs da semana" value={counts.ab} dot={NATUREZA_COLOR.ab.dot} />
        <MetricCard label="Revisitas" value={counts.revisita} dot={NATUREZA_COLOR.revisita.dot} />
        <MetricCard label="Fechamentos" value={counts.fechamento} dot={NATUREZA_COLOR.fechamento.dot} />
        <MetricCard label="Entregas de Apólice" value={counts.entrega_apolice} dot={NATUREZA_COLOR.entrega_apolice.dot} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <Card className="p-4 bg-surface border-border">
      <div className="flex items-center gap-2">
        <span className={cn("inline-block w-2 h-2 rounded-full", dot)} />
        <p className="caps-tracking text-muted-foreground">{label}</p>
      </div>
      <p className="font-display text-3xl text-foreground mt-2">{value}</p>
    </Card>
  );
}

// ---------- Week Grid ----------
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7h - 20h
const SLOT_HEIGHT = 48; // px per hour

function WeekGrid({ from, eventos }: { from: Date; eventos: any[] }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <Card className="bg-surface border-border overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-border">
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className={cn("p-3 text-center border-l border-border", isSameDay(d, new Date()) && "bg-surface-elevated")}>
            <p className="caps-tracking text-muted-foreground">{format(d, "EEE", { locale: ptBR })}</p>
            <p className={cn("font-display text-xl mt-1", isSameDay(d, new Date()) ? "text-gold" : "text-foreground")}>{format(d, "dd")}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))]">
        {/* Hour col */}
        <div>
          {HOURS.map((h) => (
            <div key={h} className="border-b border-border text-right pr-2 text-xs text-muted-foreground" style={{ height: SLOT_HEIGHT }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((d) => (
          <DayColumn key={d.toISOString()} day={d} eventos={eventos.filter((e) => isSameDay(new Date(e.inicio), d))} />
        ))}
      </div>
    </Card>
  );
}

function DayColumn({ day, eventos }: { day: Date; eventos: any[] }) {
  return (
    <div className="relative border-l border-border" style={{ height: HOURS.length * SLOT_HEIGHT }}>
      {HOURS.map((h) => (
        <div key={h} className="border-b border-border" style={{ height: SLOT_HEIGHT }} />
      ))}
      {eventos.map((e) => <EventBlock key={e.id} e={e} day={day} />)}
    </div>
  );
}

function EventBlock({ e, day }: { e: any; day: Date }) {
  const start = new Date(e.inicio);
  const end = new Date(e.fim);
  const dayStart = new Date(day); dayStart.setHours(HOURS[0], 0, 0, 0);
  const offsetMin = differenceInMinutes(start, dayStart);
  const durMin = Math.max(30, differenceInMinutes(end, start));
  const top = (offsetMin / 60) * SLOT_HEIGHT;
  const height = (durMin / 60) * SLOT_HEIGHT;
  const c = NATUREZA_COLOR[e.tipo] ?? NATUREZA_COLOR.review;
  return (
    <div
      className={cn("absolute left-1 right-1 rounded-md border px-2 py-1 overflow-hidden", c.bg, c.border)}
      style={{ top, height }}
      title={`${e.titulo} — ${TIPO_LABEL[e.tipo] ?? e.tipo}`}
    >
      <p className={cn("text-xs font-medium truncate", c.text)}>{format(start, "HH:mm")} {e.titulo}</p>
      <p className="text-[10px] text-muted-foreground caps-tracking truncate">{TIPO_LABEL[e.tipo] ?? e.tipo}</p>
    </div>
  );
}

// ---------- Day Grid ----------
function DayGrid({ day, eventos }: { day: Date; eventos: any[] }) {
  return (
    <Card className="bg-surface border-border overflow-hidden">
      <div className="grid grid-cols-[60px_minmax(0,1fr)]">
        <div>
          {HOURS.map((h) => (
            <div key={h} className="border-b border-border text-right pr-2 text-xs text-muted-foreground" style={{ height: SLOT_HEIGHT }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <DayColumn day={day} eventos={eventos.filter((e) => isSameDay(new Date(e.inicio), day))} />
      </div>
    </Card>
  );
}

// ---------- Month Grid ----------
function MonthGrid({ anchor, eventos }: { anchor: Date; eventos: any[] }) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  return (
    <Card className="bg-surface border-border overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((d) => (
          <div key={d} className="p-2 text-center caps-tracking text-muted-foreground border-l border-border first:border-l-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const dayEvts = eventos.filter((e) => isSameDay(new Date(e.inicio), d));
          const inMonth = isSameMonth(d, anchor);
          const today = isSameDay(d, new Date());
          return (
            <div key={d.toISOString()} className={cn("min-h-[110px] p-1.5 border-l border-t border-border first:border-l-0", !inMonth && "opacity-40", today && "bg-surface-elevated")}>
              <p className={cn("text-xs font-medium mb-1", today ? "text-gold" : "text-muted-foreground")}>{format(d, "dd")}</p>
              <div className="space-y-1">
                {dayEvts.slice(0, 3).map((e) => {
                  const c = NATUREZA_COLOR[e.tipo] ?? NATUREZA_COLOR.review;
                  return (
                    <div key={e.id} className={cn("text-[10px] px-1.5 py-0.5 rounded border truncate", c.bg, c.border, c.text)}>
                      {format(new Date(e.inicio), "HH:mm")} {e.titulo}
                    </div>
                  );
                })}
                {dayEvts.length > 3 && <p className="text-[10px] text-muted-foreground">+{dayEvts.length - 3} mais</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- Novo evento ----------
function NovoEvento({ onClose }: { onClose: () => void }) {
  const { auth } = useAuth();
  const [f, setF] = useState({ titulo: "", tipo: "ab", inicio: "", fim: "", local: "" });

  async function save() {
    if (!auth) return;
    const { error } = await supabase.from("agenda_eventos").insert({
      consultor_id: auth.user.id, titulo: f.titulo, tipo: f.tipo as any,
      inicio: new Date(f.inicio).toISOString(), fim: new Date(f.fim || f.inicio).toISOString(), local: f.local,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Evento criado.");
    onClose();
  }

  return (
    <DialogContent className="bg-surface border-border">
      <DialogHeader><DialogTitle className="font-display text-2xl">Novo evento</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Título</Label><Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Natureza</Label>
          <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Início</Label><Input type="datetime-local" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Fim</Label><Input type="datetime-local" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Local</Label><Input value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save} className="gold-gradient text-background">Salvar</Button></DialogFooter>
    </DialogContent>
  );
}
