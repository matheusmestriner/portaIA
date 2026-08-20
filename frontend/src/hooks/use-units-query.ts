import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listUnits } from "@/lib/api/condominial";

/** 100 é o teto de pageSize aceito pela API (ver paginationQuerySchema). */
const MAX_PAGE_SIZE = 100;

export function useUnitsQuery(condominiumId: string | null | undefined) {
  return useQuery({
    queryKey: ["units", condominiumId, "picker"],
    queryFn: () => listUnits(condominiumId as string, 1, MAX_PAGE_SIZE),
    enabled: !!condominiumId,
  });
}

export function formatUnitLabel(unit: { identifier: string; block: string | null }): string {
  return unit.block ? `${unit.block} — ${unit.identifier}` : unit.identifier;
}

/** Maps unitId -> a human-readable label, for tables that only get a unitId back from list endpoints. */
export function useUnitLabels(condominiumId: string | null | undefined): Record<string, string> {
  const unitsQuery = useUnitsQuery(condominiumId);
  return useMemo(() => {
    const map: Record<string, string> = {};
    for (const unit of unitsQuery.data?.items ?? []) {
      map[unit.id] = formatUnitLabel(unit);
    }
    return map;
  }, [unitsQuery.data]);
}
