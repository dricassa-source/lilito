import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConsultorScope, applyScope } from "@/hooks/useConsultorScope";
import { ConsultorFilter } from "@/components/lilito/ConsultorFilter";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CalendarPlus, BellPlus, Ban, ChevronLeft, ChevronRight, Repeat, Flag, Bell } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

import { toast } from "sonner";
import {
  format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths, startOfDay, endOfDay,
  isSameDay, isSameMonth, differenceInMinutes,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCalendarZoom } from "@/hooks/useCalendarZoom";


export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({ meta: [{ title: "Calendário — LILITO" }] }),
  component: Calendario,
});

// Compromissos que contam métricas e bloqueiam agenda
const TIPOS_COMPROMISSO = [
  { v: "ab", l: "AB" },
  { v: "revisita", l: "Revisita" },
  { v: "fechamento", l: "Fechamento" },
  { v: "entrega_apolice", l: "Entrega de Apólice" },
] as const;

const TIPO_LABEL: Record<string, string> = {
  ab: "AB",
  revisita: "Revisita",
  fechamento: "Fechamento",
  entrega_apolice: "Entrega de Apólice",
  joint_work: "Joint Work",
  review: "Review",
  bloqueio: "Bloqueio",
  recorrente: "Recorrente",
};

const MOTIVOS_DELAY = [
  "Não Compareceu",
  "Vai Pensar",
  "Não Atendeu",
  "Sem Agenda",
  "Retornar Futuramente",
  "Outro",
] as const;

const NATUREZA_COLOR: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  ab:              { bg: "bg-nat-ab/15",         border: "border-nat-ab/60",         text: "text-nat-ab",         dot: "bg-nat-ab" },
  revisita:        { bg: "bg-nat-revisita/15",   border: "border-nat-revisita/60",   text: "text-nat-revisita",   dot: "bg-nat-revisita" },
  fechamento:      { bg: "bg-nat-fechamento/15", border: "border-nat-fechamento/60", text: "text-nat-fechamento", dot: "bg-nat-fechamento" },
  entrega_apolice: { bg: "bg-nat-entrega/15",    border: "border-nat-entrega/60",    text: "text-nat-entrega",    dot: "bg-nat-entrega" },
  joint_work:      { bg: "bg-gold/10",           border: "border-gold/40",           text: "text-gold",           dot: "bg-gold" },
  review:          { bg: "bg-muted",             border: "border-border",            text: "text-muted-foreground", dot: "bg-muted-foreground" },
  bloqueio:        { bg: "bg-muted/60",          border: "border-border",            text: "text-muted-foreground", dot: "bg-muted-foreground" },
  recorrente:      { bg: "bg-nat-vinca/15",      border: "border-nat-vinca/60 border-dashed", text: "text-nat-vinca",   dot: "bg-nat-vinca" },
};

type View = "dia" | "semana" | "mes";
type DialogKind = null | "agendamento" | "lembrete" | "bloqueio" | "recorrente";

function Calendario() {
  const { auth } = useAuth();
  const { scopeIds, meuId } = useConsultorScope();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [view, setView] = useState<View>("semana");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const isMobile = useIsMobile();
  const baseSlot = isMobile ? 22 : 48;
  const { slotHeight, containerRef } = useCalendarZoom(baseSlot);
  const scale = slotHeight / baseSlot;
  const [baseCol, setBaseCol] = useState<number>(48);
  useEffect(() => {
    if (!isMobile) { setBaseCol(0); return; }
    const compute = () => {
      const w = containerRef.current?.clientWidth ?? window.innerWidth;
      // 26px gutter + 7 day columns; leave 2px buffer
      setBaseCol(Math.max(40, Math.floor((w - 28) / 7)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [isMobile, containerRef]);
  // Width is decoupled from zoom: the 7 days always fit the viewport.
  // Pinch-to-zoom continues to scale slotHeight (vertical density).
  const colWidth = isMobile && baseCol > 0 ? baseCol : 0;

  // Default vertical scroll posiciona em 05:00 (faixa útil 05–21).
  // Horários fora da faixa continuam acessíveis por scroll vertical.
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    if (didInitialScrollRef.current) return;
    if (view !== "semana" && view !== "dia") return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = 5 * slotHeight;
    didInitialScrollRef.current = true;
  }, [view, slotHeight, containerRef]);

  const range = useMemo(() => {
    if (view === "dia") return { from: startOfDay(anchor), to: endOfDay(anchor) };
    if (view === "semana") return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: endOfWeek(anchor, { weekStartsOn: 1 }) };
    return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  }, [view, anchor]);

  const { data: eventos } = useQuery({
    queryKey: ["agenda", range.from.toISOString(), range.to.toISOString(), scopeIds.join(",")],
    enabled: !!auth && scopeIds.length > 0,
    queryFn: async () => {
      const q = applyScope(
        supabase.from("agenda_eventos")
          .select("*,prospects(id,nome,etapa_funil,score),clientes(id,nome),joint:joint_consultor_id(id,nome)")
          .gte("inicio", range.from.toISOString())
          .lte("inicio", range.to.toISOString()),
        scopeIds,
      ).order("inicio");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recorrentes } = useQuery({
    queryKey: ["recorrentes", scopeIds.join(",")],
    enabled: !!auth,
    queryFn: async () => {
      const { data } = await supabase.from("compromissos_recorrentes").select("*").eq("ativo", true);
      if (!data) return [];
      // Se filtro selecionou um consultor único, mostra apenas recorrentes que o incluem.
      if (scopeIds.length === 1) {
        const uid = scopeIds[0];
        return data.filter((r: any) => (r.participantes ?? []).includes(uid) || r.criado_por === uid);
      }
      return data;
    },
  });

  const { data: lembretes } = useQuery({
    queryKey: ["lembretes-cal", range.from.toISOString(), range.to.toISOString(), scopeIds.join(",")],
    enabled: !!auth && scopeIds.length > 0,
    queryFn: async () => {
      const q = applyScope(
        supabase.from("lembretes")
          .select("*,prospects(id,nome)")
          .gte("data", format(range.from, "yyyy-MM-dd"))
          .lte("data", format(range.to, "yyyy-MM-dd")),
        scopeIds,
      ).order("data");
      const { data } = await q;
      return data ?? [];
    },
  });

  const weekRange = useMemo(() => ({
    from: startOfWeek(anchor, { weekStartsOn: 1 }),
    to: endOfWeek(anchor, { weekStartsOn: 1 }),
  }), [anchor]);

  const { data: semanaEventos } = useQuery({
    queryKey: ["agenda-semana", weekRange.from.toISOString(), scopeIds.join(",")],
    enabled: !!auth && scopeIds.length > 0,
    queryFn: async () => {
      const q = applyScope(
        supabase.from("agenda_eventos").select("tipo")
          .gte("inicio", weekRange.from.toISOString())
          .lte("inicio", weekRange.to.toISOString()),
        scopeIds,
      );
      const { data } = await q;
      return data ?? [];
    },
  });
  void meuId;


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

  const eventosComRecorrentes = useMemo(() => {
    const base = eventos ?? [];
    const inst = expandirRecorrentes(recorrentes ?? [], range.from, range.to);
    return [...base, ...inst];
  }, [eventos, recorrentes, range.from, range.to]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["agenda"] });
    qc.invalidateQueries({ queryKey: ["agenda-semana"] });
    qc.invalidateQueries({ queryKey: ["lembretes-cal"] });
    qc.invalidateQueries({ queryKey: ["lembretes"] });
    qc.invalidateQueries({ queryKey: ["recorrentes"] });
    qc.invalidateQueries({ queryKey: ["em-delay"] });
    qc.invalidateQueries({ queryKey: ["em-delay-count"] });
    qc.invalidateQueries({ queryKey: ["funil"] });
    qc.invalidateQueries({ queryKey: ["notificacoes-bell"] });
    qc.invalidateQueries({ queryKey: ["meu-dia"] });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h1 className="font-display text-2xl text-foreground">Calendário</h1>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => setDialog("agendamento")} className="gold-gradient text-background h-8 px-3">
            <CalendarPlus className="h-3.5 w-3.5 mr-1" />Agendar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog("lembrete")} className="h-8 px-3">
            <BellPlus className="h-3.5 w-3.5 mr-1" />Lembrete
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog("bloqueio")} className="h-8 px-3">
            <Ban className="h-3.5 w-3.5 mr-1" />Bloquear
          </Button>
          {auth?.isMaster && (
            <Button size="sm" variant="outline" onClick={() => setDialog("recorrente")} className="h-8 px-3 border-gold/40">
              <Repeat className="h-3.5 w-3.5 mr-1" />Recorrente
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setAnchor(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          <p className="caps-tracking text-gold ml-2 hidden sm:block">{periodoLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <ConsultorFilter className="flex items-center gap-2" />
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList className="h-8">
              <TabsTrigger value="dia" className="h-6 text-xs">Dia</TabsTrigger>
              <TabsTrigger value="semana" className="h-6 text-xs">Semana</TabsTrigger>
              <TabsTrigger value="mes" className="h-6 text-xs">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <p className="caps-tracking text-gold mb-2 sm:hidden">{periodoLabel}</p>

      <div ref={containerRef} className="overflow-auto max-h-[calc(100vh-200px)]" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}>
        {view === "semana" && <WeekGrid from={weekRange.from} eventos={eventosComRecorrentes} lembretes={lembretes ?? []} onSelect={setSelectedEvent} slotHeight={slotHeight} colWidth={colWidth} />}
        {view === "dia" && <DayGrid day={anchor} eventos={eventosComRecorrentes} lembretes={lembretes ?? []} onSelect={setSelectedEvent} slotHeight={slotHeight} />}
        {view === "mes" && <MonthGrid anchor={anchor} eventos={eventosComRecorrentes} lembretes={lembretes ?? []} onSelect={setSelectedEvent} />}
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="ABs da semana" value={counts.ab} dot={NATUREZA_COLOR.ab.dot} />
        <MetricCard label="Revisitas" value={counts.revisita} dot={NATUREZA_COLOR.revisita.dot} />
        <MetricCard label="Fechamentos" value={counts.fechamento} dot={NATUREZA_COLOR.fechamento.dot} />
        <MetricCard label="Entregas de Apólice" value={counts.entrega_apolice} dot={NATUREZA_COLOR.entrega_apolice.dot} />
      </div>

      {dialog === "agendamento" && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <NovoAgendamento onClose={() => { setDialog(null); invalidateAll(); }} />
        </Dialog>
      )}
      {dialog === "lembrete" && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <NovoLembrete onClose={() => { setDialog(null); invalidateAll(); }} />
        </Dialog>
      )}
      {dialog === "bloqueio" && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <NovoBloqueio onClose={() => { setDialog(null); invalidateAll(); }} />
        </Dialog>
      )}
      {dialog === "recorrente" && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <NovoRecorrente onClose={() => { setDialog(null); invalidateAll(); }} />
        </Dialog>
      )}

      <EventoSheet
        evento={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onChanged={() => { setSelectedEvent(null); invalidateAll(); }}
      />
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

// ---------- Grids ----------
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function WeekGrid({ from, eventos, lembretes, onSelect, slotHeight, colWidth }: { from: Date; eventos: any[]; lembretes: any[]; onSelect: (e: any) => void; slotHeight: number; colWidth: number }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const useFixed = colWidth > 0;
  const gutter = useFixed ? 26 : 0;
  const gridStyle = useFixed
    ? { gridTemplateColumns: `${gutter}px repeat(7, ${colWidth}px)`, width: gutter + 7 * colWidth }
    : undefined;
  const gridClass = useFixed
    ? "grid border-b border-border"
    : "grid grid-cols-[26px_repeat(7,minmax(86px,1fr))] sm:grid-cols-[44px_repeat(7,minmax(0,1fr))] border-b border-border";
  const bodyClass = useFixed
    ? "grid"
    : "grid grid-cols-[26px_repeat(7,minmax(86px,1fr))] sm:grid-cols-[44px_repeat(7,minmax(0,1fr))]";
  return (
    <Card className="bg-surface border-border overflow-hidden">
      <div className={useFixed ? "" : "min-w-[640px] sm:min-w-0"} style={useFixed ? { width: gutter + 7 * colWidth } : undefined}>
      <div className={gridClass} style={gridStyle}>
        <div />
        {days.map((d) => {
          const today = isSameDay(d, new Date());
          const letra = format(d, "EEEEE", { locale: ptBR }).toUpperCase();
          return (
            <div key={d.toISOString()} className={cn("py-1 px-0 text-center border-l border-border", today && "bg-surface-elevated")}>
              <p className="font-sans text-[9px] sm:text-[10px] text-muted-foreground leading-none uppercase">
                <span className="sm:hidden">{letra}</span>
                <span className="hidden sm:inline">{format(d, "EEE", { locale: ptBR })}</span>
              </p>
              <p className={cn("font-sans text-[13px] sm:text-base font-semibold mt-0.5 leading-none", today ? "text-gold" : "text-foreground")}>{format(d, "dd")}</p>
              <DayLembretes lembretes={lembretes.filter((l) => isSameDay(new Date(l.data + "T00:00"), d))} />
            </div>
          );
        })}
      </div>
      <div className={bodyClass} style={gridStyle}>
        <div>
          {HOURS.map((h) => (
            <div key={h} className="border-b border-border text-right pr-0.5 sm:pr-1 text-[9px] sm:text-[10px] text-muted-foreground leading-none pt-0.5" style={{ height: slotHeight }}>
              {String(h).padStart(2, "0")}
            </div>
          ))}
        </div>
        {days.map((d) => (
          <DayColumn key={d.toISOString()} day={d} eventos={eventos.filter((e) => isSameDay(new Date(e.inicio), d))} onSelect={onSelect} slotHeight={slotHeight} />
        ))}
      </div>
      </div>
    </Card>
  );
}


function DayColumn({ day, eventos, onSelect, slotHeight }: { day: Date; eventos: any[]; onSelect: (e: any) => void; slotHeight: number }) {
  return (
    <div className="relative border-l border-border" style={{ height: HOURS.length * slotHeight }}>
      {HOURS.map((h) => (
        <div key={h} className="border-b border-border" style={{ height: slotHeight }} />
      ))}
      {eventos.map((e) => <EventBlock key={e.id} e={e} day={day} onSelect={onSelect} slotHeight={slotHeight} />)}
    </div>
  );
}

function abreviarLocal(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const low = s.toLowerCase();
  if (/online|zoom|meet|teams|google\s*meet|hangout/.test(low)) return "💻 Online";
  if (/vinca|escritório|escritorio|sede/.test(low)) return "🏢 VINCA";
  if (/hsi/.test(low)) return "📍 HSI";
  if (/(^|\s)hp(\s|$)|hospital portugu/.test(low)) return "📍 HP";
  if (/aliança|alianca/.test(low)) return "📍 Aliança";
  // fallback: 1ª palavra significativa, máx 14 chars
  const first = s.split(/[,\-–|]/)[0]?.trim() ?? s;
  return "📍 " + (first.length > 14 ? first.slice(0, 14) + "…" : first);
}

function EventBlock({ e, day, onSelect, slotHeight }: { e: any; day: Date; onSelect: (e: any) => void; slotHeight: number }) {
  const start = new Date(e.inicio);
  const end = new Date(e.fim);
  const dayStart = new Date(day); dayStart.setHours(HOURS[0], 0, 0, 0);
  const offsetMin = differenceInMinutes(start, dayStart);
  const durMin = Math.max(30, differenceInMinutes(end, start));
  const top = (offsetMin / 60) * slotHeight;
  const height = (durMin / 60) * slotHeight;
  const c = NATUREZA_COLOR[e.tipo] ?? NATUREZA_COLOR.review;
  const nomeCompleto = e.prospects?.nome ?? e.clientes?.nome ?? e.titulo ?? "Evento";
  const hasDelay = !!e.delay_em;
  const delayAtivo = hasDelay && !e.delay_resolvido;
  const isRecorrente = e.__recorrente === true;
  const horario = `${format(start, "HH:mm")}–${format(end, "HH:mm")}`;
  const localAbr = abreviarLocal(e.local);
  const showHorario = height >= 30;
  const showLocal = !!localAbr && height >= 54;
  return (
    <button
      type="button"
      onClick={() => !isRecorrente && onSelect(e)}
      className={cn(
        "absolute inset-x-0 rounded-[3px] border px-1 py-0.5 overflow-hidden text-left transition hover:ring-1 hover:ring-gold/40 cursor-pointer font-sans",
        c.bg, c.border,
        delayAtivo && "border-destructive",
        isRecorrente && "cursor-default",
      )}
      style={{ top, height }}
      title={`${nomeCompleto} — ${TIPO_LABEL[e.tipo] ?? e.tipo} · ${horario}${e.local ? ` · ${e.local}` : ""}${e.delay_motivo ? ` (Delay: ${e.delay_motivo})` : ""}`}
    >
      {delayAtivo && (
        <span className="absolute top-0 left-0.5 z-10 text-[9px] leading-none select-none" aria-label="Delay">🚩</span>
      )}
      <p className={cn("text-[11px] sm:text-[13px] font-medium leading-tight whitespace-normal [overflow-wrap:normal] [word-break:normal] line-clamp-2", c.text, delayAtivo && "pl-2.5")}>
        {nomeCompleto}
      </p>
      {showHorario && (
        <p className={cn("text-[10px] sm:text-[11px] leading-tight opacity-80 tabular-nums", c.text)}>
          {horario}
        </p>
      )}
      {showLocal && (
        <p className={cn("text-[10px] sm:text-[11px] leading-tight opacity-75 truncate", c.text)}>
          {localAbr}
        </p>
      )}
    </button>
  );
}

function DayLembretes({ lembretes }: { lembretes: any[] }) {
  if (!lembretes.length) return null;
  return (
    <div className="mt-1.5 space-y-0.5">
      {lembretes.slice(0, 2).map((l) => (
        <div key={l.id} className="text-[10px] text-gold/80 truncate inline-flex items-center gap-1" title={l.titulo}>
          <Bell className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{l.hora ? l.hora.slice(0, 5) + " " : ""}{l.titulo}</span>
        </div>
      ))}
      {lembretes.length > 2 && <div className="text-[10px] text-muted-foreground">+{lembretes.length - 2}</div>}
    </div>
  );
}

function DayGrid({ day, eventos, lembretes, onSelect, slotHeight }: { day: Date; eventos: any[]; lembretes: any[]; onSelect: (e: any) => void; slotHeight: number }) {
  const dayLembretes = lembretes.filter((l) => isSameDay(new Date(l.data + "T00:00"), day));
  return (
    <Card className="bg-surface border-border overflow-hidden">
      {dayLembretes.length > 0 && (
        <div className="border-b border-border bg-surface-elevated px-3 py-2">
          <p className="caps-tracking text-muted-foreground mb-1">Lembretes</p>
          <div className="flex flex-wrap gap-2">
            {dayLembretes.map((l) => (
              <span key={l.id} className="text-xs text-gold/90 border border-gold/30 rounded px-2 py-0.5">
                {l.hora ? l.hora.slice(0, 5) + " " : ""}{l.titulo}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-[36px_minmax(0,1fr)] sm:grid-cols-[60px_minmax(0,1fr)]">
        <div>
          {HOURS.map((h) => (
            <div key={h} className="border-b border-border text-right pr-1 sm:pr-2 text-[10px] sm:text-xs text-muted-foreground" style={{ height: slotHeight }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <DayColumn day={day} eventos={eventos.filter((e) => isSameDay(new Date(e.inicio), day))} onSelect={onSelect} slotHeight={slotHeight} />
      </div>

    </Card>
  );
}

function MonthGrid({ anchor, eventos, lembretes, onSelect }: { anchor: Date; eventos: any[]; lembretes: any[]; onSelect: (e: any) => void }) {
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
          const dayLemb = lembretes.filter((l) => isSameDay(new Date(l.data + "T00:00"), d));
          const inMonth = isSameMonth(d, anchor);
          const today = isSameDay(d, new Date());
          return (
            <div key={d.toISOString()} className={cn("min-h-[110px] p-1.5 border-l border-t border-border first:border-l-0", !inMonth && "opacity-40", today && "bg-surface-elevated")}>
              <p className={cn("text-xs font-medium mb-1", today ? "text-gold" : "text-muted-foreground")}>{format(d, "dd")}</p>
              <div className="space-y-1">
                {dayEvts.slice(0, 3).map((e) => {
                  const c = NATUREZA_COLOR[e.tipo] ?? NATUREZA_COLOR.review;
                  const nomeCompleto = e.prospects?.nome ?? e.clientes?.nome ?? e.titulo ?? "Evento";
                  const delayAtivo = !!e.delay_em && !e.delay_resolvido;
                  return (
                    <button
                      key={e.id} type="button" onClick={() => onSelect(e)}
                      className={cn("w-full text-left text-[11px] font-sans px-1 py-0.5 rounded border truncate hover:ring-1 hover:ring-gold/40", c.bg, c.border, c.text, delayAtivo && "border-destructive")}
                      title={nomeCompleto}
                    >
                      {delayAtivo && <span className="mr-0.5">🚩</span>}
                      {nomeCompleto}
                    </button>
                  );
                })}
                {dayEvts.length > 3 && <p className="text-[10px] text-muted-foreground">+{dayEvts.length - 3} mais</p>}
                {dayLemb.slice(0, 2).map((l) => (
                  <p key={l.id} className="text-[10px] text-gold/80 truncate" title={l.titulo}>• {l.titulo}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- Conflict helper ----------
async function temConflito(consultorId: string, inicioISO: string, fimISO: string, excludeId?: string) {
  let q = supabase.from("agenda_eventos").select("id,inicio,fim")
    .eq("consultor_id", consultorId)
    .lt("inicio", fimISO)
    .gt("fim", inicioISO);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return (data ?? []).length > 0;
}

// ---------- Expand recorrentes para instâncias no range visível ----------
function expandirRecorrentes(recs: any[], from: Date, to: Date): any[] {
  const out: any[] = [];
  for (const r of recs) {
    const inicial = new Date(r.data_inicial + "T00:00:00");
    const step = r.frequencia === "mensal" ? 28 : r.frequencia === "quinzenal" ? 14 : 7;
    let cursor = new Date(inicial);
    // avança até a janela
    while (cursor < from) cursor = new Date(cursor.getTime() + step * 86_400_000);
    while (cursor <= to) {
      const [h1, m1] = String(r.hora_inicio).split(":").map(Number);
      const [h2, m2] = String(r.hora_fim).split(":").map(Number);
      const ini = new Date(cursor); ini.setHours(h1, m1 || 0, 0, 0);
      const fim = new Date(cursor); fim.setHours(h2, m2 || 0, 0, 0);
      out.push({
        id: `rec-${r.id}-${ini.toISOString()}`,
        __recorrente: true,
        recorrencia_id: r.id,
        tipo: "recorrente",
        titulo: r.titulo,
        inicio: ini.toISOString(),
        fim: fim.toISOString(),
        prospects: null,
        clientes: null,
      });
      cursor = new Date(cursor.getTime() + step * 86_400_000);
    }
  }
  return out;
}

// ---------- Novo Compromisso Recorrente ----------
function NovoRecorrente({ onClose }: { onClose: () => void }) {
  const { auth } = useAuth();
  const [f, setF] = useState({
    titulo: "",
    tipo: "reuniao_unidade",
    data_inicial: "",
    hora_inicio: "08:00",
    hora_fim: "09:00",
    frequencia: "semanal",
    participantes: [] as string[],
  });
  const { data: consultores } = useQuery({
    queryKey: ["consultores-ativos"], enabled: !!auth,
    queryFn: async () => (await supabase.from("profiles").select("id,nome").eq("ativo", true).order("nome")).data ?? [],
  });

  function toggleParticipante(id: string) {
    setF((prev) => ({
      ...prev,
      participantes: prev.participantes.includes(id)
        ? prev.participantes.filter((p) => p !== id)
        : [...prev.participantes, id],
    }));
  }

  async function save() {
    if (!auth) return;
    if (!f.titulo || !f.data_inicial) { toast.error("Título e data inicial são obrigatórios."); return; }
    const { error } = await supabase.from("compromissos_recorrentes").insert({
      titulo: f.titulo,
      tipo: f.tipo,
      data_inicial: f.data_inicial,
      hora_inicio: f.hora_inicio,
      hora_fim: f.hora_fim,
      frequencia: f.frequencia,
      participantes: f.participantes,
      criado_por: auth.user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Compromisso recorrente criado.");
    onClose();
  }

  return (
    <DialogContent className="bg-surface border-border max-w-lg">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl flex items-center gap-2"><Repeat className="h-5 w-5 text-gold" />Compromisso Recorrente</DialogTitle>
        <p className="text-xs text-muted-foreground">Aparece automaticamente nos calendários dos participantes.</p>
      </DialogHeader>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div className="space-y-1.5"><Label>Título</Label>
          <Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Reunião Vinca" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Tipo</Label>
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reuniao_unidade">Reunião Unidade</SelectItem>
                <SelectItem value="treinamento">Treinamento</SelectItem>
                <SelectItem value="rote">Rote</SelectItem>
                <SelectItem value="ab_fone">AB Fone</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Frequência</Label>
            <Select value={f.frequencia} onValueChange={(v) => setF({ ...f, frequencia: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="quinzenal">Quinzenal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Data inicial</Label><Input type="date" value={f.data_inicial} onChange={(e) => setF({ ...f, data_inicial: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Hora início</Label><Input type="time" value={f.hora_inicio} onChange={(e) => setF({ ...f, hora_inicio: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Hora fim</Label><Input type="time" value={f.hora_fim} onChange={(e) => setF({ ...f, hora_fim: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5">
          <Label>Participantes</Label>
          <div className="border border-border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
            {(consultores ?? []).map((c: any) => (
              <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-surface-elevated rounded px-2 py-1">
                <Checkbox checked={f.participantes.includes(c.id)} onCheckedChange={() => toggleParticipante(c.id)} />
                {c.nome}
              </label>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter><Button onClick={save} className="gold-gradient text-background">Criar Recorrente</Button></DialogFooter>
    </DialogContent>
  );
}

function NovoAgendamento({ onClose, defaults }: { onClose: () => void; defaults?: Partial<any> }) {
  const { auth } = useAuth();
  const [f, setF] = useState({
    tipo: defaults?.tipo ?? "ab",
    prospect_id: defaults?.prospect_id ?? "",
    consultor_id: defaults?.consultor_id ?? auth?.user.id ?? "",
    inicio: defaults?.inicio ?? "",
    fim: defaults?.fim ?? "",
    local: "",
    observacao: "",
    is_joint: false,
    joint_consultor_id: "",
  });

  const { data: prospects } = useQuery({
    queryKey: ["prospects-min-all"], enabled: !!auth,
    queryFn: async () => (await supabase.from("prospects").select("id,nome").order("nome")).data ?? [],
  });
  const { data: consultores } = useQuery({
    queryKey: ["consultores-all"], enabled: !!auth,
    queryFn: async () => (await supabase.from("profiles").select("id,nome").eq("ativo", true).order("nome")).data ?? [],
  });

  async function save() {
    if (!auth) return;
    if (!f.inicio || !f.fim) { toast.error("Informe início e fim."); return; }
    if (!f.prospect_id) { toast.error("Selecione o prospect."); return; }
    const inicio = new Date(f.inicio).toISOString();
    const fim = new Date(f.fim).toISOString();
    if (new Date(fim) <= new Date(inicio)) { toast.error("Fim deve ser após o início."); return; }
    const consultorId = f.consultor_id || auth.user.id;
    if (await temConflito(consultorId, inicio, fim)) {
      toast.error("Conflito de agenda: já existe compromisso ou bloqueio neste horário.");
      return;
    }
    const nome = (prospects ?? []).find((p: any) => p.id === f.prospect_id)?.nome ?? "Compromisso";
    const { error } = await supabase.from("agenda_eventos").insert({
      consultor_id: consultorId,
      prospect_id: f.prospect_id,
      tipo: f.tipo as any,
      titulo: `${TIPO_LABEL[f.tipo]} — ${nome}${f.is_joint && f.joint_consultor_id ? " (Joint)" : ""}`,
      inicio, fim,
      local: f.local || null,
      observacao: f.observacao || null,
      joint_consultor_id: f.is_joint && f.joint_consultor_id ? f.joint_consultor_id : null,
      joint_status: f.is_joint && f.joint_consultor_id ? "pendente" as any : "nenhum" as any,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Agendamento criado.");
    onClose();
  }

  return (
    <DialogContent className="bg-surface border-border max-w-lg">
      <DialogHeader><DialogTitle className="font-display text-2xl">Novo Agendamento</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Tipo de compromisso</Label>
          <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS_COMPROMISSO.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Prospect vinculado</Label>
          <Select value={f.prospect_id} onValueChange={(v) => setF({ ...f, prospect_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {(prospects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {auth?.isMaster && (
          <div className="space-y-1.5"><Label>Consultor responsável</Label>
            <Select value={f.consultor_id} onValueChange={(v) => setF({ ...f, consultor_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(consultores ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Início</Label><Input type="datetime-local" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Fim</Label><Input type="datetime-local" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Local</Label><Input value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></div>
        <div className="border border-border rounded-md p-3 space-y-2 bg-surface-elevated">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={f.is_joint} onCheckedChange={(v) => setF({ ...f, is_joint: !!v, joint_consultor_id: v ? f.joint_consultor_id : "" })} />
            <span className="font-medium">É Joint Work?</span>
          </label>
          {f.is_joint && (
            <div className="space-y-1.5"><Label>Consultor convidado</Label>
              <Select value={f.joint_consultor_id} onValueChange={(v) => setF({ ...f, joint_consultor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{(consultores ?? []).filter((c: any) => c.id !== (f.consultor_id || auth?.user.id)).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
      <DialogFooter><Button onClick={save} className="gold-gradient text-background">Salvar</Button></DialogFooter>
    </DialogContent>
  );
}

// ---------- Novo Lembrete ----------
function NovoLembrete({ onClose }: { onClose: () => void }) {
  const { auth } = useAuth();
  const [f, setF] = useState({ titulo: "", data: "", hora: "", observacao: "", prospect_id: "" });
  const { data: prospects } = useQuery({
    queryKey: ["prospects-min-all"], enabled: !!auth,
    queryFn: async () => (await supabase.from("prospects").select("id,nome").order("nome")).data ?? [],
  });

  async function save() {
    if (!auth) return;
    if (!f.titulo || !f.data) { toast.error("Título e data são obrigatórios."); return; }
    const { error } = await supabase.from("lembretes").insert({
      consultor_id: auth.user.id,
      titulo: f.titulo,
      data: f.data,
      hora: f.hora || null,
      observacao: f.observacao || null,
      prospect_id: f.prospect_id || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Lembrete criado.");
    onClose();
  }

  return (
    <DialogContent className="bg-surface border-border max-w-md">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Novo Lembrete</DialogTitle>
        <p className="text-xs text-muted-foreground">Lembretes não ocupam horário nem entram em métricas.</p>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Título</Label><Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Hora</Label><Input type="time" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Prospect vinculado (opcional)</Label>
          <Select value={f.prospect_id || "_none"} onValueChange={(v) => setF({ ...f, prospect_id: v === "_none" ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="_none">— Nenhum —</SelectItem>
              {(prospects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save} className="gold-gradient text-background">Salvar</Button></DialogFooter>
    </DialogContent>
  );
}

// ---------- Bloquear Horário ----------
function NovoBloqueio({ onClose }: { onClose: () => void }) {
  const { auth } = useAuth();
  const [f, setF] = useState({ motivo: "", inicio: "", fim: "" });

  async function save() {
    if (!auth) return;
    if (!f.motivo || !f.inicio || !f.fim) { toast.error("Preencha motivo, início e fim."); return; }
    const inicio = new Date(f.inicio).toISOString();
    const fim = new Date(f.fim).toISOString();
    if (new Date(fim) <= new Date(inicio)) { toast.error("Fim deve ser após o início."); return; }
    if (await temConflito(auth.user.id, inicio, fim)) {
      toast.error("Conflito: já existe compromisso ou bloqueio neste horário.");
      return;
    }
    const { error } = await supabase.from("agenda_eventos").insert({
      consultor_id: auth.user.id,
      tipo: "bloqueio" as any,
      titulo: f.motivo,
      inicio, fim,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Horário bloqueado.");
    onClose();
  }

  return (
    <DialogContent className="bg-surface border-border max-w-md">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Bloquear Horário</DialogTitle>
        <p className="text-xs text-muted-foreground">Bloqueios não entram em métricas e impedem novos agendamentos no período.</p>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Motivo</Label><Input value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder="Ex.: Reunião interna" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Início</Label><Input type="datetime-local" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Fim</Label><Input type="datetime-local" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></div>
        </div>
      </div>
      <DialogFooter><Button onClick={save} className="gold-gradient text-background">Salvar</Button></DialogFooter>
    </DialogContent>
  );
}

// ---------- Sheet com detalhes + resultados ----------
type ResultMode = null | "agendar_fechamento" | "agendar_revisita" | "proposta_fechada" | "delay";

function EventoSheet({ evento, onClose, onChanged }: { evento: any | null; onClose: () => void; onChanged: () => void }) {
  const [mode, setMode] = useState<ResultMode>(null);
  const open = !!evento;

  if (!evento) return null;
  const c = NATUREZA_COLOR[evento.tipo] ?? NATUREZA_COLOR.review;
  const isBloqueio = evento.tipo === "bloqueio";
  const nome = evento.prospects?.nome ?? evento.clientes?.nome ?? evento.titulo;
  const inicio = new Date(evento.inicio);
  const fim = new Date(evento.fim);

  async function excluir() {
    // Limpa follow-ups e lembretes vinculados ao prospect deste evento para evitar registros órfãos.
    if (evento.prospect_id) {
      const ini = new Date(evento.inicio);
      const fim = new Date(evento.fim);
      // Janela: 1h antes do início até 24h depois do fim — cobre follow-ups gerados por este evento.
      const winStart = new Date(ini.getTime() - 60 * 60 * 1000).toISOString();
      const winEnd = new Date(fim.getTime() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("atividades")
        .delete()
        .eq("prospect_id", evento.prospect_id)
        .not("follow_up_em", "is", null)
        .gte("follow_up_em", winStart)
        .lte("follow_up_em", winEnd);
      const dataStr = format(ini, "yyyy-MM-dd");
      await supabase.from("lembretes")
        .delete()
        .eq("prospect_id", evento.prospect_id)
        .eq("data", dataStr)
        .eq("concluido", false);
    }
    const { error } = await supabase.from("agenda_eventos").delete().eq("id", evento.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido. Follow-ups e lembretes vinculados também foram limpos.");
    onChanged();
  }

  return (
    <>
      <Sheet open={open && !mode} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="bg-surface border-border w-full sm:max-w-md">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <span className={cn("inline-block w-2 h-2 rounded-full", c.dot)} />
              <span className="caps-tracking text-muted-foreground">{TIPO_LABEL[evento.tipo] ?? evento.tipo}</span>
            </div>
            <SheetTitle className="font-display text-2xl">{nome}</SheetTitle>
            <SheetDescription>
              {format(inicio, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })} · {format(inicio, "HH:mm")}–{format(fim, "HH:mm")}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-2 text-sm">
            {evento.local && <p><span className="caps-tracking text-muted-foreground">Local: </span>{evento.local}</p>}
            {evento.observacao && <p><span className="caps-tracking text-muted-foreground">Observações: </span>{evento.observacao}</p>}
            {evento.resultado && (
              <p><span className="caps-tracking text-muted-foreground">Resultado registrado: </span>
                <span className="text-gold">{evento.resultado}</span>
              </p>
            )}
            {evento.status && (
              <p><span className="caps-tracking text-muted-foreground">Status: </span>{evento.status}</p>
            )}
            {evento.delay_motivo && (
              <p className="text-destructive"><span className="caps-tracking">Delay: </span>{evento.delay_motivo}{evento.delay_resolvido ? " (resolvido)" : ""}</p>
            )}
            {evento.joint?.nome && (
              <p><span className="caps-tracking text-muted-foreground">Joint Work: </span>{evento.joint.nome}</p>
            )}
          </div>

          {!isBloqueio && !evento.resultado && (
            <>
              <Separator className="my-4" />
              <p className="caps-tracking text-gold mb-2">Registrar resultado</p>
              {evento.tipo === "ab" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setMode("agendar_fechamento")}>Agendar Fechamento</Button>
                  <Button variant="outline" onClick={() => setMode("agendar_revisita")}>Agendar Revisita</Button>
                  <Button variant="outline" className="col-span-2 border-destructive/40 text-destructive hover:text-destructive" onClick={() => setMode("delay")}><Flag className="h-3 w-3 mr-1" />Marcar Delay</Button>
                  <Button variant="outline" className="col-span-2" onClick={() => marcarSemInteresse(evento).then(onChanged)}>Sem Interesse</Button>
                </div>
              )}
              {evento.tipo === "fechamento" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button className="gold-gradient text-background col-span-2" onClick={() => setMode("proposta_fechada")}>Proposta Fechada</Button>
                  <Button variant="outline" onClick={() => marcarF2(evento).then(onChanged)}>F2 (Vai Pensar)</Button>
                  <Button variant="outline" onClick={() => setMode("agendar_revisita")}>Agendar Revisita</Button>
                  <Button variant="outline" className="col-span-2 border-destructive/40 text-destructive hover:text-destructive" onClick={() => setMode("delay")}><Flag className="h-3 w-3 mr-1" />Marcar Delay</Button>
                </div>
              )}
              {evento.tipo === "entrega_apolice" && (
                <div className="grid grid-cols-1 gap-2">
                  <Button className="gold-gradient text-background" onClick={() => marcarEntregue(evento).then(onChanged)}>Entregue</Button>
                  <Button variant="outline" onClick={() => setMode("agendar_revisita")}>Reagendar</Button>
                  <Button variant="outline" className="border-destructive/40 text-destructive hover:text-destructive" onClick={() => setMode("delay")}><Flag className="h-3 w-3 mr-1" />Marcar Delay</Button>
                </div>
              )}
              {(evento.tipo === "revisita" || evento.tipo === "joint_work") && (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => marcarResultado(evento, "realizado", { status: "realizado" }).then(onChanged)}>Realizado</Button>
                  <Button variant="outline" onClick={() => setMode("agendar_fechamento")}>Agendar Fechamento</Button>
                  <Button variant="outline" className="col-span-2 border-destructive/40 text-destructive hover:text-destructive" onClick={() => setMode("delay")}><Flag className="h-3 w-3 mr-1" />Marcar Delay</Button>
                </div>
              )}
            </>
          )}

          <SheetFooter className="mt-6">
            <Button variant="ghost" onClick={excluir} className="text-destructive">Excluir</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {mode === "agendar_fechamento" && (
        <Dialog open onOpenChange={(o) => !o && setMode(null)}>
          <NovoAgendamento
            defaults={{ tipo: "fechamento", prospect_id: evento.prospect_id, consultor_id: evento.consultor_id }}
            onClose={async () => {
              await marcarResultado(evento, "agendou_fechamento", { status: "realizado" });
              if (evento.prospect_id) {
                await supabase.from("prospects").update({
                  etapa_funil: "fechamento" as any,
                  entrou_etapa_em: new Date().toISOString(),
                  ultima_interacao: new Date().toISOString(),
                }).eq("id", evento.prospect_id);
              }
              setMode(null); onChanged();
            }}
          />
        </Dialog>
      )}
      {mode === "agendar_revisita" && (
        <Dialog open onOpenChange={(o) => !o && setMode(null)}>
          <NovoAgendamento
            defaults={{ tipo: "revisita", prospect_id: evento.prospect_id, consultor_id: evento.consultor_id }}
            onClose={async () => {
              await marcarResultado(evento, "agendou_revisita", { status: "realizado" });
              if (evento.prospect_id) {
                await supabase.from("prospects").update({
                  etapa_funil: "revisita" as any,
                  entrou_etapa_em: new Date().toISOString(),
                  ultima_interacao: new Date().toISOString(),
                }).eq("id", evento.prospect_id);
              }
              setMode(null); onChanged();
            }}
          />
        </Dialog>
      )}
      {mode === "delay" && (
        <Dialog open onOpenChange={(o) => !o && setMode(null)}>
          <DelayForm evento={evento} onClose={() => { setMode(null); onChanged(); }} />
        </Dialog>
      )}
      {mode === "proposta_fechada" && (
        <Dialog open onOpenChange={(o) => !o && setMode(null)}>
          <PropostaFechadaForm evento={evento} onClose={() => { setMode(null); onChanged(); }} />
        </Dialog>
      )}
    </>
  );
}

async function marcarResultado(evento: any, resultado: string, patch: Record<string, any> = {}) {
  const { error } = await supabase.from("agenda_eventos")
    .update({ resultado, ...patch }).eq("id", evento.id);
  if (error) { toast.error(error.message); return; }
  if (evento.prospect_id) {
    await supabase.from("prospects").update({ ultima_interacao: new Date().toISOString() }).eq("id", evento.prospect_id);
  }
  toast.success("Resultado registrado.");
}

async function marcarSemInteresse(evento: any) {
  await marcarResultado(evento, "sem_interesse", { status: "cancelado" });
  if (evento.prospect_id) {
    await supabase.from("prospects").update({
      etapa_funil: "perdido" as any,
      motivo_perda: "Sem interesse após AB",
      entrou_etapa_em: new Date().toISOString(),
    }).eq("id", evento.prospect_id);
  }
}

async function marcarF2(evento: any) {
  await marcarResultado(evento, "f2_vai_pensar", { status: "realizado" });
  if (evento.prospect_id) {
    await supabase.from("atividades").insert({
      consultor_id: evento.consultor_id,
      prospect_id: evento.prospect_id,
      tipo: "fechamento" as any,
      resultado: "f2_vai_pensar",
      observacao: "Cliente quer pensar (F2).",
    });
  }
}

async function marcarEntregue(evento: any) {
  await marcarResultado(evento, "entregue", { status: "realizado" });
  if (evento.prospect_id) {
    const { data: prospect } = await supabase.from("prospects").select("*").eq("id", evento.prospect_id).single();
    if (prospect) {
      const { data: existing } = await supabase.from("clientes").select("id").eq("prospect_id", prospect.id).maybeSingle();
      if (!existing) {
        await supabase.from("clientes").insert({
          consultor_id: prospect.consultor_id,
          prospect_id: prospect.id,
          nome: prospect.nome,
          telefone: prospect.telefone,
        });
      }
      await supabase.from("prospects").update({
        etapa_funil: "cliente" as any,
        entrou_etapa_em: new Date().toISOString(),
      }).eq("id", prospect.id);
    }
  }
}

function DelayForm({ evento, onClose }: { evento: any; onClose: () => void }) {
  const [motivo, setMotivo] = useState<string>(MOTIVOS_DELAY[0]);
  const [outro, setOutro] = useState("");
  const [proxima, setProxima] = useState("");

  async function save() {
    const motivoFinal = motivo === "Outro" ? outro.trim() : motivo;
    if (!motivoFinal) { toast.error("Informe o motivo do Delay."); return; }

    // Buscar etapa atual do prospect para snapshot
    let etapaOrigem: string | null = evento.prospects?.etapa_funil ?? evento.tipo ?? null;
    if (evento.prospect_id && !etapaOrigem) {
      const { data } = await supabase.from("prospects").select("etapa_funil").eq("id", evento.prospect_id).maybeSingle();
      etapaOrigem = data?.etapa_funil ?? null;
    }

    // Atualiza o evento original (não some — borda vermelha + bandeira)
    const { error: upErr } = await supabase.from("agenda_eventos").update({
      resultado: "delay",
      delay_motivo: motivoFinal,
      delay_em: new Date().toISOString(),
      delay_resolvido: false,
      etapa_origem: etapaOrigem,
    }).eq("id", evento.id);
    if (upErr) { toast.error(upErr.message); return; }

    if (evento.prospect_id) {
      await supabase.from("atividades").insert({
        consultor_id: evento.consultor_id,
        prospect_id: evento.prospect_id,
        tipo: (evento.tipo === "ab" ? "ab" : evento.tipo === "fechamento" ? "fechamento" : evento.tipo === "entrega_apolice" ? "entrega_apolice" : "revisita") as any,
        resultado: "delay",
        observacao: motivoFinal,
        follow_up_em: proxima ? new Date(proxima).toISOString() : null,
      });
      await supabase.from("prospects").update({
        ultima_interacao: new Date().toISOString(),
      }).eq("id", evento.prospect_id);
    }
    toast.success("Delay registrado. Prospect movido para Em Delay.");
    onClose();
  }

  return (
    <DialogContent className="bg-surface border-border max-w-md">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl flex items-center gap-2"><Flag className="h-5 w-5 text-destructive" />Marcar Delay</DialogTitle>
        <p className="text-xs text-muted-foreground">O compromisso permanece visível no calendário com borda vermelha para auditoria.</p>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Motivo do Delay <span className="text-destructive">*</span></Label>
          <Select value={motivo} onValueChange={setMotivo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOTIVOS_DELAY.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {motivo === "Outro" && (
          <div className="space-y-1.5"><Label>Descrever motivo</Label>
            <Textarea rows={2} value={outro} onChange={(e) => setOutro(e.target.value)} />
          </div>
        )}
        <div className="space-y-1.5"><Label>Próxima ação (data/hora) — opcional</Label>
          <Input type="datetime-local" value={proxima} onChange={(e) => setProxima(e.target.value)} />
        </div>
      </div>
      <DialogFooter><Button onClick={save} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Confirmar Delay</Button></DialogFooter>
    </DialogContent>
  );
}

function PropostaFechadaForm({ evento, onClose }: { evento: any; onClose: () => void }) {
  const [f, setF] = useState({
    cobertura_basica: "",
    coberturas_opcionais: "",
    premio_basica: "",
    premio_opcionais: "",
  });

  const premioBasica = Number(f.premio_basica) || 0;
  const premioOpc = Number(f.premio_opcionais) || 0;
  const paTotal = (premioBasica + premioOpc) * 12;

  async function save() {
    if (!evento.prospect_id) { toast.error("Evento sem prospect vinculado."); return; }
    if (!premioBasica) { toast.error("Informe o prêmio da básica."); return; }

    const capital = Number(f.cobertura_basica) || 0;
    const capitalOpc = Number(f.coberturas_opcionais) || 0;

    const { error: apError } = await supabase.from("apolices").insert({
      consultor_id: evento.consultor_id,
      prospect_id: evento.prospect_id,
      seguradora: "metlife" as any,
      capital_segurado: capital + capitalOpc,
      premio_atual: premioBasica + premioOpc,
      status: "migrado" as any,
      onboarding_status: "documentacao_pendente" as any,
      data_fechamento: new Date().toISOString(),
      observacoes_consultor: `Básica: capital ${capital} / prêmio ${premioBasica}. Opcionais: capital ${capitalOpc} / prêmio ${premioOpc}. PA Total: ${paTotal}.`,
    });
    if (apError) { toast.error(apError.message); return; }

    await marcarResultado(evento, "proposta_fechada", { status: "realizado" });

    await supabase.from("prospects").update({
      etapa_funil: "implantacao" as any,
      entrou_etapa_em: new Date().toISOString(),
      ultima_interacao: new Date().toISOString(),
      pa_estimado: paTotal,
    }).eq("id", evento.prospect_id);

    toast.success("Proposta fechada. Movido para Onboarding.");
    onClose();
  }

  return (
    <DialogContent className="bg-surface border-border max-w-lg">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Proposta Fechada</DialogTitle>
        <p className="text-xs text-muted-foreground">Ao salvar, o prospect será movido automaticamente para Onboarding.</p>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Cobertura básica (capital)</Label><Input type="number" value={f.cobertura_basica} onChange={(e) => setF({ ...f, cobertura_basica: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Coberturas opcionais (capital)</Label><Input type="number" value={f.coberturas_opcionais} onChange={(e) => setF({ ...f, coberturas_opcionais: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Prêmio mensal — básica</Label><Input type="number" value={f.premio_basica} onChange={(e) => setF({ ...f, premio_basica: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Prêmio mensal — opcionais</Label><Input type="number" value={f.premio_opcionais} onChange={(e) => setF({ ...f, premio_opcionais: e.target.value })} /></div>
        </div>
        <Card className="p-3 bg-surface-elevated border-gold/30">
          <p className="caps-tracking text-muted-foreground">PA Total (prêmio mensal × 12)</p>
          <p className="font-display text-3xl text-gold mt-1">R$ {paTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </Card>
      </div>
      <DialogFooter><Button onClick={save} className="gold-gradient text-background">Salvar e mover para Onboarding</Button></DialogFooter>
    </DialogContent>
  );
}
