import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConsultorScope, applyScope } from "@/hooks/useConsultorScope";
import { ConsultorFilter } from "@/components/lilito/ConsultorFilter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/lilito/PageHeader";
import { EmptyState } from "@/components/lilito/EmptyState";
import { Flame, Phone, MessageCircle, Calendar, Clock, XCircle, PhoneOff, Brain, Users, Plus, Trash2, ListFilter, BookmarkPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScoreStars } from "@/components/lilito/ScoreStars";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/hot")({
  head: () => ({ meta: [{ title: "HOT — LILITO" }] }),
  component: Hot,
});

function brl(n: number | null | undefined) {
  if (!n) return "—";
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

type DialogState =
  | { kind: "none" }
  | { kind: "ab"; prospect: any }
  | { kind: "pensar"; prospect: any }
  | { kind: "retornar"; prospect: any }
  | { kind: "naoatendeu"; prospect: any }
  | { kind: "novalista" };

function Hot() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const { scopeIds } = useConsultorScope();
  const [dlg, setDlg] = useState<DialogState>({ kind: "none" });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listaId, setListaId] = useState<string>("geral");

  const { data: listas } = useQuery({
    queryKey: ["hot-listas"],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hot_listas").select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const listaSelecionada = useMemo(
    () => listas?.find((l) => l.id === listaId) ?? null,
    [listas, listaId],
  );

  const { data: fila } = useQuery({
    queryKey: ["hot-fila", listaId, scopeIds.join(",")],
    enabled: !!auth && scopeIds.length > 0,
    queryFn: async () => {
      let memberIds: string[] | null = null;
      if (listaSelecionada) {
        const { data: mems } = await supabase
          .from("hot_lista_prospects")
          .select("prospect_id")
          .eq("lista_id", listaSelecionada.id);
        memberIds = (mems ?? []).map((m: any) => m.prospect_id);
        if (memberIds.length === 0) return [];
      }
      let q = applyScope(
        supabase.from("prospects").select("*")
          .eq("etapa_funil", "hot").eq("status_hot", "pendente"),
        scopeIds,
      );
      if (memberIds) q = q.in("id", memberIds);
      const { data, error } = await q
        .order("score", { ascending: false, nullsFirst: false })
        .order("nota_qualificacao", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });



  useEffect(() => { setCurrentIndex(0); }, [listaId, fila?.length]);

  const atual = fila?.[currentIndex];

  function ligar(tel?: string | null) {
    const t = (tel ?? atual?.telefone)?.replace(/[^\d+]/g, "");
    if (t) window.location.href = `tel:${t}`;
  }
  function whatsapp() {
    if (!atual?.telefone) return;
    const clean = atual.telefone.replace(/\D/g, "");
    const withCc = (clean.length === 12 || clean.length === 13) ? clean : `55${clean}`;
    window.open(`https://wa.me/${withCc}`, "_blank");
  }

  async function removerDaHot(prospect: any) {
    if (!prospect) return;
    if (!window.confirm(`Remover ${prospect.nome} da HOT? O prospect permanecerá em Recomendações.`)) return;
    const { error } = await supabase.from("prospects").update({
      etapa_funil: "recomendacao",
      status_hot: null,
      entrou_etapa_em: new Date().toISOString(),
    }).eq("id", prospect.id);
    if (error) return toast.error(error.message);
    toast.success("Removido da HOT.");
    qc.invalidateQueries({ queryKey: ["hot-fila"] });
  }

  async function semInteresse() {
    if (!atual || !auth) return;
    const motivo = window.prompt("Motivo (opcional)?") ?? "";
    const now = new Date().toISOString();
    await Promise.all([
      supabase.from("prospects").update({
        etapa_funil: "perdido", status_hot: "sem_interesse",
        motivo_perda: motivo, ultima_interacao: now,
      }).eq("id", atual.id),
      supabase.from("atividades").insert({
        consultor_id: auth.user.id, prospect_id: atual.id,
        tipo: "ligacao", resultado: "sem_interesse", observacao: motivo,
      }),
    ]);
    toast.success("Marcado como sem interesse.");
    qc.invalidateQueries({ queryKey: ["hot-fila"] });
  }

  return (
    <div>
      <PageHeader eyebrow="Fila diária" title="HOT" description="Ligações priorizadas por qualificação." />
      <ConsultorFilter />

      <HotGestao />




      {/* Listas HOT */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex items-center gap-2 mb-3">
          <ListFilter className="h-4 w-4 text-gold" />
          <span className="caps-tracking text-muted-foreground">Listas HOT</span>
          <div className="flex-1 hairline-gold opacity-30" />
          <Button size="sm" variant="outline" onClick={() => setDlg({ kind: "novalista" })} className="border-gold/40 hover:text-gold">
            <Plus className="h-3 w-3 mr-1" />Nova Lista HOT
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={listaId === "geral" ? "default" : "outline"}
            onClick={() => setListaId("geral")}
            className={listaId === "geral" ? "gold-gradient text-background" : ""}
          >
            HOT Geral
          </Button>
          {listas?.map((l) => (
            <Button
              key={l.id}
              size="sm"
              variant={listaId === l.id ? "default" : "outline"}
              onClick={() => setListaId(l.id)}
              className={listaId === l.id ? "gold-gradient text-background" : ""}
            >
              {l.nome}
            </Button>
          ))}
        </div>
      </div>

      {!atual ? (
        <EmptyState icon={Flame} title="Fila vazia"
          description={listaSelecionada ? "Nenhum prospect nesta lista no período selecionado." : "Envie prospects para HOT a partir da tela de Recomendações."} />
      ) : (
        <div className="max-w-2xl mx-auto">
          <Card className="bg-surface border-gold/30 p-8 shadow-elegant">
            <p className="caps-tracking text-gold text-center">
              Prospect atual {currentIndex + 1} de {fila!.length}
            </p>
            <h2 className="font-display text-5xl text-center mt-3 flex items-center justify-center gap-3">{atual.nome} <ScoreStars score={atual.score} className="text-base" /></h2>
            <p className="text-center text-muted-foreground mt-2">
              {atual.especialidade_medica ?? "—"}
            </p>
            <div className="hairline-gold my-6" />
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="caps-tracking text-muted-foreground">Telefone</p>
                <p className="text-sm mt-2">{atual.telefone ?? "—"}</p>
              </div>
              <div>
                <p className="caps-tracking text-muted-foreground">Renda est.</p>
                <p className="font-display text-2xl text-gold">{brl(atual.renda_estimada)}</p>
              </div>
              <div>
                <p className="caps-tracking text-muted-foreground">Recomendante</p>
                <p className="text-sm mt-2">{atual.quem_recomendou ?? "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-8">
              <Button onClick={() => ligar()} className="gold-gradient text-background">
                <Phone className="h-4 w-4 mr-2" />Ligar agora
              </Button>
              <Button onClick={whatsapp} variant="outline">
                <MessageCircle className="h-4 w-4 mr-2" />WhatsApp
              </Button>
            </div>

            <div className="hairline-gold my-6 opacity-40" />
            <p className="caps-tracking text-muted-foreground text-center mb-3">Resultado da ligação</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Button size="sm" variant="outline" onClick={() => setDlg({ kind: "ab", prospect: atual })} className="border-gold/40 hover:text-gold">
                <Calendar className="h-3 w-3 mr-1" />AB
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: "pensar", prospect: atual })}>
                <Brain className="h-3 w-3 mr-1" />Vai Pensar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: "retornar", prospect: atual })}>
                <Clock className="h-3 w-3 mr-1" />Retornar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: "naoatendeu", prospect: atual })}>
                <PhoneOff className="h-3 w-3 mr-1" />Não atendeu
              </Button>
              <Button size="sm" variant="ghost" onClick={semInteresse} className="text-muted-foreground hover:text-destructive">
                <XCircle className="h-3 w-3 mr-1" />Sem interesse
              </Button>
            </div>
          </Card>

          {/* FILA HOT */}
          {fila && fila.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-gold" />
                <h3 className="font-display text-xl text-foreground">
                  Fila — {listaSelecionada?.nome ?? "HOT Geral"}
                </h3>
                <div className="flex-1 hairline-gold opacity-30" />
                <span className="text-xs text-muted-foreground">{fila.length} prospect{fila.length === 1 ? "" : "s"}</span>
              </div>
              <div className="space-y-3">
                {fila.map((p, idx) => {
                  const isAtual = idx === currentIndex;
                  return (
                    <Card
                      key={p.id}
                      className={`p-4 transition-colors ${
                        isAtual
                          ? "bg-gold/10 border-gold/50"
                          : "bg-surface border-border hover:border-gold/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div
                          onClick={() => setCurrentIndex(idx)}
                          className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer"
                        >
                          <span
                            className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full font-display text-sm ${
                              isAtual ? "bg-gold text-background" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className={`font-display text-lg truncate flex items-center gap-2 ${isAtual ? "text-gold" : "text-foreground"}`}>
                              <span className="truncate">{p.nome}</span>
                              <ScoreStars score={p.score} />
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5 truncate">
                              {p.especialidade_medica ?? "—"}
                              {p.quem_recomendou ? ` · Indicado por ${p.quem_recomendou}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {diasDesde(p.entrou_etapa_em)} no HOT
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon" variant="ghost"
                            onClick={(e) => { e.stopPropagation(); ligar(p.telefone); }}
                            title="Ligar"
                            className="h-8 w-8 hover:text-gold"
                            disabled={!p.telefone}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                          <AdicionarALista prospectId={p.id} listas={listas ?? []} />
                          <Button
                            size="icon" variant="ghost"
                            onClick={(e) => { e.stopPropagation(); removerDaHot(p); }}
                            title="Remover da HOT"
                            className="h-8 w-8 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <AbDialog state={dlg} setState={setDlg} onDone={() => qc.invalidateQueries({ queryKey: ["hot-fila"] })} />
      <PensarDialog state={dlg} setState={setDlg} onDone={() => qc.invalidateQueries({ queryKey: ["hot-fila"] })} />
      <RetornarDialog state={dlg} setState={setDlg} onDone={() => qc.invalidateQueries({ queryKey: ["hot-fila"] })} />
      <NaoAtendeuDialog state={dlg} setState={setDlg} onDone={() => qc.invalidateQueries({ queryKey: ["hot-fila"] })} />
      <NovaListaDialog
        state={dlg} setState={setDlg}
        onDone={(id) => {
          qc.invalidateQueries({ queryKey: ["hot-listas"] });
          if (id) setListaId(id);
        }}
      />
    </div>
  );
}

function AdicionarALista({ prospectId, listas }: { prospectId: string; listas: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: membros } = useQuery({
    queryKey: ["hot-prospect-listas", prospectId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("hot_lista_prospects")
        .select("lista_id").eq("prospect_id", prospectId);
      return new Set((data ?? []).map((m: any) => m.lista_id));
    },
  });
  async function toggle(listaId: string, checked: boolean) {
    if (checked) {
      const { error } = await supabase.from("hot_lista_prospects").insert({ lista_id: listaId, prospect_id: prospectId });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("hot_lista_prospects").delete().eq("lista_id", listaId).eq("prospect_id", prospectId);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["hot-prospect-listas", prospectId] });
    qc.invalidateQueries({ queryKey: ["hot-fila"] });
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()} title="Adicionar à Lista" className="h-8 w-8 hover:text-gold">
          <BookmarkPlus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 bg-surface border-border p-2" onClick={(e) => e.stopPropagation()}>
        <p className="caps-tracking text-gold text-[10px] px-2 py-1">Adicionar à Lista</p>
        {listas.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-2">Crie uma lista primeiro.</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {listas.map((l) => {
              const checked = membros?.has(l.id) ?? false;
              return (
                <label key={l.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-elevated rounded cursor-pointer text-sm">
                  <Checkbox checked={checked} onCheckedChange={(v) => toggle(l.id, !!v)} />
                  <span className="truncate">{l.nome}</span>
                </label>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}



function diasDesde(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  return diff <= 0 ? "Hoje" : `${diff} dia${diff > 1 ? "s" : ""}`;
}

function etapaLabel(etapa: string | null | undefined) {
  const labels: Record<string, string> = {
    recomendacao: "Recomendação",
    hot: "HOT",
    ab: "AB",
    revisita: "Revisita",
    fechamento: "Fechamento",
    entrega_apolice: "Entrega de Apólice",
    pos_venda: "Pós-Venda",
    perdido: "Perdido",
  };
  return labels[etapa ?? ""] ?? (etapa ?? "—");
}

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function close(setState: (s: DialogState) => void) { setState({ kind: "none" }); }

const NATUREZAS = [
  { v: "ab", label: "AB", etapa: "ab", tituloPrefix: "AB" },
  { v: "fechamento", label: "Fechamento", etapa: "fechamento", tituloPrefix: "Fechamento" },
  { v: "revisita", label: "Revisita", etapa: "revisita", tituloPrefix: "Revisita" },
  { v: "entrega_apolice", label: "Entrega de Apólice", etapa: "entrega_apolice", tituloPrefix: "Entrega de Apólice" },
] as const;

function AbDialog({ state, setState, onDone }: { state: DialogState; setState: (s: DialogState) => void; onDone: () => void }) {
  const { auth } = useAuth();
  const [natureza, setNatureza] = useState<typeof NATUREZAS[number]["v"]>("ab");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const [local, setLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const open = state.kind === "ab";

  async function save() {
    if (!auth || state.kind !== "ab" || !data || !natureza) return;
    setSaving(true);
    const cfg = NATUREZAS.find((n) => n.v === natureza)!;
    const inicio = new Date(`${data}T${hora}:00`);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
    const p = state.prospect;
    const [a, b, c] = await Promise.all([
      supabase.from("prospects").update({
        etapa_funil: cfg.etapa as any, status_hot: "agendou",
        entrou_etapa_em: new Date().toISOString(),
        ultima_interacao: new Date().toISOString(),
      }).eq("id", p.id),
      supabase.from("agenda_eventos").insert({
        consultor_id: auth.user.id, prospect_id: p.id,
        tipo: cfg.v as any, titulo: `${cfg.tituloPrefix} — ${p.nome}`,
        inicio: inicio.toISOString(), fim: fim.toISOString(),
        local: local || null,
      }),
      supabase.from("atividades").insert({
        consultor_id: auth.user.id, prospect_id: p.id,
        tipo: cfg.v as any, resultado: "ab_agendada",
        observacao: `${cfg.label} agendado para ${inicio.toLocaleString("pt-BR")}`,
        follow_up_em: inicio.toISOString(),
      }),
    ]);
    setSaving(false);
    if (a.error || b.error || c.error) return toast.error((a.error ?? b.error ?? c.error)!.message);
    toast.success(`${cfg.label} agendado e evento criado.`);
    setNatureza("ab"); setData(""); setHora("09:00"); setLocal("");
    close(setState); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(setState)}>
      <DialogContent className="bg-surface border-border">
        <DialogHeader><DialogTitle className="font-display text-2xl">Novo agendamento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Natureza do agendamento <span className="text-destructive">*</span></Label>
            <Select value={natureza} onValueChange={(v) => setNatureza(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NATUREZAS.map((n) => <SelectItem key={n.v} value={n.v}>{n.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Hora</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Local</Label>
            <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Presencial, Zoom..." /></div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={!data || !natureza || saving} className="gold-gradient text-background">
            {saving ? "Salvando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PensarDialog({ state, setState, onDone }: { state: DialogState; setState: (s: DialogState) => void; onDone: () => void }) {
  const { auth } = useAuth();
  const [dias, setDias] = useState<3 | 7 | 14>(3);
  const open = state.kind === "pensar";

  async function save() {
    if (!auth || state.kind !== "pensar") return;
    const p = state.prospect;
    const followUp = addDays(new Date(), dias);
    await Promise.all([
      supabase.from("prospects").update({
        status_hot: "pensando", ultima_interacao: new Date().toISOString(),
      }).eq("id", p.id),
      supabase.from("atividades").insert({
        consultor_id: auth.user.id, prospect_id: p.id,
        tipo: "ligacao", resultado: "vai_pensar",
        observacao: `Follow-up em ${dias} dias`,
        follow_up_em: followUp.toISOString(),
      }),
    ]);
    toast.success(`Follow-up agendado para ${dias} dias.`);
    close(setState); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(setState)}>
      <DialogContent className="bg-surface border-border">
        <DialogHeader><DialogTitle className="font-display text-2xl">Vai Pensar</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Retornar em</Label>
          <div className="grid grid-cols-3 gap-2">
            {[3, 7, 14].map((d) => (
              <Button key={d} variant={dias === d ? "default" : "outline"}
                onClick={() => setDias(d as any)}
                className={dias === d ? "gold-gradient text-background" : ""}>
                {d} dias
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} className="gold-gradient text-background">Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RetornarDialog({ state, setState, onDone }: { state: DialogState; setState: (s: DialogState) => void; onDone: () => void }) {
  const { auth } = useAuth();
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const open = state.kind === "retornar";

  async function save() {
    if (!auth || state.kind !== "retornar" || !data) return;
    const p = state.prospect;
    const when = new Date(`${data}T${hora}:00`);
    await Promise.all([
      supabase.from("prospects").update({
        status_hot: "ligar_depois", ultima_interacao: new Date().toISOString(),
      }).eq("id", p.id),
      supabase.from("atividades").insert({
        consultor_id: auth.user.id, prospect_id: p.id,
        tipo: "ligacao", resultado: "retornar_depois",
        observacao: `Retornar em ${when.toLocaleString("pt-BR")}`,
        follow_up_em: when.toISOString(),
      }),
    ]);
    toast.success("Retorno agendado.");
    setData(""); setHora("09:00");
    close(setState); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(setState)}>
      <DialogContent className="bg-surface border-border">
        <DialogHeader><DialogTitle className="font-display text-2xl">Retornar depois</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Hora</Label>
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={!data} className="gold-gradient text-background">Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NaoAtendeuDialog({ state, setState, onDone }: { state: DialogState; setState: (s: DialogState) => void; onDone: () => void }) {
  const { auth } = useAuth();
  const [dias, setDias] = useState<1 | 3 | 7>(1);
  const open = state.kind === "naoatendeu";

  async function save() {
    if (!auth || state.kind !== "naoatendeu") return;
    const p = state.prospect;
    const followUp = addDays(new Date(), dias);
    await Promise.all([
      supabase.from("prospects").update({
        status_hot: "nao_atendeu", ultima_interacao: new Date().toISOString(),
      }).eq("id", p.id),
      supabase.from("atividades").insert({
        consultor_id: auth.user.id, prospect_id: p.id,
        tipo: "ligacao", resultado: "nao_atendeu",
        observacao: `Retornar em ${dias} dia(s)`,
        follow_up_em: followUp.toISOString(),
      }),
    ]);
    toast.success(`Retorno em ${dias} dia(s).`);
    close(setState); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(setState)}>
      <DialogContent className="bg-surface border-border">
        <DialogHeader><DialogTitle className="font-display text-2xl">Não atendeu</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Tentar novamente em</Label>
          <div className="grid grid-cols-3 gap-2">
            {[1, 3, 7].map((d) => (
              <Button key={d} variant={dias === d ? "default" : "outline"}
                onClick={() => setDias(d as any)}
                className={dias === d ? "gold-gradient text-background" : ""}>
                {d} dia{d > 1 ? "s" : ""}
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} className="gold-gradient text-background">Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaListaDialog({ state, setState, onDone }: { state: DialogState; setState: (s: DialogState) => void; onDone: (id?: string) => void }) {
  const { auth } = useAuth();
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const open = state.kind === "novalista";

  async function save() {
    if (!auth || !nome) return;
    setSaving(true);
    const { data, error } = await supabase.from("hot_listas").insert({
      consultor_id: auth.user.id,
      nome,
      data_inicio: null,
      data_fim: null,
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Lista HOT criada.");
    setNome("");
    close(setState); onDone(data?.id);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(setState)}>
      <DialogContent className="bg-surface border-border">
        <DialogHeader><DialogTitle className="font-display text-2xl">Nova Lista HOT</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da lista <span className="text-destructive">*</span></Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: São João, Empresários, Médicos…"
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Listas são agrupamentos manuais. Adicione prospects diretamente pela ação “Adicionar à Lista”.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={!nome || saving} className="gold-gradient text-background">
            {saving ? "Salvando..." : "Criar lista"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ============= HOT Gestão (Sessão da Semana + Ranking + Funil) =============

function HotGestao() {
  const { auth } = useAuth();
  const { scopeIds, isMaster, consultorId } = useConsultorScope();
  const scopeKey = scopeIds.join(",");

  const { data } = useQuery({
    queryKey: ["hot-gestao", scopeKey],
    enabled: !!auth && scopeIds.length > 0,
    queryFn: async () => {
      const monday = new Date();
      const day = monday.getDay();
      const diff = (day + 6) % 7;
      monday.setDate(monday.getDate() - diff);
      monday.setHours(0, 0, 0, 0);
      const inicio = monday.toISOString();

      const [ativs, evs, prospects, roles] = await Promise.all([
        // !inner garante que só conta atividades vinculadas a prospects existentes
        applyScope(supabase.from("atividades").select("tipo,resultado,consultor_id,created_at,prospects!inner(id)").gte("created_at", inicio), scopeIds),
        applyScope(supabase.from("agenda_eventos").select("tipo,inicio,consultor_id,prospects!inner(id)").gte("inicio", inicio), scopeIds),
        applyScope(supabase.from("prospects").select("id,etapa_funil,consultor_id,entrou_etapa_em,origem"), scopeIds),
        supabase.from("user_roles").select("user_id").eq("role", "consultor"),
      ]);

      const ligacoes = (ativs.data ?? []).filter((a: any) => a.tipo === "ligacao").length;
      const absGeradas = (evs.data ?? []).filter((e: any) => e.tipo === "ab").length;
      const conv = ligacoes > 0 ? Math.round((absGeradas / ligacoes) * 100) : 0;
      const retornos = (ativs.data ?? []).filter((a: any) => a.resultado === "retornar").length;
      const naoAtendeu = (ativs.data ?? []).filter((a: any) => a.resultado === "nao_atendeu").length;
      const semInteresse = (ativs.data ?? []).filter((a: any) => a.resultado === "sem_interesse").length;

      // Ranking por consultor
      const consultorIds = (roles.data ?? []).map((r) => r.user_id);
      const { data: perfis } = consultorIds.length
        ? await supabase.from("profiles").select("id,nome").in("id", consultorIds)
        : { data: [] as any[] };
      const nomes = new Map((perfis ?? []).map((p: any) => [p.id, p.nome]));

      const ranking = new Map<string, { id: string; nome: string; lig: number; abs: number; tempoTotal: number; tempoCount: number }>();
      for (const a of (ativs.data ?? []) as any[]) {
        if (a.tipo !== "ligacao") continue;
        const cur = ranking.get(a.consultor_id) ?? { id: a.consultor_id, nome: nomes.get(a.consultor_id) ?? "—", lig: 0, abs: 0, tempoTotal: 0, tempoCount: 0 };
        cur.lig++; ranking.set(a.consultor_id, cur);
      }
      for (const e of (evs.data ?? []) as any[]) {
        if (e.tipo !== "ab") continue;
        const cur = ranking.get(e.consultor_id) ?? { id: e.consultor_id, nome: nomes.get(e.consultor_id) ?? "—", lig: 0, abs: 0, tempoTotal: 0, tempoCount: 0 };
        cur.abs++; ranking.set(e.consultor_id, cur);
      }
      for (const p of (prospects.data ?? []) as any[]) {
        if (p.etapa_funil !== "hot" || !p.entrou_etapa_em) continue;
        const dias = Math.floor((Date.now() - new Date(p.entrou_etapa_em).getTime()) / 86_400_000);
        const cur = ranking.get(p.consultor_id) ?? { id: p.consultor_id, nome: nomes.get(p.consultor_id) ?? "—", lig: 0, abs: 0, tempoTotal: 0, tempoCount: 0 };
        cur.tempoTotal += dias; cur.tempoCount++;
        ranking.set(p.consultor_id, cur);
      }
      const rankingArr = Array.from(ranking.values())
        .map((r) => ({ ...r, conv: r.lig > 0 ? Math.round((r.abs / r.lig) * 100) : 0, tempoMedio: r.tempoCount > 0 ? Math.round(r.tempoTotal / r.tempoCount) : 0 }))
        .sort((a, b) => b.abs - a.abs);

      // Funil HOT → Cliente
      const funil = {
        recomendacao: (prospects.data ?? []).filter((p: any) => p.etapa_funil === "recomendacao").length,
        hot: (prospects.data ?? []).filter((p: any) => p.etapa_funil === "hot").length,
        ab: (prospects.data ?? []).filter((p: any) => p.etapa_funil === "ab").length,
        fechamento: (prospects.data ?? []).filter((p: any) => p.etapa_funil === "fechamento").length,
        onboarding: (prospects.data ?? []).filter((p: any) => p.etapa_funil === "implantacao").length,
        cliente: (prospects.data ?? []).filter((p: any) => ["cliente", "pos_venda"].includes(p.etapa_funil)).length,
      };

      return { sessao: { ligacoes, absGeradas, conv, retornos, naoAtendeu, semInteresse }, ranking: rankingArr, funil };
    },
  });

  if (!data) return null;
  const mostrarRanking = isMaster && !consultorId;

  return (
    <div className="space-y-4 mb-6">
      <Card className="bg-surface border-border p-5">
        <p className="caps-tracking text-gold text-[0.65rem] mb-3">🔥 Sessão HOT da semana</p>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
          <HotStat icon="☎" label="Ligações" value={data.sessao.ligacoes} />
          <HotStat icon="📅" label="ABs geradas" value={data.sessao.absGeradas} />
          <HotStat icon="🔥" label="HOT → AB" value={`${data.sessao.conv}%`} />
          <HotStat icon="🔄" label="Retornos" value={data.sessao.retornos} />
          <HotStat icon="⏰" label="Não atendeu" value={data.sessao.naoAtendeu} />
          <HotStat icon="❌" label="Sem interesse" value={data.sessao.semInteresse} />
        </div>
      </Card>

      {mostrarRanking && data.ranking.length > 0 && (
        <Card className="bg-surface border-border p-5">
          <p className="caps-tracking text-gold text-[0.65rem] mb-3">🏆 Ranking HOT</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] text-muted-foreground uppercase tracking-wider">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Consultor</th>
                  <th className="py-1 pr-2 text-right">Ligações</th>
                  <th className="py-1 pr-2 text-right">ABs</th>
                  <th className="py-1 pr-2 text-right">Conv.</th>
                  <th className="py-1 pl-2">Tempo médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.ranking.map((r, idx) => {
                  const tempoCor = r.tempoMedio <= 3 ? "text-emerald-500" : r.tempoMedio <= 7 ? "text-yellow-500" : "text-destructive";
                  const tempoDot = r.tempoMedio <= 3 ? "🟢" : r.tempoMedio <= 7 ? "🟡" : "🔴";
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-2 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 pr-2 truncate max-w-[160px]">{r.nome}</td>
                      <td className="py-2 pr-2 text-right">{r.lig}</td>
                      <td className="py-2 pr-2 text-right">{r.abs}</td>
                      <td className="py-2 pr-2 text-right text-gold">{r.conv}%</td>
                      <td className={`py-2 pl-2 ${tempoCor}`}>{tempoDot} {r.tempoMedio}d</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="bg-surface border-border p-5">
        <p className="caps-tracking text-gold text-[0.65rem] mb-3">🔻 Funil HOT → Cliente</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <FunilStep label="Recomendação" qtd={data.funil.recomendacao} color="bg-muted text-muted-foreground" />
          <FunilStep label="HOT" qtd={data.funil.hot} color="bg-orange-500/20 text-orange-500" />
          <FunilStep label="AB" qtd={data.funil.ab} color="bg-yellow-500/20 text-yellow-500" />
          <FunilStep label="Fechamento" qtd={data.funil.fechamento} color="bg-emerald-600/20 text-emerald-500" />
          <FunilStep label="Onboarding" qtd={data.funil.onboarding} color="bg-emerald-300/20 text-emerald-300" />
          <FunilStep label="Cliente" qtd={data.funil.cliente} color="bg-gold/20 text-gold" />
        </div>
      </Card>
    </div>
  );
}

function HotStat({ icon, label, value }: { icon: string; label: string; value: any }) {
  return (
    <div>
      <p className="text-2xl leading-none">{icon}</p>
      <p className="font-display text-2xl mt-1">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

function FunilStep({ label, qtd, color }: { label: string; qtd: number; color: string }) {
  return (
    <div className={`${color} rounded-md p-2.5 text-center`}>
      <p className="caps-tracking text-[0.55rem] opacity-80">{label}</p>
      <p className="font-display text-2xl mt-1">{qtd}</p>
    </div>
  );
}
