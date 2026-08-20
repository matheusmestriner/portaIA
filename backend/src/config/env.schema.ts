import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3101),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),
  // Conexão usada pela aplicação em runtime, com um papel Postgres restrito
  // (sem SUPERUSER/BYPASSRLS) para que as políticas de Row-Level Security
  // tenham efeito. DATABASE_URL (superuser/owner) é usada apenas para migrations.
  // Ver prisma/provisioning/create-app-role.sql. Cai para DATABASE_URL se ausente
  // (uso local/dev sem separação de papéis).
  APP_DATABASE_URL: z.string().min(1).optional(),
  SUPER_ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_BOOTSTRAP_PASSWORD: z.string().min(12).optional(),
  // Refresh tokens são opacos (aleatórios, hasheados com SHA-256 e
  // persistidos para permitir revogação), não JWT — por isso só o access
  // token precisa de um segredo de assinatura.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET deve ter ao menos 32 caracteres'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  // HMAC compartilhado usado para autenticar o webhook de eventos de
  // telefonia (POST /telephony/events) — não é um usuário autenticado via
  // JWT, é uma futura ponte AMI/ARI assinando a requisição. Ver
  // telephony/http/hmac-webhook.guard.ts.
  TELEPHONY_WEBHOOK_SECRET: z.string().min(32, 'TELEPHONY_WEBHOOK_SECRET deve ter ao menos 32 caracteres'),
  // Chave simétrica (AES-256-GCM) para cifrar a senha SIP de cada ramal em
  // repouso — precisa ser reversível (não hash) porque o provisionamento
  // real do PJSIP precisa ler a senha de volta. 64 hex chars = 32 bytes.
  TELEPHONY_SIP_SECRET_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'TELEPHONY_SIP_SECRET_KEY deve ser uma chave hex de 32 bytes (64 caracteres)'),
  // Origem do frontend Next.js — precisa ser exata (não wildcard) porque a
  // sessão usa cookies (refresh + CSRF) com `credentials: true`, e CORS não
  // permite `Access-Control-Allow-Origin: *` combinado com credenciais.
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  // Número de proxies reversos confiáveis na frente da aplicação (ex.: 1
  // para nginx/ALB direto). Sem isso, req.ip é sempre o socket direto — o
  // que é seguro por padrão, mas faz o rate limit por IP do Throttler
  // enxergar só o IP do proxy (todo mundo atrás dele compartilha o mesmo
  // balde) em vez do IP real do cliente. Setar errado (maior que o número
  // real de hops) permite que o PRÓPRIO cliente forje X-Forwarded-For e
  // escolha o IP que quiser — só aumente isto quando a topologia real de
  // deploy tiver exatamente esse tanto de proxies confiáveis na frente.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  // Diretório onde as fotos operacionais são gravadas. Interface de object
  // store por dentro (ver StorageService) para trocar por MinIO/S3 depois.
  STORAGE_ROOT: z.string().min(1).default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(50).default(8),
  // Janela de validade da credencial de retirada (código numérico + QR) que
  // o morador apresenta na portaria.
  PICKUP_CREDENTIAL_TTL_HOURS: z.coerce.number().int().positive().max(720).default(48),
  // Chave HMAC dedicada para hashear código de retirada/token de QR —
  // separada de JWT_ACCESS_SECRET de propósito: um vazamento desta não deve
  // dar a quem o obteve capacidade de forjar tokens de sessão completos.
  PICKUP_CREDENTIAL_SECRET: z.string().min(32, 'PICKUP_CREDENTIAL_SECRET deve ter ao menos 32 caracteres'),
  // Ponte Go + whatsmeow. Sem URL configurada o adapter permanece um stub
  // honesto (relata "não configurado" em vez de fingir envio).
  WHATSAPP_SERVICE_URL: z.string().url().optional(),
  WHATSAPP_SERVICE_SECRET: z.string().min(32).optional(),
  // JWT de acesso do app do morador é assinado com a mesma JWT_ACCESS_SECRET
  // (o `audience` já diferencia um token de morador de um token de equipe —
  // ver resident-auth/resident-token.service.ts), então não precisa de
  // segredo próprio.
  RESIDENT_JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  RESIDENT_JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  // Domínio SIP que o app do morador usa para registrar o softphone contra o
  // Asterisk (ver GET /resident/telephony/credentials). Nenhum Asterisk real
  // está conectado na V01 (mesma ressalva do resto do módulo telephony) —
  // sem isso configurado, o endpoint devolve domain: null e o app mostra
  // "SIP: aguardando configuração do servidor" em vez de fingir que registrou.
  SIP_DOMAIN: z.string().min(1).optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuração de ambiente inválida: ${issues}`);
  }
  return result.data;
}
