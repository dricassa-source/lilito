import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConsultorScope } from "@/hooks/useConsultorScope";
import { ConsultorFilter } from "@/components/lilito/ConsultorFilter";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useState, useMemo } from "react";
import { Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth } from "date-fns";


export const Route = createFileRoute("/_authenticated/planejamento")({
  head: () => ({ meta: [{ title: "Planejamento — LILITO" }] }),
  component: Planejamento,
});

function formatBRL(n: number) { return `R$ ${Math.round(n).toLocaleString("pt-BR")}`; }

function Planejamento() {
  const { auth } = useAuth();
  const isMaster = auth?.isMaster ?? false;
  const { scopeIds, consultorId } = useConsultorScope();

  const qc = useQueryClient();
  const now = new Date();
  const [ano] = useState(now.getFullYear());
  const [mes] = useState(now.getMonth() + 1);

  const { data: consultores } = useQuery({
    queryKey: ["consultores-pl"],
    enabled: !!auth,
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id,role");
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id,nome").in("id", ids);
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: metas } = useQuery({
    queryKey: ["metas", ano, mes],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase.from("metas").select("*")
        .eq("ano", ano).eq("mes", mes).eq("periodo", "mensal");
      if (error) throw error;
      return data ?? [];
    },
  });

  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  const { data: producao } = useQuery({
    queryKey: ["planejamento-prod", ano, mes],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase.from("apolices")
        .select("consultor_id,premio_atual,onboarding_status,data_fechamento,data_emissao");
      if (error) throw error;
      return data ?? [];
    },
  });

  const linhas = useMemo(() => {
    const base = consultorId
      ? (consultores ?? []).filter((c) => c.id === consultorId)
      : isMaster ? (consultores ?? []) : (consultores ?? []).filter((c) => c.id === auth?.user.id);
    const list = base.filter((c) => scopeIds.includes(c.id));

    return list.map((c) => {
      const meta = metas?.find((m: any) => m.consultor_id === c.id);
      const rows = (producao ?? []).filter((p: any) => p.consultor_id === c.id);
      const fech = rows.filter((p: any) => p.data_fechamento && p.data_fechamento >= monthStart && p.data_fechamento <= monthEnd);
      const em = rows.filter((p: any) => p.data_emissao && p.data_emissao >= monthStart && p.data_emissao <= monthEnd);
      const onb = rows.filter((p: any) => p.onboarding_status && !["nao_aplicavel","emitida"].includes(p.onboarding_status));
      const paFech = fech.reduce((s: number, p: any) => s + Number(p.premio_atual ?? 0), 0);
      const paEm = em.reduce((s: number, p: any) => s + Number(p.premio_atual ?? 0), 0);
      const paOnb = onb.reduce((s: number, p: any) => s + Number(p.premio_atual ?? 0), 0);
      const proj = paEm + paOnb;
      const metaPa = Number(meta?.meta_pa ?? 0);
      const pct = metaPa > 0 ? Math.round((proj / metaPa) * 100) : 0;
      return {
        ...c, meta, apFech: fech.length, apEm: em.length, paFech, paEm, paOnb, proj,
        metaPa, metaAp: Number(meta?.meta_apolices ?? 0), pct,
        faltante: Math.max(0, metaPa - proj),
      };
    });
  }, [consultores, metas, producao, isMaster, auth, monthStart, monthEnd]);

  const totalMeta = linhas.reduce((s, l) => s + l.metaPa, 0);
  const totalProj = linhas.reduce((s, l) => s + l.proj, 0);
  const totalPct = totalMeta > 0 ? Math.round((totalProj / totalMeta) * 100) : 0;

  return (
    <div>
      <PageHeader eyebrow="Metas & projeção" title="Planejamento"
        description="Acompanhamento mensal de metas individuais e da unidade. Alimentado pelo Onboarding e Fechamentos."
        actions={isMaster ? (
          <MetaDialog consultores={consultores ?? []} ano={ano} mes={mes}
            onSaved={() => qc.invalidateQueries({ queryKey: ["metas"] })} />
        ) : undefined}
      />

      {isMaster && (
        <Card className="p-5 bg-surface border-gold/30 mb-6">
          <p className="caps-tracking text-gold mb-2 flex items-center gap-2">
            <Target className="h-3.5 w-3.5" /> Unidade — {String(mes).padStart(2,"0")}/{ano}
          </p>
          <div className="flex flex-wrap items-end gap-6">
            <div><p className="text-xs text-muted-foreground">Meta PA</p><p className="font-display text-2xl">{formatBRL(totalMeta)}</p></div>
            <div><p className="text-xs text-muted-foreground">Projeção</p><p className="font-display text-2xl text-gold">{formatBRL(totalProj)}</p></div>
            <div className="flex-1 min-w-[200px]"><Progress value={Math.min(100,totalPct)} className="h-2" /><p className="text-xs mt-1">{totalPct}% da meta</p></div>
          </div>
        </Card>
      )}

      <Card className="bg-surface border-border divide-y divide-border">
        {linhas.map((l) => (
          <div key={l.id} className="p-4 grid grid-cols-12 gap-3 items-center">
            <div className="col-span-12 md:col-span-3">
              <p className="font-medium text-sm">{l.nome}</p>
              <p className="text-xs text-muted-foreground">Meta {l.metaAp || "—"} apólices</p>
            </div>
            <Cell label="PA Fech." value={formatBRL(l.paFech)} />
            <Cell label="PA Emit." value={formatBRL(l.paEm)} />
            <Cell label="Onb." value={formatBRL(l.paOnb)} />
            <Cell label="Projeção" value={formatBRL(l.proj)} accent />
            <div className="col-span-8 md:col-span-2">
              <Progress value={Math.min(100, l.pct)} className="h-2" />
              <p className="text-xs mt-1">{l.pct}% — faltam {formatBRL(l.faltante)}</p>
            </div>
            <div className="col-span-4 md:col-span-1 text-right">
              <span className={`font-display text-xl ${l.pct >= 100 ? "text-gold" : ""}`}>{l.apFech + l.apEm}</span>
              <p className="text-xs text-muted-foreground">apólices</p>
            </div>
          </div>
        ))}
        {linhas.length === 0 && <p className="p-8 text-center text-muted-foreground">Sem consultores cadastrados.</p>}
      </Card>
    </div>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="col-span-6 md:col-span-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-display text-sm ${accent ? "text-gold" : ""}`}>{value}</p>
    </div>
  );
}

function MetaDialog({ consultores, ano, mes, onSaved }: {
  consultores: { id: string; nome: string }[]; ano: number; mes: number; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [consultorId, setConsultorId] = useState<string>("");
  const [metaApolices, setMetaApolices] = useState<string>("3");
  const [metaPa, setMetaPa] = useState<string>("60000");

  const save = useMutation({
    mutationFn: async () => {
      const row = {
        consultor_id: consultorId || null,
        ano, mes, periodo: "mensal" as const,
        meta_apolices: Number(metaApolices || 0),
        meta_pa: Number(metaPa || 0),
      };
      const { error } = await supabase.from("metas").upsert(row, { onConflict: "consultor_id,ano,mes,periodo" } as any);
      if (error) {
        // fallback: insert (sem unique key)
        const { error: e2 } = await supabase.from("metas").insert(row);
        if (e2) throw e2;
      }
    },
    onSuccess: () => { toast.success("Meta salva"); setOpen(false); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1"><Plus className="h-4 w-4" /> Nova meta</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova meta — {String(mes).padStart(2,"0")}/{ano}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Consultor (vazio = unidade)</Label>
            <Select value={consultorId} onValueChange={setConsultorId}>
              <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                {consultores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Meta apólices</Label>
              <Input type="number" value={metaApolices} onChange={(e) => setMetaApolices(e.target.value)} />
            </div>
            <div>
              <Label>Meta PA (R$)</Label>
              <Input type="number" value={metaPa} onChange={(e) => setMetaPa(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
