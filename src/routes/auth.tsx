import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/lilito/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — LILITO" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vinda à LILITO.");
        navigate({ to: "/", replace: true });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/`, data: { nome } },
        });
        if (error) throw error;
        toast.success("Conta criada. Faça login.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de redefinição para seu e-mail.");
        setMode("login");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex flex-1 relative items-center justify-center overflow-hidden border-r border-border"
        style={{ background: "radial-gradient(circle at 30% 20%, rgba(200,162,75,0.10), transparent 60%), linear-gradient(135deg, #0a0a0a 0%, #14110d 100%)" }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(45deg, rgba(200,162,75,0.5) 25%, transparent 25%), linear-gradient(-45deg, rgba(200,162,75,0.5) 25%, transparent 25%)",
          backgroundSize: "60px 60px",
        }} />
        <div className="relative z-10 max-w-md px-12">
          <Logo size="lg" />
          <div className="hairline-gold my-8 opacity-50" />
          <p className="font-display text-2xl text-foreground/90 leading-snug italic">
            "Relacionamento, recomendações, proteção patrimonial e gestão comercial em um único lugar."
          </p>
          <p className="caps-tracking text-muted-foreground mt-8">VINCA Assessoria · Seguros de vida para alta performance</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo size="md" /></div>
          <h1 className="font-display text-3xl font-semibold mb-2">
            {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha"}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {mode === "login" ? "Acesse sua plataforma." : mode === "signup" ? "A primeira conta criada será a Master." : "Informe seu e-mail."}
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"} />
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full gold-gradient text-background hover:opacity-90 font-medium tracking-wide">
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-2 text-sm">
            {mode === "login" && (
              <>
                <button onClick={() => setMode("forgot")} className="text-muted-foreground hover:text-gold text-left">Esqueci minha senha</button>
                <button onClick={() => setMode("signup")} className="text-muted-foreground hover:text-gold text-left">Criar uma nova conta</button>
              </>
            )}
            {mode !== "login" && (
              <button onClick={() => setMode("login")} className="text-muted-foreground hover:text-gold text-left">← Voltar ao login</button>
            )}
          </div>
          <div className="mt-10 text-xs text-muted-foreground/70 text-center">
            <Link to="/">Plataforma Oficial da VINCA</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
