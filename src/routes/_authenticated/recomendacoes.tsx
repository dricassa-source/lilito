import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ScoreStars } from "@/components/lilito/ScoreStars";
import { Plus, Users2, Flame, XCircle, Pencil, Search, Trophy } from "lucide-react";
import { toast } from "sonner";

function tempoEtapaDot(dias: number) {
  if (dias <= 7) return { cor: "bg-emerald-500", label: "Recente" };
  if (dias <= 14) return { cor: "bg-yellow-500", label: "Atenção" };
  return { cor: "bg-red-500", label: "Crítico" };
}

export const Route = createFileRoute("/_authenticated/recomendacoes")({
  head: () => ({ meta: [{ title: "Recomendações — LILITO" }] }),
  component: Recomendacoes,
});

const ETAPA_LABEL: Record<string, string> = {
  recomendacao: "Originação", hot: "HOT", ab: "AB", analise_apolice: "Análise de Apólice",
  revisita: "Revisita", fechamento: "Fechamento", entrega_apolice: "Entrega de Apólice",
  implantacao: "Implantação", cliente: "Cliente", pos_venda: "Pós-venda", perdido: "Perdido",
};

const ETAPA_BADGE_CLASS: Record<string, string> = {
  recomendacao: "bg-muted text-foreground border-border",
  hot: "bg-[color:var(--nat-ab,#facc15)]/15 text-[color:var(--nat-ab,#facc15)] border-[color:var(--nat-ab,#facc15)]/40",
  ab: "bg-[color:var(--nat-ab,#facc15)]/20 text-[color:var(--nat-ab,#facc15)] border-[color:var(--nat-ab,#facc15)]/40",
  revisita: "bg-[color:var(--nat-revisita,#3b82f6)]/15 text-[color:var(--nat-revisita,#3b82f6)] border-[color:var(--nat-revisita,#3b82f6)]/40",
  fechamento: "bg-[color:var(--nat-fechamento,#22c55e)]/15 text-[color:var(--nat-fechamento,#22c55e)] border-[color:var(--nat-fechamento,#22c55e)]/40",
  entrega_apolice: "bg-[color:var(--nat-entrega,#a78bfa)]/15 text-[color:var(--nat-entrega,#a78bfa)] border-[color:var(--nat-entrega,#a78bfa)]/40",
  analise_apolice: "bg-secondary text-secondary-foreground border-border",
  implantacao: "bg-secondary text-secondary-foreground border-border",
  cliente: "bg-gold/15 text-gold border-gold/40",
  pos_venda: "bg-gold/10 text-gold border-gold/30",
  perdido: "bg-destructive/15 text-destructive border-destructive/40",
};

const ESTADO_CIVIL = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"];

function brl(n: number | null | undefined) {
  if (!n) return "—";
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function orneScore(p: any): number {
  // Score automático (1-5) calculado pelo trigger. Fallback para 1 quando ausente.
  return p.score ?? 1;
}

function Recomendacoes() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [perfil, setPerfil] = useState<any>(null);
  const [editar, setEditar] = useState<any>(null);

  const [q, setQ] = useState("");
  const [fEtapa, setFEtapa] = useState("all");
  const [fProfissao, setFProfissao] = useState("all");
  const [fEstado, setFEstado] = useState("all");
  const [fFilhos, setFFilhos] = useState("all");
  const [fRecom, setFRecom] = useState("all");
  const [mostrarPerdidos, setMostrarPerdidos] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);

  const { data: prospects } = useQuery({
    queryKey: ["prospects"],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects").select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const profissoes = useMemo(
    () => Array.from(new Set((prospects ?? []).map((p: any) => p.especialidade_medica).filter(Boolean))) as string[],
    [prospects],
  );
  const recomendantes = useMemo(
    () => Array.from(new Set((prospects ?? []).map((p: any) => p.quem_recomendou).filter(Boolean))) as string[],
    [prospects],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (prospects ?? []).filter((p: any) => {
      if (!mostrarPerdidos && p.etapa_funil === "perdido") return false;
      if (term) {
        const hay = `${p.nome ?? ""} ${p.telefone ?? ""} ${p.quem_recomendou ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (fEtapa !== "all" && p.etapa_funil !== fEtapa) return false;
      if (fProfissao !== "all" && p.especialidade_medica !== fProfissao) return false;
      if (fEstado !== "all" && p.estado_civil !== fEstado) return false;
      if (fFilhos === "com" && !(p.filhos && p.filhos > 0)) return false;
      if (fFilhos === "sem" && p.filhos && p.filhos > 0) return false;
      if (fRecom !== "all" && p.quem_recomendou !== fRecom) return false;
      return true;
    });
  }, [prospects, q, fEtapa, fProfissao, fEstado, fFilhos, fRecom, mostrarPerdidos]);

  const rankingRecomendantes = useMemo(() => {
    const map = new Map<string, { total: number; clientes: number; pa: number }>();
    for (const p of (prospects ?? []) as any[]) {
      const r = (p.quem_recomendou ?? "").trim();
      if (!r) continue;
      const cur = map.get(r) ?? { total: 0, clientes: 0, pa: 0 };
      cur.total += 1;
      if (p.etapa_funil === "cliente" || p.etapa_funil === "pos_venda") cur.clientes += 1;
      cur.pa += Number(p.pa_estimado ?? 0);
      map.set(r, cur);
    }
    return Array.from(map.entries())
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }, [prospects]);

  async function enviarParaHot(p: any) {
    if (!auth) return;
    const now = new Date().toISOString();
    const [u] = await Promise.all([
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
        title="Prospects da unidade"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRankingOpen(true)}>
              <Trophy className="h-4 w-4 mr-2" />Ranking
            </Button>
            <Button
              variant={mostrarPerdidos ? "default" : "outline"}
              onClick={() => setMostrarPerdidos((v) => !v)}
              title="Incluir prospects marcados como perdidos"
            >
              <XCircle className="h-4 w-4 mr-2" />{mostrarPerdidos ? "Ocultar perdidos" : "Mostrar perdidos"}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gold-gradient text-background">
                  <Plus className="h-4 w-4 mr-2" />Novo prospect
                </Button>
              </DialogTrigger>
              <ProspectDialog onClose={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["prospects"] });
              }} />
            </Dialog>
          </div>
        }
      />

      <Dialog open={rankingOpen} onOpenChange={setRankingOpen}>
        <DialogContent className="max-w-lg bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold" /> Ranking de Recomendantes
            </DialogTitle>
          </DialogHeader>
          {rankingRecomendantes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum recomendante registrado ainda.</p>
          ) : (
            <ol className="divide-y divide-border max-h-[60vh] overflow-y-auto">
              {rankingRecomendantes.map((r, idx) => (
                <li key={r.nome} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`font-display text-xl w-7 ${idx === 0 ? "text-gold" : "text-muted-foreground"}`}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="text-foreground truncate">{r.nome}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{r.total} indicação{r.total > 1 ? "ões" : ""}</p>
                    <p className="text-xs text-muted-foreground">{r.clientes} cliente(s) · {brl(r.pa)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>


      <Card className="bg-surface border-border p-4 mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, telefone ou recomendante..."
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Select value={fEtapa} onValueChange={setFEtapa}>
            <SelectTrigger><SelectValue placeholder="Etapa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {Object.entries(ETAPA_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fProfissao} onValueChange={setFProfissao}>
            <SelectTrigger><SelectValue placeholder="Profissão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as profissões</SelectItem>
              {profissoes.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fEstado} onValueChange={setFEstado}>
            <SelectTrigger><SelectValue placeholder="Estado civil" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos estados civis</SelectItem>
              {ESTADO_CIVIL.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fFilhos} onValueChange={setFFilhos}>
            <SelectTrigger><SelectValue placeholder="Filhos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Com / sem filhos</SelectItem>
              <SelectItem value="com">Com filhos</SelectItem>
              <SelectItem value="sem">Sem filhos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fRecom} onValueChange={setFRecom}>
            <SelectTrigger><SelectValue placeholder="Recomendante" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos recomendantes</SelectItem>
              {recomendantes.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {!filtered || filtered.length === 0 ? (
        <EmptyState icon={Users2} title="Nenhum prospect encontrado"
          description="Ajuste os filtros ou cadastre um novo prospect para começar." />
      ) : (
        <Card className="bg-surface border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Profissão</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Tempo etapa</TableHead>
                <TableHead className="text-right">Renda est.</TableHead>
                <TableHead>Recomendante</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: any) => {
                const score = orneScore(p);
                const dias = diasDesde(p.entrou_etapa_em ?? p.created_at);
                const dot = tempoEtapaDot(dias);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <button
                        onClick={() => setPerfil(p)}
                        className="font-medium text-left hover:text-gold transition-colors cursor-pointer"
                      >
                        {p.nome}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.especialidade_medica ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ETAPA_BADGE_CLASS[p.etapa_funil] ?? ""}>
                        {ETAPA_LABEL[p.etapa_funil] ?? p.etapa_funil}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <ScoreStars score={score} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground" title={dot.label}>
                        <span className={`h-2 w-2 rounded-full ${dot.cor}`} />
                        {dias}d
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{brl(p.renda_estimada)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.quem_recomendou ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.etapa_funil !== "hot" && p.etapa_funil !== "perdido" && (
                          <Button size="icon" variant="ghost" onClick={() => enviarParaHot(p)} title="Enviar para HOT" className="hover:text-gold">
                            <Flame className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => setEditar(p)} title="Editar prospect">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {p.etapa_funil !== "perdido" && (
                          <Button size="icon" variant="ghost" onClick={() => marcarPerdido(p)} title="Marcar como perdido" className="hover:text-destructive">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!perfil} onOpenChange={(v) => !v && setPerfil(null)}>
        {perfil && (
          <PerfilDialog
            prospect={perfil}
            onEdit={() => { setEditar(perfil); setPerfil(null); }}
            onClose={() => setPerfil(null)}
          />
        )}
      </Dialog>

      <Dialog open={!!editar} onOpenChange={(v) => !v && setEditar(null)}>
        {editar && (
          <ProspectDialog
            prospect={editar}
            onClose={() => {
              setEditar(null);
              qc.invalidateQueries({ queryKey: ["prospects"] });
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function PerfilDialog({ prospect, onEdit, onClose }: { prospect: any; onEdit: () => void; onClose: () => void }) {
  const p = prospect;
  const score = orneScore(p);
  return (
    <DialogContent className="max-w-2xl bg-surface border-border max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl flex items-center gap-3">
          {p.nome}
          <Badge variant="outline" className={ETAPA_BADGE_CLASS[p.etapa_funil] ?? ""}>
            {ETAPA_LABEL[p.etapa_funil] ?? p.etapa_funil}
          </Badge>
        </DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <Field label="Telefone" value={p.telefone} />
        <Field label="Cidade" value={p.cidade} />
        <Field label="Profissão / Especialidade" value={p.especialidade_medica} />
        <Field label="Estado civil" value={p.estado_civil} />
        <Field label="Cônjuge" value={p.conjuge} />
        <Field label="Filhos" value={p.filhos ? String(p.filhos) : "Sem filhos"} />
        <Field label="Renda estimada" value={brl(p.renda_estimada)} />
        <Field label="Patrimônio estimado" value={brl(p.patrimonio_estimado)} />
        <Field label="PA estimado" value={brl(p.pa_estimado)} />
        <Field label="ORN-E (pontuação)" value={score > 0 ? String(score) : "—"} />
        <Field label="Recomendante" value={p.quem_recomendou} />
        <Field label="Origem" value={p.origem} />
        <Field label="Data de nascimento" value={p.data_nascimento} />
        <Field label="Última interação" value={p.ultima_interacao ? new Date(p.ultima_interacao).toLocaleString("pt-BR") : null} />
        {p.observacoes && (
          <div className="md:col-span-2">
            <div className="caps-tracking text-[0.65rem] text-muted-foreground mb-1">Observações</div>
            <div className="text-foreground whitespace-pre-wrap">{p.observacoes}</div>
          </div>
        )}
        {p.motivo_perda && (
          <div className="md:col-span-2">
            <div className="caps-tracking text-[0.65rem] text-destructive mb-1">Motivo da perda</div>
            <div className="text-foreground">{p.motivo_perda}</div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Fechar</Button>
        <Button onClick={onEdit} className="gold-gradient text-background">
          <Pencil className="h-4 w-4 mr-2" />Editar prospect
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="caps-tracking text-[0.65rem] text-muted-foreground mb-1">{label}</div>
      <div className="text-foreground">{value || "—"}</div>
    </div>
  );
}

function ProspectDialog({ onClose, prospect }: { onClose: () => void; prospect?: any }) {
  const { auth } = useAuth();
  const isEdit = !!prospect;
  const [f, setF] = useState<any>(() => prospect ? {
    nome: prospect.nome ?? "",
    telefone: prospect.telefone ?? "",
    profissao: prospect.especialidade_medica ?? "",
    estado_civil: prospect.estado_civil ?? "",
    possui_filhos: prospect.filhos && prospect.filhos > 0 ? "sim" : "nao",
    renda_estimada: prospect.renda_estimada ?? 0,
    patrimonio_estimado: prospect.patrimonio_estimado ?? 0,
    quem_recomendou: prospect.quem_recomendou ?? "",
    observacoes: prospect.observacoes ?? "",
  } : {
    nome: "", telefone: "", profissao: "", estado_civil: "", possui_filhos: "nao",
    renda_estimada: 0, patrimonio_estimado: 0, quem_recomendou: "", observacoes: "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!auth || !f.nome) return;
    setSaving(true);
    const payload: any = {
      nome: f.nome,
      telefone: f.telefone || null,
      especialidade_medica: f.profissao || null,
      estado_civil: f.estado_civil || null,
      filhos: f.possui_filhos === "sim" ? (prospect?.filhos && prospect.filhos > 0 ? prospect.filhos : 1) : 0,
      renda_estimada: Number(f.renda_estimada) || null,
      patrimonio_estimado: Number(f.patrimonio_estimado) || null,
      quem_recomendou: f.quem_recomendou || null,
      observacoes: f.observacoes || null,
    };
    const { error } = isEdit
      ? await supabase.from("prospects").update(payload).eq("id", prospect.id)
      : await supabase.from("prospects").insert({ ...payload, consultor_id: auth.user.id, origem: "recomendacao" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isEdit ? "Prospect atualizado." : "Prospect cadastrado.");
    onClose();
  }

  return (
    <DialogContent className="max-w-xl bg-surface border-border max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="font-display text-2xl">{isEdit ? "Editar prospect" : "Novo prospect"}</DialogTitle></DialogHeader>
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
        <div className="space-y-1.5 md:col-span-2">
          <Label>Observações</Label>
          <Input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving || !f.nome} className="gold-gradient text-background">
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
