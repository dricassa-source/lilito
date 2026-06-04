import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, description, action }: {
  icon?: LucideIcon; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 border border-dashed border-border rounded-md bg-surface/40">
      {Icon && <Icon className="h-10 w-10 text-gold mb-4" strokeWidth={1.2} />}
      <h3 className="font-display text-2xl text-foreground">{title}</h3>
      {description && <p className="text-muted-foreground text-sm mt-2 max-w-md">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
