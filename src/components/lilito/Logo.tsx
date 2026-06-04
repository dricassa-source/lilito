export function Logo({ size = "md", showSubtitle = true }: { size?: "sm" | "md" | "lg"; showSubtitle?: boolean }) {
  const titleSize = size === "lg" ? "text-5xl" : size === "sm" ? "text-xl" : "text-3xl";
  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={`font-display ${titleSize} font-semibold tracking-[0.25em] text-gold`}
        style={{ textShadow: "0 0 30px rgba(200,162,75,0.15)" }}
      >
        LILITO
      </span>
      {showSubtitle && (
        <span className="caps-tracking text-muted-foreground">Plataforma Oficial da VINCA</span>
      )}
    </div>
  );
}
