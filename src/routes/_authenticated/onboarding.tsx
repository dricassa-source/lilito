import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/lilito/EmptyState";
import { CircleDot, CheckCircle2, AlertTriangle } from "lucide-react";
import { differenceInDays } from "date-fns";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Onb = Database["public"]["Enums"]["onboarding_status"];

const STATUS_LABEL: Record<Onb, string> = {
  nao_aplicavel: "—",
  documentacao_pendente: "📄 Documentação",
  exames_pendentes: "🩺 Exames",
  entrevista_pendente: "☎️ Entrevista",
  pagamento_pendente: "💳 Pagamento",
  em_underwriting: "🔍 Underwriting",
  outras_pendencias: "⚠️ Outras",
  emitida: "✅ Emitida",
};

const STATUS_OPTIONS: Onb[] = [
  "documentacao_pendente","exames_pendentes","entrevista_pendente",
  "pagamento_pendente","em_underwriting","outras_pendencias",
];

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding — LILITO" }] }),
  component: Onboarding,
});

function formatBRL(n: number) { return `R$ ${Math.round(n).toLocaleString("pt-BR")}`; }

function Onboarding() {
  const { auth } = useAuth();
  const qc = useQueryClient();

  const { data: rows } = useQuery({
    queryKey: ["onboarding", auth?.user.id, auth?.isMaster],
    enabled: !!auth,
    queryFn: async () => {
      let q = supabase.from("apolices")
        .select("id, consultor_id, prospect_id, cliente_id, produto, premio_atual, capital_segurado, onboarding_status, data_fechamento, onboarding_observacao, prospects(id,nome,telefone,pa_estimado), clientes(nome)")
        .neq("onboarding_status", "nao_aplicavel")
        .neq("onboarding_status", "emitida")
        .order("data_fechamento", { ascending: true, nullsFirst: false });
      if (!auth?.isMaster) q = q.eq("consultor_id", auth!.user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, row }: { id: string; status: Onb; row?: any }) => {
      if (status !== "emitida") {
        const { error } = await supabase.from("apolices").update({ onboarding_status: status }).eq("id", id);
        if (error) throw error;
        return;
      }

      // EMISSÃO: converte prospect em Cliente (arquitetura oficial LILITO)
      let clienteId: string | null = row?.cliente_id ?? null;

      if (!clienteId && row?.prospect_id) {
        const { data: existing } = await supabase
          .from("clientes")
          .select("id")
          .eq("prospect_id", row.prospect_id)
          .maybeSingle();
        clienteId = existing?.id ?? null;

        if (!clienteId) {
          const { data: novo, error: cErr } = await supabase
            .from("clientes")
            .insert({
              consultor_id: row.consultor_id,
              prospect_id: row.prospect_id,
              nome: row.prospects?.nome ?? "Cliente",
              telefone: row.prospects?.telefone ?? null,
              pa_total: Number(row.premio_atual ?? 0) * 12,
              capital_segurado: Number(row.capital_segurado ?? 0),
            })
            .select("id")
            .single();
          if (cErr) throw cErr;
          clienteId = novo.id;
        }
      }

      const { error: aErr } = await supabase
        .from("apolices")
        .update({
          onboarding_status: "emitida",
          data_emissao: new Date().toISOString(),
          status: "migrado" as any,
          ...(clienteId ? { cliente_id: clienteId } : {}),
        })
        .eq("id", id);
      if (aErr) throw aErr;

      if (row?.prospect_id) {
        await supabase
          .from("prospects")
          .update({
            etapa_funil: "cliente" as any,
            entrou_etapa_em: new Date().toISOString(),
            ultima_interacao: new Date().toISOString(),
          })
          .eq("id", row.prospect_id);

        await supabase.from("atividades").insert({
          consultor_id: row.consultor_id,
          prospect_id: row.prospect_id,
          cliente_id: clienteId,
          tipo: "agendamento",
          resultado: "Apólice emitida — convertido em Cliente",
        });
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["funil"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["resultado-semanal"] });
      toast.success(v.status === "emitida" ? "Apólice emitida — Cliente criado" : "Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totals = (rows ?? []).reduce(
    (acc: { count: number; pa: number; cs: number; delay: number }, r: any) => {
      acc.count++;
      acc.pa += Number(r.premio_atual ?? 0);
      acc.cs += Number(r.capital_segurado ?? 0);
      if (r.data_fechamento && differenceInDays(new Date(), new Date(r.data_fechamento)) > 15) acc.delay++;
      return acc;
    },
    { count: 0, pa: 0, cs: 0, delay: 0 },
  );

  return (
    <div>
      <PageHeader eyebrow="Pós-fechamento" title="Onboarding"
        description="Propostas fechadas aguardando emissão. Só vira Cliente quando a apólice for emitida." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Em onboarding" value={String(totals.count)} />
        <Stat label="PA pendente" value={formatBRL(totals.pa)} />
        <Stat label="Capital segurado" value={formatBRL(totals.cs)} />
        <Stat label="Alertas > 15d" value={String(totals.delay)} tone={totals.delay > 0 ? "warn" : "ok"} />
      </div>

      {!rows || rows.length === 0 ? (
        <EmptyState icon={CircleDot} title="Nenhuma apólice em onboarding"
          description="Quando uma proposta for fechada, ela aparecerá aqui até a emissão." />
      ) : (
        <Card className="bg-surface border-border divide-y divide-border">
          {rows.map((r: any) => {
            const dias = r.data_fechamento ? differenceInDays(new Date(), new Date(r.data_fechamento)) : null;
            const nome = r.clientes?.nome ?? r.prospects?.nome ?? "—";
            const alert = dias != null && dias > 15;
            return (
              <div key={r.id} className="p-4 grid grid-cols-12 gap-3 items-center">
                <div className="col-span-12 md:col-span-4">
                  <p className="font-medium text-sm">{nome}</p>
                  <p className="text-xs text-muted-foreground">{r.produto ?? "Apólice"}</p>
                </div>
                <div className="col-span-6 md:col-span-2 text-xs">
                  <p className="text-muted-foreground">PA</p>
                  <p className="font-display text-lg">{formatBRL(Number(r.premio_atual ?? 0))}</p>
                </div>
                <div className="col-span-6 md:col-span-2 text-xs">
                  <p className="text-muted-foreground">Parado</p>
                  <p className={`font-display text-lg ${alert ? "text-destructive" : ""}`}>
                    {dias != null ? `${dias}d` : "—"}
                  </p>
                </div>
                <div className="col-span-8 md:col-span-2">
                  <Select value={r.onboarding_status}
                    onValueChange={(v) => updateStatus.mutate({ id: r.id, status: v as Onb, row: r })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 md:col-span-2 flex justify-end">
                  <Button size="sm" className="gap-1"
                    onClick={() => updateStatus.mutate({ id: r.id, status: "emitida" })}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Emitir
                  </Button>
                </div>
                {alert && (
                  <div className="col-span-12 text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Acompanhar — parado há mais de 15 dias.
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <Card className={`p-4 bg-surface ${tone === "warn" ? "border-destructive/50" : "border-border"}`}>
      <p className="caps-tracking text-muted-foreground">{label}</p>
      <p className="font-display text-2xl mt-1">{value}</p>
    </Card>
  );
}
