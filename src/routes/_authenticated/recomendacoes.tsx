import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/lilito/PageHeader";
import { EmptyState } from "@/components/lilito/EmptyState";
import { Plus, Users2, Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/_authenticated/recomendacoes")({
  head: () => ({ meta: [{ title: "Recomendações — LILITO" }] }),
  component: Recomendacoes,
});

const ORIGENS = [
  { v: "recomendacao", l: "Recomendação" },
  { v: "prospeccao_ativa", l: "Prospecção Ativa" },
  { v: "hospital", l: "Hospital" },
  { v: "evento", l: "Evento" },
  { v: "redes_sociais", l: "Redes Sociais" },
  { v: "parceria", l: "Parceria" },
  { v: "reativacao", l: "Reativação" },
];

function whatsappLink(tel: string, msg = "Olá, aqui é da VINCA Assessoria.") {
  const num = tel.replace(/\D/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

function Recomendacoes() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: prospects } = useQuery({
    queryKey: ["prospects"],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase.from("prospects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Originação"
        title="Recomendações"
        description="Cadastro e qualificação de prospects."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gold-gradient text-background"><Plus className="h-4 w-4 mr-2" />Novo prospect</Button>
            </DialogTrigger>
            <NovoProspectDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["prospects"] }); }} />
          </Dialog>
        }
      />

      {!prospects || prospects.length === 0 ? (
        <EmptyState icon={Users2} title="Nenhum prospect cadastrado" description="Comece pelo primeiro nome da sua lista. Quem foi a última pessoa que te recomendou?" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prospects.map((p: any) => (
            <Card key={p.id} className="p-5 bg-surface border-border hover:border-gold/40 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-xl text-foreground">{p.nome}</h3>
                  {p.especialidade_medica && <p className="text-xs text-muted-foreground">{p.especialidade_medica}</p>}
                </div>
                <span className="caps-tracking text-gold text-[0.65rem]">{p.etapa_funil}</span>
              </div>
              <div className="hairline-gold my-3 opacity-40" />
              <div className="text-xs text-muted-foreground space-y-1">
                {p.cidade && <p>📍 {p.cidade}</p>}
                {p.quem_recomendou && <p>Recomendado por {p.quem_recomendou}</p>}
                <p>Score: <span className="text-gold">{p.nota_qualificacao}/40</span></p>
              </div>
              {p.telefone && (
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <a href={`tel:${p.telefone}`}><Phone className="h-3 w-3 mr-1" />Ligar</a>
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" asChild>
                    <a href={whatsappLink(p.telefone)} target="_blank" rel="noreferrer"><MessageCircle className="h-3 w-3 mr-1" />WhatsApp</a>
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NovoProspectDialog({ onClose }: { onClose: () => void }) {
  const { auth } = useAuth();
  const [f, setF] = useState<any>({
    nome: "", telefone: "", cidade: "", especialidade_medica: "", quem_recomendou: "",
    observacoes: "", origem: "recomendacao",
    score_patrimonio: 5, score_renda: 5, score_necessidade: 5, score_influencia: 5,
    pa_estimado: 0, renda_estimada: 0, patrimonio_estimado: 0,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!auth) return;
    setSaving(true);
    const { error } = await supabase.from("prospects").insert({ ...f, consultor_id: auth.user.id });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Prospect cadastrado.");
    onClose();
  }

  return (
    <DialogContent className="max-w-2xl bg-surface border-border max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="font-display text-2xl">Novo prospect</DialogTitle></DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label>Nome completo *</Label>
          <Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        </div>
        <div className="space-y-1.5"><Label>Telefone</Label>
          <Input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Cidade</Label>
          <Input value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Especialidade médica</Label>
          <Input value={f.especialidade_medica} onChange={(e) => setF({ ...f, especialidade_medica: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Quem recomendou</Label>
          <Input value={f.quem_recomendou} onChange={(e) => setF({ ...f, quem_recomendou: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Renda estimada (R$)</Label>
          <Input type="number" value={f.renda_estimada} onChange={(e) => setF({ ...f, renda_estimada: Number(e.target.value) })} /></div>
        <div className="space-y-1.5"><Label>Patrimônio estimado (R$)</Label>
          <Input type="number" value={f.patrimonio_estimado} onChange={(e) => setF({ ...f, patrimonio_estimado: Number(e.target.value) })} /></div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Origem</Label>
          <Select value={f.origem} onValueChange={(v) => setF({ ...f, origem: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ORIGENS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          {[
            ["score_patrimonio","Patrimônio"],
            ["score_renda","Renda"],
            ["score_necessidade","Necessidade"],
            ["score_influencia","Influência"],
          ].map(([k, l]) => (
            <div key={k} className="space-y-1.5">
              <Label>{l}: <span className="text-gold">{f[k]}/10</span></Label>
              <Slider value={[f[k]]} min={0} max={10} step={1} onValueChange={([v]) => setF({ ...f, [k]: v })} />
            </div>
          ))}
        </div>
        <div className="space-y-1.5 md:col-span-2"><Label>Observações</Label>
          <Textarea value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving || !f.nome} className="gold-gradient text-background">
          {saving ? "Salvando..." : "Cadastrar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
