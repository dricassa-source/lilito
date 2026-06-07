import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sun, LayoutDashboard, Users2, Flame, CalendarDays, Target, AlertTriangle,
  ListChecks, Users, FileText, Trophy, Settings, LogOut,
  TrendingUp, CircleDot, ShieldCheck, Handshake,
} from "lucide-react";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const ETAPAS_DELAY = ["ab", "revisita", "fechamento", "entrega_apolice"];

function useDelaysCount() {
  const { auth } = useAuth();
  const q = useQuery({
    queryKey: ["em-delay-count", auth?.user.id, auth?.isMaster],
    enabled: !!auth,
    queryFn: async () => {
      let req = supabase.from("agenda_eventos")
        .select("id,tipo,etapa_origem,consultor_id")
        .not("delay_em", "is", null)
        .eq("delay_resolvido", false);
      if (!auth?.isMaster) req = req.eq("consultor_id", auth!.user.id);
      const { data, error } = await req;
      if (error) return 0;
      return (data ?? []).filter((d: any) => ETAPAS_DELAY.includes(d.etapa_origem ?? d.tipo)).length;
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!auth) return;
    const ch = supabase
      .channel("sidebar-delays")
      .on("postgres_changes", { event: "*", schema: "public", table: "agenda_eventos" }, () => {
        q.refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.user.id]);

  return q.data ?? 0;
}

type NavItem = { title: string; url: string; icon: typeof Sun; badge?: "delays" };

const items: NavItem[] = [
  { title: "Meu Dia", url: "/", icon: Sun },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Recomendações", url: "/recomendacoes", icon: Users2 },
  { title: "HOT", url: "/hot", icon: Flame },
  { title: "Calendário", url: "/calendario", icon: CalendarDays },
  { title: "Funil", url: "/funil", icon: Target },
  { title: "Em Delay", url: "/em-delay", icon: AlertTriangle, badge: "delays" },
  { title: "Resultado Semanal", url: "/resultado-semanal", icon: TrendingUp },
  { title: "Onboarding", url: "/onboarding", icon: CircleDot },
  { title: "Atividades", url: "/atividades", icon: ListChecks },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Análise de Apólices", url: "/apolices", icon: FileText },
  { title: "Planejamento", url: "/planejamento", icon: Trophy },
];

const masterItems = [
  { title: "Auditoria", url: "/auditoria", icon: ShieldCheck },
  { title: "Joint Work", url: "/joint", icon: Handshake },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];


export function AppSidebar({ isMaster }: { isMaster: boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const isActive = (url: string) => path === url || (url !== "/" && path.startsWith(url));
  const delaysCount = useDelaysCount();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-5 border-b border-sidebar-border">
        {collapsed ? (
          <span className="font-display text-gold text-2xl text-center w-full">L</span>
        ) : (
          <Logo size="sm" />
        )}
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const showBadge = item.badge === "delays" && delaysCount > 0;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={showBadge ? `${item.title} (${delaysCount})` : item.title}
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-gold data-[active=true]:border-l-2 data-[active=true]:border-gold rounded-none">
                      <Link to={item.url} className="flex items-center gap-3">
                        <span className="relative">
                          <item.icon className="h-4 w-4" strokeWidth={1.5} />
                          {showBadge && collapsed && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-1 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center leading-none">{delaysCount}</span>
                          )}
                        </span>
                        <span className="text-sm flex-1">{item.title}</span>
                        {showBadge && !collapsed && (
                          <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">{delaysCount}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {isMaster && masterItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-gold data-[active=true]:border-l-2 data-[active=true]:border-gold rounded-none">
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" strokeWidth={1.5} />
                      <span className="text-sm">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isMaster && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/administracao")} tooltip="Administração"
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-gold data-[active=true]:border-l-2 data-[active=true]:border-gold rounded-none">
                    <Link to="/administracao" className="flex items-center gap-3">
                      <Settings className="h-4 w-4" strokeWidth={1.5} />
                      <span className="text-sm">Administração</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sair">
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
              <span className="text-sm">Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
