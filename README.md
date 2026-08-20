# Portalia

Sistema de gestão condominial, portaria e operações remotas.

## Estrutura

- `frontend`: Next.js 16, React 19 e Tailwind.
- `backend`: NestJS, Prisma e PostgreSQL.
- `mobile`: aplicação do morador.
- `docs`: arquitetura e decisões do produto.

## Requisitos locais

- Node.js 20 ou superior.
- PostgreSQL 16 ou superior.
- npm.

## Configuração local

1. Copie `backend/.env.example` para `backend/.env` e configure os segredos locais.
2. Copie `frontend/.env.example` para `frontend/.env.local`.
3. Crie o banco PostgreSQL informado no `DATABASE_URL`.
4. No diretório `backend`, execute `npm run prisma:generate` e `npm run prisma:migrate:deploy`.
5. Defina `SUPER_ADMIN_BOOTSTRAP_EMAIL` e `SUPER_ADMIN_BOOTSTRAP_PASSWORD` no ambiente e execute `npm run bootstrap:super-admin` uma única vez.

## Execução

Em dois terminais:

```powershell
cd backend
npm run start:dev
```

```powershell
cd frontend
npm run dev
```

O frontend inicia em `http://localhost:3000` e a API em `http://localhost:3101`.

## Validação

```powershell
cd backend
npm test -- --runInBand
npm run build
```

```powershell
cd frontend
npm run lint
npm run build
```

## Segurança

- Não versione arquivos `.env` nem fotos de armazenamento local.
- Use segredos diferentes para JWT, retirada de entrega e telefonia.
- Em produção, configure `APP_DATABASE_URL` com um papel PostgreSQL sem `SUPERUSER` e sem `BYPASSRLS`.
- Defina `FRONTEND_URL` com a origem HTTPS exata do ambiente publicado.
