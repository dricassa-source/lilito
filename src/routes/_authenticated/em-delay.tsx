import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/lilito/EmptyState";
import { ScoreStars } from "@/components/lilito/ScoreStars";
import { AlertTriangle, Phone, MessageCircle, CalendarClock, Clock3, XCircle, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/em-delay")({
  head: () => ({ meta: [{ title: "Em Delay — LILITO" }] }),
  component: EmDelay,
});

// Etapas que entram na fila de Em Delay (Onboarding NÃO entra)
const ETAPAS_ELEGIVEIS = ["ab", "revisita", "fechamento", "entrega_apolice"];

const ETAPA_LABEL: Record<string, string> = {
  ab: "AB",
  revisita: "Revisita",
  fechamento: "Fechamento",
  entrega_apolice: "Entrega de Apólice",
};

function EmDelay() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const [perdaOpen, setPerdaOpen] = useState<any | null>(null);
  const [motivo, setMotivo] = useState("");
  const [reagendar, setReagendar] = useState<any | null>(null);

  const { data: delays } = useQuery({
    queryKey: ["em-delay", auth?.user.id, auth?.isMaster],
    enabled: !!auth,
    queryFn: async () => {
      let q = supabase.from("agenda_eventos")
        .select("*,prospects(id,nome,telefone,score,etapa_funil)")
        .not("delay_em", "is", null)
        .eq("delay_resolvido", false)
        .order("delay_em", { ascending: false });
      if (!auth?.isMaster) q = q.eq("consultor_id", auth!.user.id);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []).filter((d: any) => {
        const etapa = d.etapa_origem ?? d.tipo;
        return ETAPAS_ELEGIVEIS.includes(etapa);
      });
      // Fetch consultor profiles separately (no FK to public.profiles)
      const ids = Array.from(new Set(rows.map((r: any) => r.consultor_id).filter(Boolean)));
      let profiles: Record<string, { id: string; nome: string }> = {};
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles").select("id,nome").in("id", ids);
        profiles = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p]));
      }
      return rows.map((r: any) => ({ ...r, consultor: profiles[r.consultor_id] ?? null }));
    },
  });


  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["em-delay"] });
    qc.invalidateQueries({ queryKey: ["agenda"] });
  };

  async function destravar(d: any) {
    await supabase.from("agenda_eventos").update({ delay_resolvido: true }).eq("id", d.id);
    if (d.prospect_id) {
      await supabase.from("prospects").update({
        entrou_etapa_em: new Date().toISOString(),
        ultima_interacao: new Date().toISOString(),
      }).eq("id", d.prospect_id);
    }
    toast.success("Delay resolvido. Compromisso permanece no calendário como histórico.");
    invalidate();
  }

  async function adiar7(d: any) {
    const nova = new Date(); nova.setDate(nova.getDate() + 7); nova.setHours(9, 0, 0, 0);
    const fim = new Date(nova.getTime() + 60 * 60 * 1000);
    await supabase.from("agenda_eventos").update({ delay_resolvido: true }).eq("id", d.id);
    if (d.prospect_id) {
      await supabase.from("agenda_eventos").insert({
        consultor_id: d.consultor_id,
        prospect_id: d.prospect_id,
        tipo: (d.etapa_origem ?? d.tipo) as any,
        titulo: d.titulo,
        inicio: nova.toISOString(),
        fim: fim.toISOString(),
      });
    }
    toast.success("Reagendado para daqui a 7 dias.");
    invalidate();
  }

  async function marcarPerdido(d: any) {
    if (!motivo.trim()) { toast.error("Informe o motivo."); return; }
    await supabase.from("agenda_eventos").update({ delay_resolvido: true }).eq("id", d.id);
    if (d.prospect_id) {
      await supabase.from("prospects").update({
        etapa_funil: "perdido" as any,
        motivo_perda: motivo,
      }).eq("id", d.prospect_id);
    }
    toast.success("Marcado como perdido.");
    setPerdaOpen(null); setMotivo("");
    invalidate();
  }

  function ligar(tel?: string | null) { if (tel) window.open(`tel:${tel}`); }
  function whatsapp(tel?: string | null) { if (tel) window.open(`https://wa.me/${tel.replace(/\D/g, "")}`, "_blank"); }

  function diasParado(iso: string) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  }

  return (
    <div>
      <PageHeader eyebrow="Resgate" title="Em Delay" description="Compromissos travados aguardando ação. Onboarding não entra nesta fila." />
      {!delays || delays.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Nada travado" description="Sua operação está fluindo bem." />
      ) : (
        <Card className="bg-surface border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prospect</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead>Dias parado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {delays.map((d: any) => {
                const etapa = d.etapa_origem ?? d.tipo;
                const nome = d.prospects?.nome ?? d.titulo ?? "—";
                const tel = d.prospects?.telefone;
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{nome}</span>
                        <ScoreStars score={d.prospects?.score} />
                      </div>
                    </TableCell>
                    <TableCell><span className="caps-tracking text-gold text-[0.65rem]">{ETAPA_LABEL[etapa] ?? etapa}</span></TableCell>
                    <TableCell className="text-destructive text-sm">{d.delay_motivo ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.consultor?.nome ?? "—"}</TableCell>
                    <TableCell className="text-destructive">{diasParado(d.delay_em)}d</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button size="sm" variant="ghost" onClick={() => setReagendar(d)} title="Reagendar"><CalendarClock className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => adiar7(d)} title="Adiar 7 dias"><Clock3 className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => ligar(tel)} title="Ligar" disabled={!tel}><Phone className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => whatsapp(tel)} title="WhatsApp" disabled={!tel}><MessageCircle className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => destravar(d)} title="Destravar agora" className="text-gold"><Unplug className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setPerdaOpen(d)} title="Marcar Perdido" className="text-destructive"><XCircle className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!perdaOpen} onOpenChange={(o) => !o && setPerdaOpen(null)}>
        <DialogContent className="bg-surface border-border">
          <DialogHeader><DialogTitle className="font-display text-2xl">Marcar como perdido</DialogTitle></DialogHeader>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da perda…" />
          <DialogFooter>
            <Button variant="destructive" onClick={() => perdaOpen && marcarPerdido(perdaOpen)}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReagendarDialog
        open={!!reagendar}
        onOpenChange={(o) => !o && setReagendar(null)}
        delay={reagendar}
        onDone={() => { setReagendar(null); invalidate(); }}
      />
    </div>
  );
}

function ReagendarDialog({ open, onOpenChange, delay, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; delay: any | null; onDone: () => void }) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  async function save() {
    if (!delay) return;
    if (!inicio || !fim) { toast.error("Informe início e fim."); return; }
    const iniISO = new Date(inicio).toISOString();
    const fimISO = new Date(fim).toISOString();
    if (new Date(fimISO) <= new Date(iniISO)) { toast.error("Fim deve ser após o início."); return; }

    // 1. Marca delay como resolvido (evento original permanece com borda vermelha)
    await supabase.from("agenda_eventos").update({ delay_resolvido: true }).eq("id", delay.id);
    // 2. Cria novo compromisso
    const { error } = await supabase.from("agenda_eventos").insert({
      consultor_id: delay.consultor_id,
      prospect_id: delay.prospect_id,
      tipo: (delay.etapa_origem ?? delay.tipo) as any,
      titulo: delay.titulo,
      inicio: iniISO, fim: fimISO,
    });
    if (error) { toast.error(error.message); return; }
    if (delay.prospect_id) {
      await supabase.from("prospects").update({
        ultima_interacao: new Date().toISOString(),
      }).eq("id", delay.prospect_id);
    }
    toast.success("Reagendado.");
    setInicio(""); setFim("");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Reagendar</DialogTitle>
          <p className="text-xs text-muted-foreground">Cria um novo compromisso. O original permanece no calendário com borda vermelha para auditoria.</p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Início</Label><Input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Fim</Label><Input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} className="gold-gradient text-background">Reagendar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
