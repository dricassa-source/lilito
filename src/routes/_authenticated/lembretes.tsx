import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConsultorScope, applyScope } from "@/hooks/useConsultorScope";
import { ConsultorFilter } from "@/components/lilito/ConsultorFilter";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/lilito/EmptyState";
import { Plus, Bell, Check } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/lembretes")({
  head: () => ({ meta: [{ title: "Lembretes — LILITO" }] }),
  component: Lembretes,
});

function Lembretes() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const { scopeIds } = useConsultorScope();

  const { data } = useQuery({
    queryKey: ["lembretes", scopeIds.join(",")],
    enabled: !!auth && scopeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await applyScope(
        supabase.from("lembretes").select("*, prospects(nome)"),
        scopeIds,
      ).order("concluido").order("data").order("hora");
      if (error) throw error;
      return data ?? [];
    },
  });


  const toggle = useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean }) => {
      const { error } = await supabase.from("lembretes").update({
        concluido, concluido_em: concluido ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lembretes"] }),
  });

  const pendentes = (data ?? []).filter((l: any) => !l.concluido);
  const concluidos = (data ?? []).filter((l: any) => l.concluido);

  return (
    <div>
      <PageHeader eyebrow="Tarefas" title="Lembretes"
        description="Não ocupam horário. Aparecem no Meu Dia até serem concluídos."
        actions={<NovoLembrete onSaved={() => qc.invalidateQueries({ queryKey: ["lembretes"] })} />} />
      <ConsultorFilter />



      <p className="caps-tracking text-gold mb-3 flex items-center gap-2">
        <Bell className="h-3.5 w-3.5" /> Pendentes ({pendentes.length})
      </p>
      {pendentes.length === 0 ? (
        <EmptyState icon={Bell} title="Sem lembretes pendentes" description="Tudo em dia." />
      ) : (
        <Card className="bg-surface border-border divide-y divide-border mb-6">
          {pendentes.map((l: any) => (
            <LembreteRow key={l.id} l={l} onToggle={(v) => toggle.mutate({ id: l.id, concluido: v })} />
          ))}
        </Card>
      )}

      {concluidos.length > 0 && (
        <>
          <p className="caps-tracking text-muted-foreground mb-3">Concluídos</p>
          <Card className="bg-surface border-border divide-y divide-border opacity-60">
            {concluidos.slice(0, 20).map((l: any) => (
              <LembreteRow key={l.id} l={l} onToggle={(v) => toggle.mutate({ id: l.id, concluido: v })} />
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function LembreteRow({ l, onToggle }: { l: any; onToggle: (v: boolean) => void }) {
  return (
    <div className="p-3 flex items-center gap-3">
      <Button variant={l.concluido ? "default" : "outline"} size="icon" className="h-8 w-8 shrink-0"
        onClick={() => onToggle(!l.concluido)}>
        <Check className="h-4 w-4" />
      </Button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${l.concluido ? "line-through" : ""}`}>{l.titulo}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(l.data), "dd MMM", { locale: ptBR })}{l.hora ? ` · ${l.hora.slice(0,5)}` : ""}
          {l.prospects?.nome ? ` · ${l.prospects.nome}` : ""}
        </p>
        {l.observacao && <p className="text-xs text-muted-foreground mt-1">{l.observacao}</p>}
      </div>
    </div>
  );
}

export function NovoLembrete({ onSaved, prospectId, defaultDate }: {
  onSaved: () => void; prospectId?: string; defaultDate?: string;
}) {
  const { auth } = useAuth();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(defaultDate ?? format(new Date(), "yyyy-MM-dd"));
  const [hora, setHora] = useState("");
  const [obs, setObs] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lembretes").insert({
        consultor_id: auth!.user.id, prospect_id: prospectId ?? null,
        titulo, data, hora: hora || null, observacao: obs || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lembrete criado");
      setOpen(false); setTitulo(""); setHora(""); setObs("");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> Novo lembrete</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo lembrete</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Título</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ligar para Dr. João" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><Label>Hora (opcional)</Label><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
          </div>
          <div><Label>Observação</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => titulo && save.mutate()} disabled={save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
