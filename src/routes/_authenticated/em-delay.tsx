import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/lilito/EmptyState";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/em-delay")({
  head: () => ({ meta: [{ title: "Em Delay — LILITO" }] }),
  component: EmDelay,
});

const LIMITES: Record<string, number> = {
  recomendacao: 3, hot: 2, ab: 5, analise_apolice: 7, fechamento: 7, implantacao: 10,
};

function EmDelay() {
  const { auth } = useAuth();
  const qc = useQueryClient();
  const [perdaOpen, setPerdaOpen] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const { data: travados } = useQuery({
    queryKey: ["em-delay"],
    enabled: !!auth,
    queryFn: async () => {
      const { data, error } = await supabase.from("prospects").select("*,profiles!prospects_consultor_id_fkey(nome)");
      if (error) throw error;
      return (data ?? []).filter((p: any) => {
        const limite = LIMITES[p.etapa_funil] ?? 999;
        const dias = Math.floor((Date.now() - new Date(p.entrou_etapa_em).getTime()) / 86_400_000);
        return dias > limite && !["cliente", "pos_venda", "perdido"].includes(p.etapa_funil);
      });
    },
  });

  async function destravar(id: string) {
    await supabase.from("prospects").update({ entrou_etapa_em: new Date().toISOString(), ultima_interacao: new Date().toISOString() }).eq("id", id);
    toast.success("Destravado."); qc.invalidateQueries({ queryKey: ["em-delay"] });
  }
  async function marcarPerdido(id: string) {
    if (!motivo.trim()) { toast.error("Informe o motivo."); return; }
    await supabase.from("prospects").update({ etapa_funil: "perdido" as any, motivo_perda: motivo }).eq("id", id);
    toast.success("Marcado como perdido.");
    setPerdaOpen(null); setMotivo("");
    qc.invalidateQueries({ queryKey: ["em-delay"] });
  }

  return (
    <div>
      <PageHeader eyebrow="Resgate" title="Em Delay" description="Negócios travados além do tempo médio da etapa." />
      {!travados || travados.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Nada travado" description="Sua operação está fluindo bem." />
      ) : (
        <Card className="bg-surface border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead><TableHead>Etapa</TableHead>
                <TableHead>Dias parado</TableHead><TableHead>PA est.</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {travados.map((p: any) => {
                const dias = Math.floor((Date.now() - new Date(p.entrou_etapa_em).getTime()) / 86_400_000);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell><span className="caps-tracking text-gold text-[0.65rem]">{p.etapa_funil}</span></TableCell>
                    <TableCell className="text-destructive">{dias}d</TableCell>
                    <TableCell>R$ {Number(p.pa_estimado ?? 0).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => destravar(p.id)}>Destravar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setPerdaOpen(p.id)} className="text-destructive">Perdido</Button>
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
    </div>
  );
}
