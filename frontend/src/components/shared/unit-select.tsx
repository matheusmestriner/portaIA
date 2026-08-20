"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatUnitLabel, useUnitsQuery } from "@/hooks/use-units-query";

export function UnitSelect({
  condominiumId,
  value,
  onChange,
  placeholder = "Selecione a unidade",
}: {
  condominiumId: string;
  value: string;
  onChange: (unitId: string) => void;
  placeholder?: string;
}) {
  const unitsQuery = useUnitsQuery(condominiumId);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {unitsQuery.data?.items.map((unit) => (
          <SelectItem key={unit.id} value={unit.id}>
            {formatUnitLabel(unit)}
          </SelectItem>
        ))}
        {unitsQuery.data?.items.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma unidade cadastrada</div>
        )}
      </SelectContent>
    </Select>
  );
}
