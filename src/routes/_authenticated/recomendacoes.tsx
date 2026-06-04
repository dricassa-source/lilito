import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/lilito/PageHeader";
import { EmptyState } from "@/components/lilito/EmptyState";
import { Plus, Users2, Flame, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recomendacoes")({
  head: () => ({ meta: [{ title: "Recomendações — LILITO" }] }),
  component: Recomendacoes,
});

const ETAPA_LABEL: Record<string, string> = {
  recomendacao: "Recomendação", hot: "HOT", ab: "AB", analise_apolice: "Análise de Apólice",
  fechamento: "Fechamento", implantacao: "Implantação", cliente: "Cliente",
  pos_venda: "Pós-venda", perdido: "Perdido",
};

const ESTADO_CIVIL = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"];

function brl(n: number | null | undefined) {
  if (!n) return "—";
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function Recomendacoes() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: prospects } = useQuery({
    queryKey: ["prospects"],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects").select("*")
        .neq("etapa_funil", "perdido")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function enviarParaHot(p: any) {
    if (!auth) return;
    const now = new Date().toISOString();
    const [u, a] = await Promise.all([
      supabase.from("prospects").update({
        etapa_funil: "hot", status_hot: "pendente", entrou_etapa_em: now, ultima_interacao: now,
      }).eq("id", p.id),
      supabase.from("atividades").insert({
        consultor_id: auth.user.id, prospect_id: p.id, tipo: "ligacao",
        resultado: "enviado_para_hot", observacao: "Prospect enviado para fila HOT",
      }),
    ]);
    if (u.error) return toast.error(u.error.message);
    toast.success("Enviado para HOT.");
    qc.invalidateQueries({ queryKey: ["prospects"] });
  }

  async function marcarPerdido(p: any) {
    if (!auth) return;
    const motivo = window.prompt("Motivo da perda?") ?? "";
    const { error } = await supabase.from("prospects").update({
      etapa_funil: "perdido", motivo_perda: motivo, ultima_interacao: new Date().toISOString(),
    }).eq("id", p.id);
    if (error) return toast.error(error.message);
    await supabase.from("atividades").insert({
      consultor_id: auth.user.id, prospect_id: p.id, tipo: "ligacao",
      resultado: "perdido", observacao: motivo,
    });
    toast.success("Marcado como perdido.");
    qc.invalidateQueries({ queryKey: ["prospects"] });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Originação"
        title="Recomendações"
        description="Gestão de prospects e envio para a fila HOT."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gold-gradient text-background">
                <Plus className="h-4 w-4 mr-2" />Novo prospect
              </Button>
            </DialogTrigger>
            <NovoProspectDialog onClose={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["prospects"] });
            }} />
          </Dialog>
        }
      />

      {!prospects || prospects.length === 0 ? (
        <EmptyState icon={Users2} title="Nenhum prospect cadastrado"
          description="Comece pelo primeiro nome da sua lista. Quem foi a última pessoa que te recomendou?" />
      ) : (
        <Card className="bg-surface border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Profissão</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Dias</TableHead>
                <TableHead className="text-right">Renda est.</TableHead>
                <TableHead>Recomendante</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{p.especialidade_medica ?? "—"}</TableCell>
                  <TableCell><span className="caps-tracking text-gold text-[0.65rem]">{ETAPA_LABEL[p.etapa_funil] ?? p.etapa_funil}</span></TableCell>
                  <TableCell className="text-right text-muted-foreground">{diasDesde(p.created_at)}d</TableCell>
                  <TableCell className="text-right">{brl(p.renda_estimada)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.quem_recomendou ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {p.etapa_funil !== "hot" && (
                        <Button size="sm" variant="outline" onClick={() => enviarParaHot(p)} className="border-gold/40 hover:text-gold">
                          <Flame className="h-3 w-3 mr-1" />HOT
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => marcarPerdido(p)} className="text-muted-foreground hover:text-destructive">
                        <XCircle className="h-3 w-3 mr-1" />Perdido
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function NovoProspectDialog({ onClose }: { onClose: () => void }) {
  const { auth } = useAuth();
  const [f, setF] = useState<any>({
    nome: "", telefone: "", profissao: "", estado_civil: "", possui_filhos: "nao",
    renda_estimada: 0, patrimonio_estimado: 0, quem_recomendou: "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!auth || !f.nome) return;
    setSaving(true);
    const { error } = await supabase.from("prospects").insert({
      consultor_id: auth.user.id,
      nome: f.nome,
      telefone: f.telefone || null,
      especialidade_medica: f.profissao || null,
      estado_civil: f.estado_civil || null,
      filhos: f.possui_filhos === "sim" ? 1 : 0,
      renda_estimada: Number(f.renda_estimada) || null,
      patrimonio_estimado: Number(f.patrimonio_estimado) || null,
      quem_recomendou: f.quem_recomendou || null,
      origem: "recomendacao",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Prospect cadastrado.");
    onClose();
  }

  return (
    <DialogContent className="max-w-xl bg-surface border-border max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="font-display text-2xl">Novo prospect</DialogTitle></DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label>Nome *</Label>
          <Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Profissão</Label>
          <Input value={f.profissao} onChange={(e) => setF({ ...f, profissao: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Estado civil</Label>
          <Select value={f.estado_civil} onValueChange={(v) => setF({ ...f, estado_civil: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {ESTADO_CIVIL.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Possui filhos</Label>
          <Select value={f.possui_filhos} onValueChange={(v) => setF({ ...f, possui_filhos: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Renda estimada (R$)</Label>
          <Input type="number" value={f.renda_estimada} onChange={(e) => setF({ ...f, renda_estimada: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Patrimônio estimado (R$)</Label>
          <Input type="number" value={f.patrimonio_estimado} onChange={(e) => setF({ ...f, patrimonio_estimado: e.target.value })} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Recomendante</Label>
          <Input value={f.quem_recomendou} onChange={(e) => setF({ ...f, quem_recomendou: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving || !f.nome} className="gold-gradient text-background">
          {saving ? "Salvando..." : "Cadastrar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
