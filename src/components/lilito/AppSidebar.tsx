import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  Sun, LayoutDashboard, Users2, Flame, CalendarDays, Target, AlertTriangle,
  ListChecks, Users, FileText, Heart, RefreshCcw, Trophy, Settings, LogOut,
  TrendingUp, CircleDot, Bell, ShieldCheck, Handshake,
} from "lucide-react";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

const items = [
  { title: "Meu Dia", url: "/", icon: Sun },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Recomendações", url: "/recomendacoes", icon: Users2 },
  { title: "HOT", url: "/hot", icon: Flame },
  { title: "Calendário", url: "/calendario", icon: CalendarDays },
  { title: "Funil", url: "/funil", icon: Target },
  { title: "Em Delay", url: "/em-delay", icon: AlertTriangle },
  { title: "Resultado Semanal", url: "/resultado-semanal", icon: TrendingUp },
  { title: "Lembretes", url: "/lembretes", icon: Bell },
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

const fase2 = [
  { title: "Pós-venda", url: "/pos-venda", icon: Heart },
  { title: "Ciclo de Revisão", url: "/ciclo-revisao", icon: RefreshCcw },
];

export function AppSidebar({ isMaster }: { isMaster: boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const isActive = (url: string) => path === url || (url !== "/" && path.startsWith(url));

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
              {items.map((item) => (
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

        {!collapsed && (
          <div className="px-4 mt-6 mb-2">
            <div className="hairline-gold opacity-60" />
            <p className="caps-tracking text-muted-foreground mt-4 mb-2">Fase 2 — em breve</p>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {fase2.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={`${item.title} — em breve`} className="opacity-50">
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" strokeWidth={1.5} />
                      <span className="text-sm">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
