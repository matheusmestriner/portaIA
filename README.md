# PortariaFlow

MVP SaaS multi-condomínio para portaria inteligente com entregas, moradores, câmeras, mosaico, acessos, auditoria e WhatsApp via provider desacoplado.

## Stack
- Frontend: React + TypeScript + Vite
- Backend: FastAPI + SQLAlchemy + PostgreSQL
- Cache/fila: Redis (preparado)
- Storage: MinIO/S3 compatível (preparado)
- WhatsApp: microsserviço Go com abstração para WhatsMeow
- Deploy local: Docker Compose

## Como rodar
```bash
cp .env.example .env
docker compose up --build
```

Serviços:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs
- WhatsApp service: http://localhost:8081/health
- MinIO: http://localhost:9001

Login seed:
- e-mail: `superadmin@portariaflow.local`
- senha: `ChangeMe123!`

## Desenvolvimento local sem Docker
Backend:
```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

WhatsApp service:
```bash
cd services/whatsapp
go run .
```

## Endpoints principais
Consulte `docs/API.md` e `/docs` no FastAPI.

## Checklist MVP
- [x] Login JWT com refresh token
- [x] RBAC por perfis
- [x] Multi-tenancy por `tenant_id`
- [x] CRUD de condomínios, usuários, unidades, moradores e entregas
- [x] Upload/cadastro de foto de entrega via URL/objeto preparado para S3
- [x] Retirada e histórico de entregas
- [x] Notificações com `MessageProvider` e WhatsMeow adapter desacoplado
- [x] QR/status WhatsApp
- [x] Câmeras e mosaico básico
- [x] Webhook genérico de controle de acesso
- [x] Relatórios básicos
- [x] Logs de auditoria e notificação
- [x] Docker Compose, migrations, seeds e `.env.example`

## Preparado para integração real
- MediaMTX/FFmpeg para conversão RTSP -> HLS/WebRTC.
- MinIO/S3 com URLs assinadas para fotos privadas.
- WhatsMeow real: o serviço Go expõe o contrato e pontos de substituição; o cliente atual é seguro para ambiente local.
- Cloud API/SMS/E-mail podem ser adicionados implementando `MessageProvider`.

## Segurança
- Senhas com bcrypt.
- JWT access/refresh.
- Rate limit no backend.
- CORS configurável.
- Validação com Pydantic.
- Credenciais de câmera criptografadas no backend e nunca retornadas para o frontend.
- Toda tabela operacional possui isolamento por tenant.
