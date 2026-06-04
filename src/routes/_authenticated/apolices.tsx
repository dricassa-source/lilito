import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/lilito/PageHeader";
import { EmptyState } from "@/components/lilito/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Sparkles, Upload, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/apolices")({
  head: () => ({ meta: [{ title: "Análise de Apólices — LILITO" }] }),
  component: Apolices,
});

const SEGURADORAS = [
  ["metlife","MetLife"],["prudential","Prudential"],["icatu","Icatu"],["mag","MAG"],
  ["bradesco","Bradesco"],["sulamerica","SulAmérica"],["porto","Porto"],["azos","Azos"],["outra","Outra"],
];

const STATUS_LABEL: Record<string,string> = {
  nao_analisado: "Não analisado", em_processamento: "Em processamento", concluido: "Concluído", erro: "Erro",
};

function Apolices() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const { data: apolices } = useQuery({
    queryKey: ["apolices"],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase.from("apolices").select("*,clientes(nome),prospects(nome)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const grouped: Record<string, any[]> = {};
  (apolices ?? []).forEach((a: any) => {
    grouped[a.seguradora] = grouped[a.seguradora] ?? []; grouped[a.seguradora].push(a);
  });

  return (
    <div>
      <PageHeader
        eyebrow="Estratégia VINCA" title="Análise de Apólices"
        description="Upload, análise consultiva e estratégia de migração."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gold-gradient text-background"><Plus className="h-4 w-4 mr-2" />Nova apólice</Button></DialogTrigger>
            <NovaApoliceDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["apolices"] }); }} />
          </Dialog>
        }
      />

      {!apolices || apolices.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhuma apólice cadastrada"
          description="Faça upload da primeira apólice para iniciar a análise consultiva." />
      ) : (
        <div className="space-y-8">
          {SEGURADORAS.map(([key, label]) => {
            const items = grouped[key] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={key}>
                <div className="flex items-center gap-3 mb-3">
                  <p className="caps-tracking text-gold">{label}</p>
                  <div className="flex-1 hairline-gold opacity-30" />
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((a: any) => (
                    <Card key={a.id} className="p-4 bg-surface border-border hover:border-gold/40 cursor-pointer transition-colors" onClick={() => setSelected(a)}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{a.clientes?.nome ?? a.prospects?.nome ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{a.produto ?? "—"}</p>
                        </div>
                        <Badge variant="outline" className="caps-tracking text-[0.6rem]">{a.status}</Badge>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Capital: R$ {Number(a.capital_segurado ?? 0).toLocaleString("pt-BR")}
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-gold" />
                        <span className="text-[0.65rem] text-muted-foreground">{STATUS_LABEL[a.status_analise_ia]}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && <ApoliceDetail apolice={selected} onClose={() => { setSelected(null); qc.invalidateQueries({ queryKey: ["apolices"] }); }} />}
      </Dialog>
    </div>
  );
}

function NovaApoliceDialog({ onClose }: { onClose: () => void }) {
  const { auth } = useAuth();
  const [f, setF] = useState<any>({ seguradora: "outra", produto: "", tipo: "whole_life", capital_segurado: 0, premio_atual: 0, prazo: "", status: "em_analise" });
  const [clienteId, setClienteId] = useState("");

  const { data: clientes } = useQuery({
    queryKey: ["clientes-min"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome")).data ?? [],
  });
  const { data: prospects } = useQuery({
    queryKey: ["prospects-min"],
    queryFn: async () => (await supabase.from("prospects").select("id,nome")).data ?? [],
  });

  async function save() {
    if (!auth) return;
    const isCliente = clienteId.startsWith("c:");
    const targetId = clienteId.slice(2);
    if (!targetId) { toast.error("Selecione cliente ou prospect."); return; }
    const { error } = await supabase.from("apolices").insert({
      ...f, consultor_id: auth.user.id,
      cliente_id: isCliente ? targetId : null,
      prospect_id: !isCliente ? targetId : null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Apólice cadastrada.");
    onClose();
  }

  return (
    <DialogContent className="bg-surface border-border max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="font-display text-2xl">Nova apólice</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Cliente ou Prospect</Label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {(clientes ?? []).map((c: any) => <SelectItem key={`c:${c.id}`} value={`c:${c.id}`}>👤 {c.nome}</SelectItem>)}
              {(prospects ?? []).map((p: any) => <SelectItem key={`p:${p.id}`} value={`p:${p.id}`}>🌱 {p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Seguradora</Label>
            <Select value={f.seguradora} onValueChange={(v) => setF({ ...f, seguradora: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SEGURADORAS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1.5"><Label>Tipo</Label>
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="whole_life">Whole Life</SelectItem>
                <SelectItem value="temporario">Temporário</SelectItem>
              </SelectContent>
            </Select></div>
        </div>
        <div className="space-y-1.5"><Label>Produto</Label><Input value={f.produto} onChange={(e) => setF({ ...f, produto: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Capital segurado (R$)</Label><Input type="number" value={f.capital_segurado} onChange={(e) => setF({ ...f, capital_segurado: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Prêmio atual (R$)</Label><Input type="number" value={f.premio_atual} onChange={(e) => setF({ ...f, premio_atual: Number(e.target.value) })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Prazo</Label><Input value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={save} className="gold-gradient text-background">Cadastrar</Button></DialogFooter>
    </DialogContent>
  );
}

function ApoliceDetail({ apolice, onClose }: { apolice: any; onClose: () => void }) {
  const { auth } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [observ, setObserv] = useState(apolice.observacoes_consultor ?? "");
  const [estrat, setEstrat] = useState(apolice.estrategia_recomendacao ?? "");

  async function upload(file: File) {
    if (!auth) return;
    setUploading(true);
    const path = `${auth.user.id}/${apolice.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("apolices-pdf").upload(path, file, { upsert: true, contentType: "application/pdf" });
    if (error) { toast.error(error.message); setUploading(false); return; }
    await supabase.from("apolices").update({ pdf_path: path }).eq("id", apolice.id);
    toast.success("PDF anexado.");
    setUploading(false);
    onClose();
  }

  async function downloadPdf() {
    if (!apolice.pdf_path) return;
    const { data, error } = await supabase.storage.from("apolices-pdf").createSignedUrl(apolice.pdf_path, 300);
    if (error || !data) { toast.error("Falha ao gerar link."); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function saveCampos() {
    await supabase.from("apolices").update({ observacoes_consultor: observ, estrategia_recomendacao: estrat }).eq("id", apolice.id);
    toast.success("Salvo.");
  }

  function analisarIA() {
    toast.message("Função disponível na próxima versão.", {
      description: "A análise por IA entra na Fase 1.1 — schema e UI já estão prontos.",
    });
  }

  return (
    <DialogContent className="bg-background border-border max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-3xl">
          {apolice.clientes?.nome ?? apolice.prospects?.nome ?? "Apólice"}
        </DialogTitle>
        <p className="caps-tracking text-gold">{SEGURADORAS.find(([k]) => k === apolice.seguradora)?.[1]} · {apolice.produto}</p>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3 text-sm border-y border-border py-4">
        <div><p className="caps-tracking text-muted-foreground text-[0.65rem]">Capital</p><p>R$ {Number(apolice.capital_segurado ?? 0).toLocaleString("pt-BR")}</p></div>
        <div><p className="caps-tracking text-muted-foreground text-[0.65rem]">Prêmio</p><p>R$ {Number(apolice.premio_atual ?? 0).toLocaleString("pt-BR")}</p></div>
        <div><p className="caps-tracking text-muted-foreground text-[0.65rem]">Tipo</p><p>{apolice.tipo}</p></div>
        <div><p className="caps-tracking text-muted-foreground text-[0.65rem]">Status</p><Badge variant="outline">{apolice.status}</Badge></div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="outline">
            <Upload className="h-4 w-4 mr-2" />{apolice.pdf_path ? "Substituir PDF" : "Anexar PDF"}
          </Button>
          {apolice.pdf_path && (
            <Button onClick={downloadPdf} variant="ghost"><Download className="h-4 w-4 mr-2" />Baixar</Button>
          )}
        </div>

        <div className="space-y-1.5"><Label>Observações do consultor</Label>
          <Textarea value={observ} onChange={(e) => setObserv(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Estratégia de recomendação</Label>
          <Textarea value={estrat} onChange={(e) => setEstrat(e.target.value)} /></div>
        <Button onClick={saveCampos} variant="outline" size="sm">Salvar campos</Button>
      </div>

      {/* SEÇÃO IA — preparada para Fase 1.1 */}
      <div className="mt-6 rounded-md border border-gold/30 bg-gradient-to-br from-surface to-surface-elevated p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            <h3 className="font-display text-xl">Análise por IA</h3>
            <Badge variant="outline" className="caps-tracking text-[0.6rem] border-gold/40 text-gold">
              {STATUS_LABEL[apolice.status_analise_ia]}
            </Badge>
          </div>
          <Button onClick={analisarIA} className="gold-gradient text-background">
            <Sparkles className="h-4 w-4 mr-2" />Analisar com IA
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <IACard title="Resumo executivo" content={apolice.resumo_ia} />
          <IACard title="Observações da IA" content={apolice.observacoes_ia} />
          <IAList title="Pontos fortes" items={apolice.pontos_fortes} variant="positive" />
          <IAList title="Pontos fracos" items={apolice.pontos_fracos} variant="negative" />
          <IACard title="Comparativo MetLife" content={apolice.comparativo_metlife ? JSON.stringify(apolice.comparativo_metlife) : null} className="md:col-span-2" />
        </div>

        <p className="text-[0.7rem] text-muted-foreground mt-4 text-right">
          {apolice.ultima_analise_ia ? `Última análise: ${new Date(apolice.ultima_analise_ia).toLocaleString("pt-BR")}` : "Aguardando primeira análise"}
        </p>
      </div>
    </DialogContent>
  );
}

function IACard({ title, content, className = "" }: { title: string; content: string | null; className?: string }) {
  return (
    <Card className={`p-4 bg-surface/60 border-border ${className}`}>
      <p className="caps-tracking text-muted-foreground text-[0.65rem] mb-2">{title}</p>
      {content ? <p className="text-sm text-foreground/80">{content}</p> : <p className="text-xs text-muted-foreground italic">Aguardando primeira análise</p>}
    </Card>
  );
}

function IAList({ title, items, variant }: { title: string; items: any; variant: "positive" | "negative" }) {
  const color = variant === "positive" ? "text-gold" : "text-destructive";
  const arr = Array.isArray(items) ? items : [];
  return (
    <Card className="p-4 bg-surface/60 border-border">
      <p className="caps-tracking text-muted-foreground text-[0.65rem] mb-2">{title}</p>
      {arr.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aguardando primeira análise</p>
      ) : (
        <ul className="space-y-1">{arr.map((it: string, i: number) => <li key={i} className={`text-sm ${color}`}>• {it}</li>)}</ul>
      )}
    </Card>
  );
}
