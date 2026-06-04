import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/lilito/PageHeader";
import { EmptyState } from "@/components/lilito/EmptyState";
import { Flame, Phone, MessageCircle, Calendar, Clock, XCircle, PhoneOff, Brain } from "lucide-react";
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
  | { kind: "naoatendeu"; prospect: any };

function Hot() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const [dlg, setDlg] = useState<DialogState>({ kind: "none" });

  const { data: fila } = useQuery({
    queryKey: ["hot-fila"],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects").select("*")
        .eq("etapa_funil", "hot").eq("status_hot", "pendente")
        .order("nota_qualificacao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const atual = fila?.[0];

  function ligar() { if (atual?.telefone) window.open(`tel:${atual.telefone}`); }
  function whatsapp() {
    if (atual?.telefone) window.open(`https://wa.me/${atual.telefone.replace(/\D/g, "")}`, "_blank");
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

      {!atual ? (
        <EmptyState icon={Flame} title="Fila vazia"
          description="Envie prospects para HOT a partir da tela de Recomendações." />
      ) : (
        <div className="max-w-2xl mx-auto">
          <Card className="bg-surface border-gold/30 p-8 shadow-elegant">
            <p className="caps-tracking text-gold text-center">Próximo da fila</p>
            <h2 className="font-display text-5xl text-center mt-3">{atual.nome}</h2>
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
              <Button onClick={ligar} className="gold-gradient text-background">
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
          <p className="text-center text-xs text-muted-foreground mt-4">
            {fila!.length} {fila!.length === 1 ? "prospect na fila" : "prospects na fila"}
          </p>
        </div>
      )}

      <AbDialog state={dlg} setState={setDlg} onDone={() => qc.invalidateQueries({ queryKey: ["hot-fila"] })} />
      <PensarDialog state={dlg} setState={setDlg} onDone={() => qc.invalidateQueries({ queryKey: ["hot-fila"] })} />
      <RetornarDialog state={dlg} setState={setDlg} onDone={() => qc.invalidateQueries({ queryKey: ["hot-fila"] })} />
      <NaoAtendeuDialog state={dlg} setState={setDlg} onDone={() => qc.invalidateQueries({ queryKey: ["hot-fila"] })} />
    </div>
  );
}

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function close(setState: (s: DialogState) => void) { setState({ kind: "none" }); }

function AbDialog({ state, setState, onDone }: { state: DialogState; setState: (s: DialogState) => void; onDone: () => void }) {
  const { auth } = useAuth();
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const [local, setLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const open = state.kind === "ab";

  async function save() {
    if (!auth || state.kind !== "ab" || !data) return;
    setSaving(true);
    const inicio = new Date(`${data}T${hora}:00`);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
    const p = state.prospect;
    const [a, b, c] = await Promise.all([
      supabase.from("prospects").update({
        etapa_funil: "ab", status_hot: "agendou",
        entrou_etapa_em: new Date().toISOString(),
        ultima_interacao: new Date().toISOString(),
      }).eq("id", p.id),
      supabase.from("agenda_eventos").insert({
        consultor_id: auth.user.id, prospect_id: p.id,
        tipo: "ab", titulo: `AB — ${p.nome}`,
        inicio: inicio.toISOString(), fim: fim.toISOString(),
        local: local || null,
      }),
      supabase.from("atividades").insert({
        consultor_id: auth.user.id, prospect_id: p.id,
        tipo: "ab", resultado: "ab_agendada",
        observacao: `AB agendada para ${inicio.toLocaleString("pt-BR")}`,
        follow_up_em: inicio.toISOString(),
      }),
    ]);
    setSaving(false);
    if (a.error || b.error || c.error) return toast.error((a.error ?? b.error ?? c.error)!.message);
    toast.success("AB agendada e evento criado.");
    setData(""); setHora("09:00"); setLocal("");
    close(setState); onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(setState)}>
      <DialogContent className="bg-surface border-border">
        <DialogHeader><DialogTitle className="font-display text-2xl">Agendar AB</DialogTitle></DialogHeader>
        <div className="space-y-4">
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
          <Button onClick={save} disabled={!data || saving} className="gold-gradient text-background">
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
