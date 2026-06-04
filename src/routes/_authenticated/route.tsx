import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/lilito/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { auth, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="font-display text-gold text-3xl tracking-[0.3em] animate-pulse">LILITO</span>
      </div>
    );
  }
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar isMaster={auth?.isMaster ?? false} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border bg-background/70 backdrop-blur px-4 sticky top-0 z-30">
            <SidebarTrigger className="text-muted-foreground hover:text-gold" />
            <div className="h-5 w-px bg-border" />
            <span className="caps-tracking text-muted-foreground">VINCA</span>
            <div className="ml-auto flex items-center gap-3">
              {auth?.isMaster && (
                <Badge variant="outline" className="border-gold text-gold caps-tracking">Master</Badge>
              )}
              <div className="text-right">
                <p className="text-sm text-foreground leading-tight">{auth?.profile?.nome ?? "Consultor"}</p>
                <p className="text-xs text-muted-foreground leading-tight">{auth?.profile?.email}</p>
              </div>
              <div className="h-9 w-9 rounded-full gold-gradient flex items-center justify-center font-semibold text-background">
                {(auth?.profile?.nome ?? "?").slice(0, 1).toUpperCase()}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto px-6 py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
