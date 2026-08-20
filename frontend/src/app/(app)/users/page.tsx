"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listUsers, createUser } from "@/lib/api/users";
import { useResalesQuery, useClientsQuery, useCondominiumsQuery } from "@/hooks/use-tenancy-queries";
import { useSessionStore } from "@/lib/auth/session-store";
import { ROLE_DEPTH, ROLE_LABELS, UserRole, canProvisionRole } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/types";

const createUserSchema = z.object({
  email: z.string().email("Informe um email válido"),
  password: z.string().min(12, "A senha deve ter ao menos 12 caracteres"),
  role: z.nativeEnum(UserRole),
  resaleId: z.string().uuid().optional().or(z.literal("")),
  clientId: z.string().uuid().optional().or(z.literal("")),
  condominiumId: z.string().uuid().optional().or(z.literal("")),
});
type CreateUserValues = z.infer<typeof createUserSchema>;

function CreateUserDialog({ actorRole }: { actorRole: UserRole }) {
  const queryClient = useQueryClient();
  const claims = useSessionStore((s) => s.claims);
  const actorDepth = ROLE_DEPTH[actorRole];
  const [open, setOpen] = useState(false);

  const provisionableRoles = useMemo(
    () => Object.values(UserRole).filter((r) => canProvisionRole(actorRole, r)),
    [actorRole],
  );

  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      password: "",
      role: provisionableRoles[0],
      resaleId: "",
      clientId: "",
      condominiumId: "",
    },
  });

  const targetRole = useWatch({ control: form.control, name: "role" });
  const targetDepth = targetRole ? ROLE_DEPTH[targetRole] : 0;
  const needsResalePicker = actorDepth < 1 && targetDepth >= 1;
  const needsClientPicker = actorDepth < 2 && targetDepth >= 2;
  const needsCondominiumPicker = actorDepth < 3 && targetDepth >= 3;

  const watchedResaleId = useWatch({ control: form.control, name: "resaleId" });
  const watchedClientId = useWatch({ control: form.control, name: "clientId" });

  const resalesQuery = useResalesQuery(open && needsResalePicker);
  const clientsQuery = useClientsQuery(
    needsClientPicker ? (needsResalePicker ? watchedResaleId : claims?.resaleId) : null,
  );
  const condominiumsQuery = useCondominiumsQuery(
    needsCondominiumPicker ? (needsClientPicker ? watchedClientId : claims?.clientId) : null,
  );

  async function onSubmit(values: CreateUserValues) {
    try {
      await createUser(
        {
          email: values.email,
          password: values.password,
          role: values.role,
          resaleId: values.resaleId || undefined,
          clientId: values.clientId || undefined,
          condominiumId: values.condominiumId || undefined,
        },
        crypto.randomUUID(),
      );
      toast.success("Usuário criado com sucesso.");
      form.reset();
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Não foi possível criar o usuário.";
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Novo usuário</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            A senha definida é temporária — a troca é obrigatória no primeiro login.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha temporária</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione um papel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {provisionableRoles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {needsResalePicker && (
              <FormField
                control={form.control}
                name="resaleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Revenda</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione a revenda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {resalesQuery.data?.items.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {needsClientPicker && (
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientsQuery.data?.items.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {needsCondominiumPicker && (
              <FormField
                control={form.control}
                name="condominiumId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condomínio</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o condomínio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {condominiumsQuery.data?.items.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Criando..." : "Criar usuário"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const claims = useSessionStore((s) => s.claims);
  const usersQuery = useQuery({
    queryKey: ["users", 1, 50],
    queryFn: () => listUsers(1, 50),
  });

  if (!claims) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Usuários</h1>
          <p className="text-sm text-muted-foreground">Contas dentro do seu escopo de gestão.</p>
        </div>
        <CreateUserDialog actorRole={claims.role} />
      </div>

      {usersQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum usuário cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
            {usersQuery.data?.items.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                <TableCell className="flex gap-1.5">
                  <Badge variant={user.isActive ? "default" : "secondary"}>
                    {user.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                  {user.mustChangePassword && <Badge variant="outline">Troca pendente</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("pt-BR") : "Nunca"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
