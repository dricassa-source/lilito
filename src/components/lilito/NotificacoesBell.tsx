import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useConsultorScope, applyScope } from "@/hooks/useConsultorScope";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  to: string;
  group: string;
};

const ETAPAS_DELAY = ["ab", "revisita", "fechamento", "entrega_apolice"];

export function NotificacoesBell() {
  const { auth } = useAuth();
  const { scopeIds } = useConsultorScope();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const scopeKey = scopeIds.join(",");

  const { data, refetch } = useQuery({
    queryKey: ["notificacoes-bell", scopeKey],
    enabled: !!auth && scopeIds.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const hoje = new Date(); hoje.setHours(23, 59, 59, 999);
      const hojeISO = hoje.toISOString();
      const hojeStr = new Date().toISOString().slice(0, 10);

      const [delays, lembs, fups, onb] = await Promise.all([
        applyScope(supabase.from("agenda_eventos")
          .select("id,titulo,prospect_id,etapa_origem,tipo,delay_em,prospects(nome)")
          .not("delay_em", "is", null).eq("delay_resolvido", false), scopeIds),
        applyScope(supabase.from("lembretes")
          .select("id,titulo,data,hora,prospect_id,prospects(nome)")
          .lte("data", hojeStr).eq("concluido", false), scopeIds),
        applyScope(supabase.from("atividades")
          .select("id,prospect_id,observacao,follow_up_em,prospects(nome)")
          .not("follow_up_em", "is", null)
          .lte("follow_up_em", hojeISO), scopeIds),

        applyScope(supabase.from("prospects")
          .select("id,nome,etapa_funil")
          .in("etapa_funil", ["implantacao", "entrega_apolice"]), scopeIds),
      ]);

      const items: Item[] = [];
      (delays.data ?? []).forEach((d: any) => {
        if (!ETAPAS_DELAY.includes(d.etapa_origem ?? d.tipo)) return;
        items.push({
          id: `delay-${d.id}`, icon: "🚩", group: "Delays",
          title: d.prospects?.nome ?? d.titulo ?? "Evento em delay",
          subtitle: "Destravar no Em Delay",
          to: "/em-delay",
        });
      });
      (fups.data ?? []).forEach((f: any) => items.push({
        id: `fup-${f.id}`, icon: "⏰", group: "Follow-ups vencidos",
        title: f.prospects?.nome ?? "Follow-up",
        subtitle: f.observacao ?? undefined,
        to: "/",
      }));
      (lembs.data ?? []).forEach((l: any) => items.push({
        id: `lemb-${l.id}`, icon: "🔔", group: "Lembretes",
        title: l.titulo,
        subtitle: l.prospects?.nome ?? l.data,
        to: "/calendario",
      }));
      (onb.data ?? []).forEach((o: any) => items.push({
        id: `onb-${o.id}`, icon: "📦", group: "Onboarding pendente",
        title: o.nome, to: "/onboarding",
      }));

      return items;
    },
  });

  useEffect(() => {
    if (!auth) return;
    const ch = supabase
      .channel("notif-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "agenda_eventos" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "lembretes" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "atividades" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [auth?.user.id]); // eslint-disable-line

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    (data ?? []).forEach((i) => {
      if (!map.has(i.group)) map.set(i.group, []);
      map.get(i.group)!.push(i);
    });
    return Array.from(map.entries());
  }, [data]);

  const total = data?.length ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-gold transition"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" strokeWidth={1.5} />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center leading-none">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-h-[70vh] overflow-y-auto p-0 bg-surface border-border">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <p className="caps-tracking text-gold">Notificações</p>
          <span className="text-xs text-muted-foreground">{total} pendente{total === 1 ? "" : "s"}</span>
        </div>
        {grouped.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Nada pendente. ✨</div>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(([group, items]) => (
              <div key={group} className="py-2">
                <p className="px-3 caps-tracking text-[10px] text-muted-foreground mb-1">{group}</p>
                {items.slice(0, 8).map((i) => (
                  <button
                    key={i.id}
                    onClick={() => { setOpen(false); navigate({ to: i.to as any }); }}
                    className={cn("w-full text-left px-3 py-2 hover:bg-surface-elevated transition flex items-start gap-2")}
                  >
                    <span className="text-base leading-none mt-0.5">{i.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate text-foreground">{i.title}</p>
                      {i.subtitle && <p className="text-xs text-muted-foreground truncate">{i.subtitle}</p>}
                    </div>
                  </button>
                ))}
                {items.length > 8 && (
                  <p className="px-3 py-1 text-[11px] text-muted-foreground">+{items.length - 8} mais…</p>
                )}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
