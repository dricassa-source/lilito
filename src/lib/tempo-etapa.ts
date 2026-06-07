// Helpers compartilhados de "tempo na etapa" e paleta oficial de etapas.

export function diasNaEtapa(entrouEtapaEm?: string | null): number {
  if (!entrouEtapaEm) return 0;
  const ms = Date.now() - new Date(entrouEtapaEm).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Classes Tailwind para o dot do semáforo (🟢 0–3 / 🟡 4–7 / 🔴 8+). */
export function etapaDotClass(dias: number): string {
  if (dias <= 3) return "bg-emerald-500";
  if (dias <= 7) return "bg-yellow-500";
  return "bg-destructive";
}

/** Emoji do semáforo, conveniente em locais sem Tailwind. */
export function etapaDotEmoji(dias: number): string {
  if (dias <= 3) return "🟢";
  if (dias <= 7) return "🟡";
  return "🔴";
}

/** Paleta oficial de etapas / tipos de compromisso. */
export const ETAPA_COLORS: Record<string, { bg: string; fg: string; ring: string }> = {
  hot:              { bg: "bg-orange-500/20",  fg: "text-orange-500",  ring: "ring-orange-500/40" },
  ab:               { bg: "bg-yellow-500/20",  fg: "text-yellow-500",  ring: "ring-yellow-500/40" },
  revisita:         { bg: "bg-blue-500/20",    fg: "text-blue-400",    ring: "ring-blue-500/40" },
  fechamento:       { bg: "bg-emerald-600/20", fg: "text-emerald-500", ring: "ring-emerald-600/40" },
  onboarding:       { bg: "bg-emerald-300/20", fg: "text-emerald-300", ring: "ring-emerald-300/40" },
  entrega_apolice:  { bg: "bg-emerald-300/20", fg: "text-emerald-300", ring: "ring-emerald-300/40" },
  cliente:          { bg: "bg-gold/20",        fg: "text-gold",        ring: "ring-gold/40" },
  pos_venda:        { bg: "bg-gold/20",        fg: "text-gold",        ring: "ring-gold/40" },
  delay:            { bg: "bg-destructive/20", fg: "text-destructive", ring: "ring-destructive/40" },
};

export function etapaColors(tipo?: string | null) {
  return ETAPA_COLORS[tipo ?? ""] ?? { bg: "bg-muted", fg: "text-muted-foreground", ring: "ring-border" };
}

export const ETAPA_LABEL: Record<string, string> = {
  hot: "HOT",
  ab: "AB",
  revisita: "Revisita",
  fechamento: "Fechamento",
  onboarding: "Onboarding",
  entrega_apolice: "Entrega de Apólice",
  cliente: "Cliente",
  pos_venda: "Pós-Venda",
};
