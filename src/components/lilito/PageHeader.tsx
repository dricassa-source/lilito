import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string; title: string; description?: string; actions?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          {eyebrow && <p className="caps-tracking text-gold mb-2">{eyebrow}</p>}
          <h1 className="font-display text-4xl font-semibold text-foreground">{title}</h1>
          {description && <p className="text-muted-foreground mt-2 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="hairline-gold mt-6 opacity-40" />
    </div>
  );
}
