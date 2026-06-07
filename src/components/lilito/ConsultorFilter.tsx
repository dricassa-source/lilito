import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConsultorScope } from "@/hooks/useConsultorScope";

/**
 * Filtro global Master/Consultor.
 * - Master vê o Select (Unidade + cada consultor).
 * - Consultor não vê nada.
 */
export function ConsultorFilter({ className }: { className?: string }) {
  const { isMaster, consultores, consultorId, setConsultorId } = useConsultorScope();
  if (!isMaster) return null;

  return (
    <div className={className ?? "mb-6 flex items-center gap-2"}>
      <span className="caps-tracking text-muted-foreground text-[0.6rem]">Visão</span>
      <Select
        value={consultorId ?? "unidade"}
        onValueChange={(v) => setConsultorId(v === "unidade" ? null : v)}
      >
        <SelectTrigger className="w-64 bg-surface border-border">
          <SelectValue placeholder="Unidade (Consolidado)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unidade">Unidade (Consolidado)</SelectItem>
          {consultores.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
