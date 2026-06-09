import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConsultorScope, applyScope } from "@/hooks/useConsultorScope";
import { ConsultorFilter } from "@/components/lilito/ConsultorFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/lilito/PageHeader";
import { EmptyState } from "@/components/lilito/EmptyState";
import { ScoreStars } from "@/components/lilito/ScoreStars";
import { Plus, Users2, Flame, XCircle, Pencil, Search, Trophy, Trash2 } from "lucide-react";
import { toast } from "sonner";

// ─── helpers ────────────────────────────────────────────────────────────────

function tempoEtapaDot(dias: number) {
  if (dias <= 9) return { cor: "bg-emerald-500", label: "Recente" };
  if (dias <= 19) return { cor: "bg-yellow-500", label: "Atenção" };
  return { cor: "bg-red-500", label: "Crítico" };
}

function brl(n: number | null | undefined) {
  if (!n) return "—";
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function orneScore(p: any): number {
  return p.score ?? 1;
}

// ─── constants ───────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/recomendacoes")({
  head: () => ({ meta: [{ title: "Recomendações — LILITO" }] }),
  component: Recomendacoes,
});

const ETAPA_LABEL: Record<string, string> = {
  recomendacao: "Originação",
  hot: "HOT",
  ab: "AB",
  analise_apolice: "Análise de Apólice",
  revisita: "Revisita",
  fechamento: "Fechamento",
  entrega_apolice: "Entrega de Apólice",
  implantacao: "Implantação",
  cliente: "Cliente",
  pos_venda: "Pós-venda",
  perdido: "Perdido",
};

const ETAPA_BADGE_CLASS: Record<string, string> = {
  recomendacao: "bg-muted text-foreground border-border",
  hot: "bg-[color:var(--nat-ab,#facc15)]/15 text-[color:var(--nat-ab,#facc15)] border-[color:var(--nat-ab,#facc15)]/40",
  ab: "bg-[color:var(--nat-ab,#facc15)]/20 text-[color:var(--nat-ab,#facc15)] border-[color:var(--nat-ab,#facc15)]/40",
  revisita:
    "bg-[color:var(--nat-revisita,#3b82f6)]/15 text-[color:var(--nat-revisita,#3b82f6)] border-[color:var(--nat-revisita,#3b82f6)]/40",
  fechamento:
    "bg-[color:var(--nat-fechamento,#22c55e)]/15 text-[color:var(--nat-fechamento,#22c55e)] border-[color:var(--nat-fechamento,#22c55e)]/40",
  entrega_apolice:
    "bg-[color:var(--nat-entrega,#a78bfa)]/15 text-[color:var(--nat-entrega,#a78bfa)] border-[color:var(--nat-entrega,#a78bfa)]/40",
  analise_apolice: "bg-secondary text-secondary-foreground border-border",
  implantacao: "bg-secondary text-secondary-foreground border-border",
  cliente: "bg-gold/15 text-gold border-gold/40",
  pos_venda: "bg-gold/10 text-gold border-gold/30",
  perdido: "bg-destructive/15 text-destructive border-destructive/40",
};

const ESTADO_CIVIL = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"];

// Mapeamento label → valor do ENUM no banco (origem_prospect)
const ORIGENS: { label: string; value: string }[] = [
  { label: "Recomendação", value: "recomendacao" },
  { label: "Prospecção Ativa", value: "prospeccao_ativa" },
  { label: "Hospital", value: "hospital" },
  { label: "Evento", value: "evento" },
  { label: "Redes Sociais", value: "redes_sociais" },
  { label: "Parceria", value: "parceria" },
  { label: "Reativação", value: "reativacao" },
];

function origemLabel(value: string | null) {
  if (!value) return "—";
  return ORIGENS.find((o) => o.value === value)?.label ?? value;
}

// ─── page ────────────────────────────────────────────────────────────────────

function Recomendacoes() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const isMaster = auth?.isMaster ?? false;

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

  const { scopeIds } = useConsultorScope();

  const { data: prospects } = useQuery({
    queryKey: ["prospects", scopeIds.join(",")],
    enabled: !!auth && scopeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await applyScope(supabase.from("prospects").select("*"), scopeIds).order("created_at", {
        ascending: false,
      });
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
      supabase
        .from("prospects")
        .update({
          etapa_funil: "hot",
          status_hot: "pendente",
          entrou_etapa_em: now,
          ultima_interacao: now,
        })
        .eq("id", p.id),
      supabase.from("atividades").insert({
        consultor_id: auth.user.id,
        prospect_id: p.id,
        tipo: "ligacao",
        resultado: "enviado_para_hot",
        observacao: "Prospect enviado para fila HOT",
      }),
    ]);
    if (u.error) return toast.error(u.error.message);
    toast.success("Enviado para HOT.");
    qc.invalidateQueries({ queryKey: ["prospects"] });
  }

  async function marcarPerdido(p: any) {
    if (!auth) return;
    const motivo = window.prompt("Motivo da perda?") ?? "";
    const { error } = await supabase
      .from("prospects")
      .update({
        etapa_funil: "perdido",
        motivo_perda: motivo,
        ultima_interacao: new Date().toISOString(),
      })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    await supabase.from("atividades").insert({
      consultor_id: auth.user.id,
      prospect_id: p.id,
      tipo: "ligacao",
      resultado: "perdido",
      observacao: motivo,
    });
    toast.success("Marcado como perdido.");
    qc.invalidateQueries({ queryKey: ["prospects"] });
  }

  async function excluirProspect(p: any) {
    if (!auth || !isMaster) return;
    const confirmar = window.confirm(`Excluir "${p.nome}" permanentemente? Esta ação não pode ser desfeita.`);
    if (!confirmar) return;
    const { error } = await supabase.from("prospects").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Prospect excluído.");
    qc.invalidateQueries({ queryKey: ["prospects"] });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Originação"
        title="Prospects da unidade"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setRankingOpen(true)}>
              <Trophy className="h-4 w-4 mr-2" />
              Ranking de Recomendantes
            </Button>
            <Button variant={mostrarPerdidos ? "default" : "outline"} onClick={() => setMostrarPerdidos((v) => !v)}>
              <XCircle className="h-4 w-4 mr-2" />
              {mostrarPerdidos ? "Ocultar perdidos" : "Mostrar perdidos"}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gold-gradient text-background">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo prospect
                </Button>
              </DialogTrigger>
              <ProspectDialog
                onClose={() => {
                  setOpen(false);
                  qc.invalidateQueries({ queryKey: ["prospects"] });
                }}
              />
            </Dialog>
          </div>
        }
      />

      {/* ── Ranking Modal ── */}
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
                    <p className="text-sm">
                      {r.total} indicaç{r.total > 1 ? "ões" : "ão"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.clientes} cliente(s) · {brl(r.pa)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Filtros ── */}
      <ConsultorFilter />
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
            <SelectTrigger>
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {Object.entries(ETAPA_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fProfissao} onValueChange={setFProfissao}>
            <SelectTrigger>
              <SelectValue placeholder="Profissão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as profissões</SelectItem>
              {profissoes.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fEstado} onValueChange={setFEstado}>
            <SelectTrigger>
              <SelectValue placeholder="Estado civil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos estados civis</SelectItem>
              {ESTADO_CIVIL.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fFilhos} onValueChange={setFFilhos}>
            <SelectTrigger>
              <SelectValue placeholder="Dependentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Com / sem dependentes</SelectItem>
              <SelectItem value="com">Com dependentes</SelectItem>
              <SelectItem value="sem">Sem dependentes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fRecom} onValueChange={setFRecom}>
            <SelectTrigger>
              <SelectValue placeholder="Recomendante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos recomendantes</SelectItem>
              {recomendantes.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* ── Tabela ── */}
      {!filtered || filtered.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="Nenhum prospect encontrado"
          description="Ajuste os filtros ou cadastre um novo prospect para começar."
        />
      ) : (
        <Card className="bg-surface border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">Nome</TableHead>
                <TableHead className="min-w-[120px]">Profissão</TableHead>
                <TableHead className="min-w-[120px]">Etapa</TableHead>
                <TableHead className="text-right min-w-[90px]">ORNE</TableHead>
                <TableHead className="text-right min-w-[110px]">Tempo na Etapa</TableHead>
                <TableHead className="text-right min-w-[120px]">Renda Estimada</TableHead>
                <TableHead className="min-w-[130px]">Recomendante</TableHead>
                <TableHead className="text-right min-w-[130px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: any) => {
                const score = orneScore(p);
                const dias = diasDesde(p.entrou_etapa_em);
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
                    <TableCell className="text-muted-foreground text-sm">{p.especialidade_medica ?? "—"}</TableCell>
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
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot.cor}`} />
                        {dias}d
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{brl(p.renda_estimada)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.quem_recomendou ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.etapa_funil !== "hot" && p.etapa_funil !== "perdido" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => enviarParaHot(p)}
                            title="Enviar para HOT"
                            className="hover:text-gold"
                          >
                            <Flame className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => setEditar(p)} title="Editar prospect">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {p.etapa_funil !== "perdido" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => marcarPerdido(p)}
                            title="Marcar como perdido"
                            className="hover:text-destructive"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {isMaster && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => excluirProspect(p)}
                            title="Excluir prospect (Master)"
                            className="hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* ── Perfil modal ── */}
      <Dialog open={!!perfil} onOpenChange={(v) => !v && setPerfil(null)}>
        {perfil && (
          <PerfilDialog
            prospect={perfil}
            onEdit={() => {
              setEditar(perfil);
              setPerfil(null);
            }}
            onClose={() => setPerfil(null)}
          />
        )}
      </Dialog>

      {/* ── Editar modal ── */}
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

// ─── Perfil Dialog ────────────────────────────────────────────────────────────

function PerfilDialog({ prospect, onEdit, onClose }: { prospect: any; onEdit: () => void; onClose: () => void }) {
  const p = prospect;
  const score = orneScore(p);
  return (
    <DialogContent className="max-w-2xl bg-surface border-border max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl flex items-center gap-3 flex-wrap">
          {p.nome}
          <ScoreStars score={score} />
          <Badge variant="outline" className={ETAPA_BADGE_CLASS[p.etapa_funil] ?? ""}>
            {ETAPA_LABEL[p.etapa_funil] ?? p.etapa_funil}
          </Badge>
        </DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <Field label="Celular" value={p.telefone} />
        <Field label="E-mail" value={p.email} />
        <Field label="Cidade" value={p.cidade} />
        <Field label="Data de nascimento" value={p.data_nascimento} />
        <Field label="Profissão / Especialidade" value={p.especialidade_medica} />
        <Field label="Estado civil" value={p.estado_civil} />
        <Field label="Dependentes" value={p.filhos ? String(p.filhos) : "Sem dependentes"} />
        <Field label="Nome do cônjuge" value={p.conjuge} />
        <Field label="Nasc. cônjuge" value={p.data_nascimento_conjuge} />
        <Field label="Telefone do cônjuge" value={p.telefone_conjuge} />
        <Field label="Profissão do cônjuge" value={p.profissao_conjuge} />
        <Field label="Renda estimada" value={brl(p.renda_estimada)} />
        <Field label="Patrimônio estimado" value={brl(p.patrimonio_estimado)} />
        <Field label="PA estimado" value={brl(p.pa_estimado)} />
        <div>
          <div className="caps-tracking text-[0.65rem] text-muted-foreground mb-1">ORNE (score)</div>
          <ScoreStars score={score} className="text-sm" />
        </div>
        <Field label="Origem" value={origemLabel(p.origem)} />
        <Field label="Recomendante" value={p.quem_recomendou} />
        <Field
          label="Última interação"
          value={p.ultima_interacao ? new Date(p.ultima_interacao).toLocaleString("pt-BR") : null}
        />
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
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
        <Button onClick={onEdit} className="gold-gradient text-background">
          <Pencil className="h-4 w-4 mr-2" />
          Editar prospect
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="caps-tracking text-[0.65rem] text-muted-foreground mb-1">{label}</div>
      <div className="text-foreground">{value || "—"}</div>
    </div>
  );
}

// ─── Prospect Dialog ─────────────────────────────────────────────────────────

const EMPTY_FORM = {
  nome: "",
  telefone: "",
  email: "",
  cidade: "",
  data_nascimento: "",
  profissao: "",
  estado_civil: "",
  possui_dependentes: "nao",
  quantidade_dependentes: "",
  conjuge: "",
  data_nascimento_conjuge: "",
  telefone_conjuge: "",
  profissao_conjuge: "",
  renda_estimada: 0,
  patrimonio_estimado: 0,
  origem: "",
  quem_recomendou: "",
  observacoes: "",
};

function prospectToForm(p: any) {
  return {
    nome: p.nome ?? "",
    telefone: p.telefone ?? "",
    email: p.email ?? "",
    cidade: p.cidade ?? "",
    data_nascimento: p.data_nascimento ?? "",
    profissao: p.especialidade_medica ?? "",
    estado_civil: p.estado_civil ?? "",
    possui_dependentes: p.filhos && p.filhos > 0 ? "sim" : "nao",
    quantidade_dependentes: p.filhos && p.filhos > 0 ? String(p.filhos) : "",
    conjuge: p.conjuge ?? "",
    data_nascimento_conjuge: p.data_nascimento_conjuge ?? "",
    telefone_conjuge: p.telefone_conjuge ?? "",
    profissao_conjuge: p.profissao_conjuge ?? "",
    renda_estimada: p.renda_estimada ?? 0,
    patrimonio_estimado: p.patrimonio_estimado ?? 0,
    origem: p.origem ?? "",
    quem_recomendou: p.quem_recomendou ?? "",
    observacoes: p.observacoes ?? "",
  };
}

function ProspectDialog({ onClose, prospect }: { onClose: () => void; prospect?: any }) {
  const { auth } = useAuth();
  const isEdit = !!prospect;
  const [f, setF] = useState<any>(() => (prospect ? prospectToForm(prospect) : { ...EMPTY_FORM }));
  const [saving, setSaving] = useState(false);

  const set = (key: string, val: any) => setF((prev: any) => ({ ...prev, [key]: val }));
  const temConjuge = f.estado_civil === "Casado(a)" || f.estado_civil === "União estável";

  async function save() {
    if (!auth || !f.nome || !f.telefone) return;
    setSaving(true);

    const qtdDependentes = f.possui_dependentes === "sim" ? Number(f.quantidade_dependentes) || 1 : 0;

    const payload: any = {
      nome: f.nome,
      telefone: f.telefone || null,
      email: f.email || null,
      cidade: f.cidade || null,
      data_nascimento: f.data_nascimento || null,
      especialidade_medica: f.profissao || null,
      estado_civil: f.estado_civil || null,
      filhos: qtdDependentes,
      conjuge: f.conjuge || null,
      data_nascimento_conjuge: f.data_nascimento_conjuge || null,
      telefone_conjuge: f.telefone_conjuge || null,
      profissao_conjuge: f.profissao_conjuge || null,
      renda_estimada: Number(f.renda_estimada) || null,
      patrimonio_estimado: Number(f.patrimonio_estimado) || null,
      origem: f.origem || null,
      quem_recomendou: f.quem_recomendou || null,
      observacoes: f.observacoes || null,
    };

    const { error } = isEdit
      ? await supabase.from("prospects").update(payload).eq("id", prospect.id)
      : await supabase.from("prospects").insert({ ...payload, consultor_id: auth.user.id });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isEdit ? "Prospect atualizado." : "Prospect cadastrado.");
    onClose();
  }

  return (
    <DialogContent className="max-w-2xl bg-surface border-border max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">{isEdit ? "Editar prospect" : "Novo prospect"}</DialogTitle>
      </DialogHeader>

      <div className="space-y-5">
        <Section title="Dados obrigatórios">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Nome *</Label>
              <Input value={f.nome} onChange={(e) => set("nome", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Celular *</Label>
              <Input
                value={f.telefone}
                onChange={(e) => set("telefone", e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>
        </Section>

        <Section title="Dados pessoais">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={f.cidade} onChange={(e) => set("cidade", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de nascimento</Label>
              <Input type="date" value={f.data_nascimento} onChange={(e) => set("data_nascimento", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Profissão</Label>
              <Input value={f.profissao} onChange={(e) => set("profissao", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado civil</Label>
              <Select value={f.estado_civil} onValueChange={(v) => set("estado_civil", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADO_CIVIL.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Possui dependentes</Label>
              <Select value={f.possui_dependentes} onValueChange={(v) => set("possui_dependentes", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {f.possui_dependentes === "sim" && (
              <div className="space-y-1.5">
                <Label>Quantidade de dependentes</Label>
                <Input
                  type="number"
                  min={1}
                  value={f.quantidade_dependentes}
                  onChange={(e) => set("quantidade_dependentes", e.target.value)}
                />
              </div>
            )}
          </div>
        </Section>

        {temConjuge && (
          <Section title="Dados do cônjuge">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Nome do cônjuge</Label>
                <Input value={f.conjuge} onChange={(e) => set("conjuge", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={f.data_nascimento_conjuge}
                  onChange={(e) => set("data_nascimento_conjuge", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={f.telefone_conjuge}
                  onChange={(e) => set("telefone_conjuge", e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Profissão</Label>
                <Input value={f.profissao_conjuge} onChange={(e) => set("profissao_conjuge", e.target.value)} />
              </div>
            </div>
          </Section>
        )}

        <Section title="Financeiro">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Renda estimada (R$)</Label>
              <Input type="number" value={f.renda_estimada} onChange={(e) => set("renda_estimada", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Patrimônio estimado (R$)</Label>
              <Input
                type="number"
                value={f.patrimonio_estimado}
                onChange={(e) => set("patrimonio_estimado", e.target.value)}
              />
            </div>
          </div>
        </Section>

        <Section title="Origem">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={f.origem} onValueChange={(v) => set("origem", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quem recomendou</Label>
              <Input value={f.quem_recomendou} onChange={(e) => set("quem_recomendou", e.target.value)} />
            </div>
          </div>
        </Section>

        <Section title="Observações">
          <div className="space-y-1.5">
            <Input
              value={f.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              placeholder="Anotações livres sobre o prospect..."
            />
          </div>
        </Section>
      </div>

      <DialogFooter className="mt-4">
        <Button onClick={save} disabled={saving || !f.nome || !f.telefone} className="gold-gradient text-background">
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold caps-tracking text-muted-foreground uppercase tracking-widest">{title}</p>
      {children}
    </div>
  );
}
