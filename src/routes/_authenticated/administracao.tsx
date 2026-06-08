import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Settings, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/lilito/EmptyState";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/administracao")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "master");
    if (!data || data.length === 0) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Administração — LILITO" }] }),
  component: Admin,
});

function Admin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: consultores } = useQuery({
    queryKey: ["admin-consultores"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("nome"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const roleMap: Record<string, string[]> = {};
      (roles ?? []).forEach((r: any) => { roleMap[r.user_id] = roleMap[r.user_id] ?? []; roleMap[r.user_id].push(r.role); });
      return (profiles ?? []).map((p: any) => ({ ...p, roles: roleMap[p.id] ?? [] }));
    },
  });

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("profiles").update({ ativo }).eq("id", id);
    toast.success(ativo ? "Consultor ativado." : "Consultor desativado.");
    qc.invalidateQueries({ queryKey: ["admin-consultores"] });
  }

  async function recalcular() {
    if (!window.confirm("Limpar registros órfãos e recalcular métricas? Esta ação não pode ser desfeita.")) return;
    const { data, error } = await supabase.rpc("cleanup_orphans");
    if (error) return toast.error(error.message);
    const counts = (data ?? {}) as Record<string, number>;
    const total = Object.values(counts).reduce((s, n) => s + Number(n ?? 0), 0);
    toast.success(`Limpeza concluída — ${total} registro(s) removido(s).`, {
      description: Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join(" · ") || "Sem registros órfãos.",
    });
    qc.invalidateQueries();
  }

  async function limparHomologacao() {
    const ok = window.prompt(
      'ATENÇÃO: esta ação apagará TODOS os prospects, clientes, eventos, atividades, apólices, lembretes, notificações, listas HOT e metas. Usuários, configurações e reuniões recorrentes serão preservados. Digite LIMPAR para confirmar.',
    );
    if (ok !== "LIMPAR") return;
    const { data, error } = await supabase.rpc("reset_homologacao" as any);
    if (error) return toast.error(error.message);
    const counts = (data ?? {}) as Record<string, number>;
    toast.success("Base de homologação limpa com sucesso.", {
      description: Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join(" · ") || "Nenhum registro a remover.",
    });
    qc.invalidateQueries();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Master" title="Administração" description="Gestão de consultores e permissões."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={recalcular} className="border-gold/40 hover:text-gold">
              <RefreshCw className="h-4 w-4 mr-2" />Recalcular Métricas / Limpar Órfãos
            </Button>
            <Button variant="outline" onClick={limparHomologacao} className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive">
              🧹 Limpar Base de Homologação
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="gold-gradient text-background"><Plus className="h-4 w-4 mr-2" />Novo consultor</Button></DialogTrigger>
              <NovoConsultor onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin-consultores"] }); }} />
            </Dialog>
          </div>
        }
      />

      {!consultores || consultores.length === 0 ? (
        <EmptyState icon={Settings} title="Nenhum consultor" description="Adicione o primeiro consultor da equipe." />
      ) : (
        <Card className="bg-surface border-border divide-y divide-border">
          {consultores.map((c: any) => (
            <div key={c.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full gold-gradient flex items-center justify-center text-background font-semibold">
                  {c.nome.slice(0,1).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.email}</p>
                </div>
                {c.roles.includes("master") && <Badge variant="outline" className="border-gold text-gold caps-tracking">Master</Badge>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{c.ativo ? "Ativo" : "Inativo"}</span>
                <Switch checked={c.ativo} onCheckedChange={(v) => toggleAtivo(c.id, v)} disabled={c.roles.includes("master")} />
              </div>
            </div>
          ))}
        </Card>
      )}

      <p className="text-xs text-muted-foreground mt-6">
        💡 Para criar consultores, eles devem fazer signup pela tela de login com o e-mail informado.
        Depois o Master pode ativar/desativar e atribuir papéis aqui.
      </p>
    </div>
  );
}

function NovoConsultor({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");

  function instruir() {
    if (!email || !nome) { toast.error("Preencha nome e e-mail."); return; }
    navigator.clipboard.writeText(email);
    toast.success(`Convite preparado. Compartilhe o link de cadastro com ${nome}.`, {
      description: `E-mail copiado: ${email}. O consultor deve criar conta pela tela de login.`,
    });
    onClose();
  }

  return (
    <DialogContent className="bg-surface border-border">
      <DialogHeader><DialogTitle className="font-display text-2xl">Novo consultor</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <p className="text-xs text-muted-foreground">
          O consultor receberá um link de cadastro. Após o signup ele aparecerá automaticamente na lista como Consultor.
        </p>
      </div>
      <DialogFooter><Button onClick={instruir} className="gold-gradient text-background">Preparar convite</Button></DialogFooter>
    </DialogContent>
  );
}
