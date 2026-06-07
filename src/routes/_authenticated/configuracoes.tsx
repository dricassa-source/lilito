import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/lilito/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings as SettingsIcon, Plus, Trash2, CalendarRange } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — LILITO" }] }),
  component: Configuracoes,
});

const KEYS = {
  unidade: "unidade",
  scorePesos: "score_pesos",
  auditoriaMin: "auditoria_minimos",
  notificacoes: "notificacoes",
  integracoes: "integracoes",
};

function Configuracoes() {
  const { auth } = useAuth();
  if (!auth?.isMaster) {
    return (
      <div>
        <PageHeader eyebrow="Acesso restrito" title="Configurações"
          description="Apenas o Master pode editar configurações da unidade." />
      </div>
    );
  }
  return (
    <div>
      <PageHeader eyebrow="Operação" title="Configurações" description="Personalize a operação da VINCA sem alterar código." />
      <Tabs defaultValue="unidade" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="unidade">Unidade</TabsTrigger>
          <TabsTrigger value="score">Score</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          <TabsTrigger value="frases">Frases VINCA</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        </TabsList>
        <TabsContent value="unidade"><UnidadeTab /></TabsContent>
        <TabsContent value="score"><ScoreTab /></TabsContent>
        <TabsContent value="auditoria"><AuditoriaTab /></TabsContent>
        <TabsContent value="frases"><FrasesTab /></TabsContent>
        <TabsContent value="integracoes"><IntegracoesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function useConfig(chave: string, initial: any) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["config", chave],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes").select("valor").eq("chave", chave).maybeSingle();
      return (data?.valor as any) ?? initial;
    },
  });
  const save = useMutation({
    mutationFn: async (valor: any) => {
      const { error } = await supabase.from("configuracoes")
        .upsert({ chave, valor }, { onConflict: "chave" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["config", chave] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return { data, save };
}

function UnidadeTab() {
  const { data, save } = useConfig(KEYS.unidade, { nome: "VINCA", cidade: "", estado: "", telefone: "", email: "", endereco: "" });
  const [form, setForm] = useState(data);
  useEffect(() => { if (data) setForm(data); }, [data]);
  if (!form) return null;
  return (
    <Card className="p-6 bg-surface border-border space-y-3 max-w-2xl">
      {["nome","cidade","estado","telefone","email","endereco"].map((k) => (
        <div key={k}>
          <Label className="capitalize">{k}</Label>
          <Input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
        </div>
      ))}
      <Button onClick={() => save.mutate(form)}>Salvar</Button>
    </Card>
  );
}

function ScoreTab() {
  const initial = { profissao: 20, renda: 25, patrimonio: 25, filhos: 10, estado_civil: 10, origem: 10 };
  const { data, save } = useConfig(KEYS.scorePesos, initial);
  const [form, setForm] = useState(data);
  useEffect(() => { if (data) setForm(data); }, [data]);
  if (!form) return null;
  return (
    <Card className="p-6 bg-surface border-border space-y-3 max-w-xl">
      <p className="text-sm text-muted-foreground">Pesos relativos do Score Inteligente VINCA (totalizando 100).</p>
      {Object.keys(initial).map((k) => (
        <div key={k} className="grid grid-cols-3 items-center gap-3">
          <Label className="capitalize col-span-1">{k.replace("_"," ")}</Label>
          <Input type="number" className="col-span-2"
            value={form[k] ?? 0} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
        </div>
      ))}
      <Button onClick={() => save.mutate(form)}>Salvar pesos</Button>
    </Card>
  );
}

function AuditoriaTab() {
  const initial = { abs_semana: 10, recomendacoes_semana: 50, hot_semana: 20, reunioes_semana: 10 };
  const { data, save } = useConfig(KEYS.auditoriaMin, initial);
  const [form, setForm] = useState(data);
  useEffect(() => { if (data) setForm(data); }, [data]);
  if (!form) return null;
  return (
    <Card className="p-6 bg-surface border-border space-y-3 max-w-xl">
      <p className="text-sm text-muted-foreground">Mínimos operacionais que disparam alertas de auditoria.</p>
      {Object.entries(initial).map(([k]) => (
        <div key={k} className="grid grid-cols-3 items-center gap-3">
          <Label className="col-span-1">{k.replace(/_/g, " ")}</Label>
          <Input type="number" className="col-span-2" value={form[k] ?? 0}
            onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
        </div>
      ))}
      <Button onClick={() => save.mutate(form)}>Salvar</Button>
    </Card>
  );
}

function FrasesTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["frases"],
    queryFn: async () => {
      const { data } = await supabase.from("frases_cultura").select("*").order("ordem");
      return data ?? [];
    },
  });
  const [texto, setTexto] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("frases_cultura").insert({ texto, ordem: (data?.length ?? 0) + 1 });
      if (error) throw error;
    },
    onSuccess: () => { setTexto(""); qc.invalidateQueries({ queryKey: ["frases"] }); toast.success("Frase adicionada"); },
  });
  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("frases_cultura").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["frases"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("frases_cultura").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["frases"] }),
  });

  return (
    <Card className="p-6 bg-surface border-border max-w-2xl">
      <div className="flex gap-2 mb-4">
        <Input placeholder="Nova frase da cultura VINCA..." value={texto} onChange={(e) => setTexto(e.target.value)} />
        <Button onClick={() => texto && add.mutate()}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="divide-y divide-border">
        {(data ?? []).map((f: any) => (
          <div key={f.id} className="py-2 flex items-center gap-3">
            <p className={`flex-1 text-sm ${f.ativo ? "" : "text-muted-foreground line-through"}`}>{f.texto}</p>
            <Switch checked={f.ativo} onCheckedChange={(v) => toggle.mutate({ id: f.id, ativo: v })} />
            <Button variant="ghost" size="icon" onClick={() => remove.mutate(f.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function IntegracoesTab() {
  const initial = {
    google_calendar: { enabled: false, account: "" },
    whatsapp: { enabled: false, numero: "" },
    google_meet: { enabled: false },
    outlook: { enabled: false },
  };
  const { data, save } = useConfig(KEYS.integracoes, initial);
  const [form, setForm] = useState(data);
  useEffect(() => { if (data) setForm(data); }, [data]);
  if (!form) return null;

  return (
    <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
      <IntegrationCard
        icon={<CalendarRange className="h-4 w-4 text-gold" />}
        title="Google Calendar" desc="Sincronização bidirecional de compromissos, bloqueios e treinamentos."
        enabled={form.google_calendar.enabled}
        onToggle={(v) => { const next = { ...form, google_calendar: { ...form.google_calendar, enabled: v }}; setForm(next); save.mutate(next); }}
      >
        <Input placeholder="conta@gmail.com" value={form.google_calendar.account ?? ""}
          onChange={(e) => setForm({ ...form, google_calendar: { ...form.google_calendar, account: e.target.value }})}
          onBlur={() => save.mutate(form)} />
      </IntegrationCard>

      <IntegrationCard
        icon={<SettingsIcon className="h-4 w-4 text-gold" />}
        title="WhatsApp" desc="Envio automático após agendamento (configurável)."
        enabled={form.whatsapp.enabled}
        onToggle={(v) => { const next = { ...form, whatsapp: { ...form.whatsapp, enabled: v }}; setForm(next); save.mutate(next); }}
      >
        <Input placeholder="Número padrão" value={form.whatsapp.numero ?? ""}
          onChange={(e) => setForm({ ...form, whatsapp: { ...form.whatsapp, numero: e.target.value }})}
          onBlur={() => save.mutate(form)} />
      </IntegrationCard>

      <IntegrationCard
        icon={<SettingsIcon className="h-4 w-4 text-gold" />}
        title="Google Meet" desc="Geração automática de link em compromissos online."
        enabled={form.google_meet.enabled}
        onToggle={(v) => { const next = { ...form, google_meet: { ...form.google_meet, enabled: v }}; setForm(next); save.mutate(next); }}
      />
      <IntegrationCard
        icon={<SettingsIcon className="h-4 w-4 text-gold" />}
        title="Outlook" desc="Estrutura preparada para integrar agenda corporativa."
        enabled={form.outlook.enabled}
        onToggle={(v) => { const next = { ...form, outlook: { ...form.outlook, enabled: v }}; setForm(next); save.mutate(next); }}
      />
    </div>
  );
}

function IntegrationCard({ icon, title, desc, enabled, onToggle, children }: {
  icon: React.ReactNode; title: string; desc: string; enabled: boolean;
  onToggle: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <Card className="p-5 bg-surface border-border">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">{icon}<p className="font-medium">{title}</p></div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      <p className="text-xs text-muted-foreground mb-3">{desc}</p>
      {children}
    </Card>
  );
}
