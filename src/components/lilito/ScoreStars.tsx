import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScoreStars({ score, className }: { score?: number | null; className?: string }) {
  if (!score) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-medium text-gold leading-none",
        className,
      )}
      title={`Score ${score}/5`}
    >
      <Star className="h-3 w-3 fill-gold text-gold" />
      {score}
    </span>
  );
}
