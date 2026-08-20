"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useResalesQuery, useClientsQuery, useCondominiumsQuery } from "@/hooks/use-tenancy-queries";
import { createResale, createClient, createCondominium } from "@/lib/api/tenancy";
import { useSessionStore } from "@/lib/auth/session-store";
import { PERMISSIONS, ROLE_DEPTH, roleHasPermission } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/types";

const nameSlugSchema = z.object({
  name: z.string().min(1, "Informe o nome").max(150),
  slug: z
    .string()
    .min(2, "Mínimo 2 caracteres")
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens (ex.: minha-revenda)"),
});
type NameSlugValues = z.infer<typeof nameSlugSchema>;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function CreateEntityDialog({
  title,
  description,
  successMessage,
  onCreate,
}: {
  title: string;
  description: string;
  successMessage: string;
  onCreate: (values: NameSlugValues) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<NameSlugValues>({
    resolver: zodResolver(nameSlugSchema),
    defaultValues: { name: "", slug: "" },
  });

  async function onSubmit(values: NameSlugValues) {
    try {
      await onCreate(values);
      toast.success(successMessage);
      form.reset();
      setOpen(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Não foi possível criar. Tente novamente.";
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{title}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        if (!form.getFieldState("slug").isDirty) {
                          form.setValue("slug", slugify(e.target.value));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Identificador (slug)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Criando..." : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Ativo" : "Inativo"}</Badge>;
}

export default function TenancyPage() {
  const claims = useSessionStore((s) => s.claims);
  const queryClient = useQueryClient();
  const role = claims?.role;
  const depth = role ? ROLE_DEPTH[role] : 3;

  const [selectedResaleId, setSelectedResaleId] = useState<string | null>(
    depth >= 1 ? (claims?.resaleId ?? null) : null,
  );
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    depth >= 2 ? (claims?.clientId ?? null) : null,
  );

  const resalesQuery = useResalesQuery(depth === 0);
  const clientsQuery = useClientsQuery(selectedResaleId);
  const condominiumsQuery = useCondominiumsQuery(selectedClientId);

  const selectedResale = useMemo(
    () => resalesQuery.data?.items.find((r) => r.id === selectedResaleId) ?? null,
    [resalesQuery.data, selectedResaleId],
  );
  const selectedClient = useMemo(
    () => clientsQuery.data?.items.find((c) => c.id === selectedClientId) ?? null,
    [clientsQuery.data, selectedClientId],
  );

  if (!role) return null;

  const canCreateResale = roleHasPermission(role, PERMISSIONS.PLATFORM_MANAGE);
  const canCreateClient = roleHasPermission(role, PERMISSIONS.RESALE_MANAGE);
  const canCreateCondominium = roleHasPermission(role, PERMISSIONS.CLIENT_MANAGE);

  const showResaleLevel = depth === 0 && !selectedResaleId;
  const showClientLevel = depth <= 1 && !!selectedResaleId && (depth === 1 || !selectedClientId);
  const showCondominiumLevel = depth <= 2 && !!selectedClientId;

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            {selectedResaleId && depth === 0 ? (
              <BreadcrumbLink asChild>
                <button onClick={() => { setSelectedResaleId(null); setSelectedClientId(null); }}>
                  Revendas
                </button>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>Revendas</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {selectedResale && depth === 0 && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {selectedClientId ? (
                  <BreadcrumbLink asChild>
                    <button onClick={() => setSelectedClientId(null)}>{selectedResale.name}</button>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{selectedResale.name}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </>
          )}
          {selectedClient && depth <= 1 && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{selectedClient.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {showResaleLevel && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Revendas</h1>
            {canCreateResale && (
              <CreateEntityDialog
                title="Nova revenda"
                description="Cria uma nova revenda no topo da hierarquia."
                successMessage="Revenda criada com sucesso."
                onCreate={async (values) => {
                  await createResale(values.name, values.slug, crypto.randomUUID());
                  await queryClient.invalidateQueries({ queryKey: ["resales"] });
                }}
              />
            )}
          </div>
          {resalesQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resalesQuery.data?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nenhuma revenda cadastrada ainda.
                    </TableCell>
                  </TableRow>
                )}
                {resalesQuery.data?.items.map((resale) => (
                  <TableRow
                    key={resale.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedResaleId(resale.id)}
                  >
                    <TableCell className="font-medium">{resale.name}</TableCell>
                    <TableCell className="text-muted-foreground">{resale.slug}</TableCell>
                    <TableCell>
                      <StatusBadge isActive={resale.isActive} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}

      {showClientLevel && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">
              Clientes{selectedResale ? ` de ${selectedResale.name}` : ""}
            </h1>
            {canCreateClient && (
              <CreateEntityDialog
                title="Novo cliente"
                description="Cria um novo cliente sob esta revenda."
                successMessage="Cliente criado com sucesso."
                onCreate={async (values) => {
                  await createClient(
                    values.name,
                    values.slug,
                    crypto.randomUUID(),
                    depth === 0 ? (selectedResaleId ?? undefined) : undefined,
                  );
                  await queryClient.invalidateQueries({ queryKey: ["clients", selectedResaleId] });
                }}
              />
            )}
          </div>
          {clientsQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsQuery.data?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nenhum cliente cadastrado ainda.
                    </TableCell>
                  </TableRow>
                )}
                {clientsQuery.data?.items.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedClientId(client.id)}
                  >
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-muted-foreground">{client.slug}</TableCell>
                    <TableCell>
                      <StatusBadge isActive={client.isActive} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}

      {showCondominiumLevel && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">
              Condomínios{selectedClient ? ` de ${selectedClient.name}` : ""}
            </h1>
            {canCreateCondominium && (
              <CreateEntityDialog
                title="Novo condomínio"
                description="Cria um novo condomínio sob este cliente."
                successMessage="Condomínio criado com sucesso."
                onCreate={async (values) => {
                  await createCondominium(
                    values.name,
                    values.slug,
                    crypto.randomUUID(),
                    depth <= 1 ? (selectedClientId ?? undefined) : undefined,
                  );
                  await queryClient.invalidateQueries({ queryKey: ["condominiums", selectedClientId] });
                }}
              />
            )}
          </div>
          {condominiumsQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {condominiumsQuery.data?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nenhum condomínio cadastrado ainda.
                    </TableCell>
                  </TableRow>
                )}
                {condominiumsQuery.data?.items.map((condo) => (
                  <TableRow key={condo.id}>
                    <TableCell className="font-medium">{condo.name}</TableCell>
                    <TableCell className="text-muted-foreground">{condo.slug}</TableCell>
                    <TableCell>
                      <StatusBadge isActive={condo.isActive} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}
    </div>
  );
}
