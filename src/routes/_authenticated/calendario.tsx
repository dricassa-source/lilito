import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/lilito/EmptyState";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({ meta: [{ title: "Calendário — LILITO" }] }),
  component: Calendario,
});

const TIPOS = [
  { v: "ab", l: "AB" }, { v: "fechamento", l: "Fechamento" },
  { v: "revisita", l: "Revisita" }, { v: "entrega_apolice", l: "Entrega de Apólice" },
  { v: "joint_work", l: "Joint Work" }, { v: "review", l: "Review" },
];
const TIPO_LABEL: Record<string, string> = Object.fromEntries(
  [["ab","AB"],["fechamento","Fechamento"],["revisita","Revisita"],["entrega_apolice","Entrega de Apólice"],["joint_work","Joint Work"],["review","Review"]]
);

function Calendario() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: eventos } = useQuery({
    queryKey: ["agenda"],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase.from("agenda_eventos").select("*").gte("inicio", new Date(Date.now() - 7 * 86_400_000).toISOString()).order("inicio");
      if (error) throw error;
      return data ?? [];
    },
  });

  const porDia: Record<string, any[]> = {};
  (eventos ?? []).forEach((e: any) => {
    const k = format(new Date(e.inicio), "yyyy-MM-dd");
    porDia[k] = porDia[k] ?? []; porDia[k].push(e);
  });

  return (
    <div>
      <PageHeader
        eyebrow="Agenda" title="Calendário" description="Sua agenda interna — integração Google em breve."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gold-gradient text-background"><Plus className="h-4 w-4 mr-2" />Novo evento</Button></DialogTrigger>
            <NovoEvento onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["agenda"] }); }} />
          </Dialog>
        }
      />
      {Object.keys(porDia).length === 0 ? (
        <EmptyState icon={CalendarDays} title="Agenda livre" description="Sem compromissos. Use o tempo para uma joint work." />
      ) : (
        <div className="space-y-6">
          {Object.entries(porDia).sort(([a],[b]) => a.localeCompare(b)).map(([dia, evs]) => (
            <div key={dia}>
              <p className="caps-tracking text-gold mb-3">{format(new Date(dia + "T00:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
              <div className="space-y-2">
                {evs.map((e: any) => (
                  <Card key={e.id} className="p-4 bg-surface border-border flex items-center justify-between">
                    <div>
                      <p className="font-medium">{e.titulo}</p>
                      <p className="text-xs text-muted-foreground caps-tracking">{TIPO_LABEL[e.tipo] ?? e.tipo}</p>
                    </div>
                    <p className="font-display text-xl text-gold">{format(new Date(e.inicio), "HH:mm")}</p>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
        <div className="space-y-1.5"><Label>Tipo</Label>
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
