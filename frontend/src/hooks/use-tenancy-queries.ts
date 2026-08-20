import { useQuery } from "@tanstack/react-query";
import { listResales, listClients, listCondominiums } from "@/lib/api/tenancy";

const PICKER_PAGE_SIZE = 100;

export function useResalesQuery(enabled = true) {
  return useQuery({
    queryKey: ["resales", "picker"],
    queryFn: () => listResales(1, PICKER_PAGE_SIZE),
    enabled,
  });
}

export function useClientsQuery(resaleId: string | null | undefined) {
  return useQuery({
    queryKey: ["clients", resaleId, "picker"],
    queryFn: () => listClients(resaleId as string, 1, PICKER_PAGE_SIZE),
    enabled: !!resaleId,
  });
}

export function useCondominiumsQuery(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ["condominiums", clientId, "picker"],
    queryFn: () => listCondominiums(clientId as string, 1, PICKER_PAGE_SIZE),
    enabled: !!clientId,
  });
}
