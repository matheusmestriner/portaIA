"use client";

import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listResidents } from "@/lib/api/condominial";

/** Valor sentinela: o Radix Select não aceita SelectItem com value="". */
export const NO_RESIDENT = "__unit__";

/**
 * Escolhe o morador destinatário de uma entrega. Sem destinatário, o código
 * de retirada não tem para quem ser enviado no WhatsApp — por isso a opção
 * "entrega para a unidade" avisa disso explicitamente.
 */
export function ResidentSelect({
  condominiumId,
  unitId,
  value,
  onChange,
}: {
  condominiumId: string;
  unitId: string;
  value: string;
  onChange: (residentId: string) => void;
}) {
  const residentsQuery = useQuery({
    queryKey: ["residents", condominiumId, unitId, "picker"],
    queryFn: () => listResidents({ unitId }, 1, 100),
    enabled: !!unitId,
  });

  const residents = residentsQuery.data?.items ?? [];

  return (
    <Select value={value} onValueChange={onChange} disabled={!unitId}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={unitId ? "Selecione o destinatário" : "Selecione a unidade primeiro"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_RESIDENT}>Entrega para a unidade (sem aviso no WhatsApp)</SelectItem>
        {residents.map((resident) => (
          <SelectItem key={resident.id} value={resident.id}>
            {resident.name}
            {resident.phone ? ` · ${resident.phone}` : " · sem telefone"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
