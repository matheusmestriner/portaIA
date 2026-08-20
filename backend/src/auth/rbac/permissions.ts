import { UserRole } from '@prisma/client';

// Catalog of permission keys used to gate menu items, pages, buttons,
// actions and API endpoints. Extend this list as new modules land; keep
// grouped by domain area for readability.
export const PERMISSIONS = {
  PLATFORM_MANAGE: 'platform:manage', // super admin: create/edit Resales, plans, global white-label
  RESALE_MANAGE: 'resale:manage', // create/edit Client rows under a Resale
  CLIENT_MANAGE: 'client:manage', // create/edit Condominium rows under a Client
  CONDOMINIUM_MANAGE: 'condominium:manage', // create/edit units/residents/vehicles/providers under a Condominium
  USER_MANAGE: 'user:manage',
  FEATURE_FLAG_MANAGE: 'feature_flag:manage',
  WHITE_LABEL_MANAGE: 'white_label:manage',
  COMMUNICATION_MANAGE: 'communication:manage', // comunicados e disparo de notificações
  PRIVACY_MANAGE: 'privacy:manage', // consentimentos, solicitações LGPD, legal hold
  GATEHOUSE_OPERATE: 'gatehouse:operate', // Portaria Rápida, visitantes, entregas, chaves
  SECURITY_OPERATE: 'security:operate', // ocorrências, botão de pânico, bloqueios
  TELEPHONY_OPERATE: 'telephony:operate', // ramais, originar chamada da portaria, gravações
  AUDIT_VIEW: 'audit:view',
  REPORTS_VIEW: 'reports:view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_RESALE_LEVEL: Permission[] = [
  PERMISSIONS.RESALE_MANAGE,
  PERMISSIONS.CLIENT_MANAGE,
  PERMISSIONS.CONDOMINIUM_MANAGE,
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.FEATURE_FLAG_MANAGE,
  PERMISSIONS.WHITE_LABEL_MANAGE,
  PERMISSIONS.COMMUNICATION_MANAGE,
  PERMISSIONS.PRIVACY_MANAGE,
  PERMISSIONS.AUDIT_VIEW,
  PERMISSIONS.REPORTS_VIEW,
];

const ALL_CONDO_LEVEL: Permission[] = [
  PERMISSIONS.GATEHOUSE_OPERATE,
  PERMISSIONS.SECURITY_OPERATE,
  PERMISSIONS.TELEPHONY_OPERATE,
  PERMISSIONS.REPORTS_VIEW,
];

export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  SUPER_ADMIN: new Set(Object.values(PERMISSIONS)),
  RESALE_ADMIN: new Set(ALL_RESALE_LEVEL),
  RESALE_OPERATOR: new Set([PERMISSIONS.CLIENT_MANAGE, PERMISSIONS.REPORTS_VIEW]),
  CLIENT_ADMIN: new Set([
    PERMISSIONS.CLIENT_MANAGE,
    PERMISSIONS.CONDOMINIUM_MANAGE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.WHITE_LABEL_MANAGE,
    PERMISSIONS.COMMUNICATION_MANAGE,
    PERMISSIONS.PRIVACY_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ]),
  CLIENT_OPERATOR: new Set([PERMISSIONS.REPORTS_VIEW]),
  CONDO_MANAGER: new Set([
    ...ALL_CONDO_LEVEL,
    PERMISSIONS.CONDOMINIUM_MANAGE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.WHITE_LABEL_MANAGE,
    PERMISSIONS.COMMUNICATION_MANAGE,
    PERMISSIONS.PRIVACY_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
  ]),
  // Set(ALL_CONDO_LEVEL), não uma lista à mão: este papel já perdeu
  // TELEPHONY_OPERATE uma vez exatamente por ser escrito manualmente e não
  // acompanhar o array (ver docs/V01_SCOPE.md), e perdeu REPORTS_VIEW pelo
  // mesmo motivo — o que deixava o porteiro sem enxergar a própria fila de
  // chamadas, os ramais do condomínio, os comunicados e o painel de contagens.
  // REPORTS_VIEW aqui não expõe dado novo: são agregações de registros que
  // este papel já lista individualmente via as permissões de operação, no
  // mesmo condomínio delimitado pela RLS.
  CONDO_OPERATOR: new Set(ALL_CONDO_LEVEL),
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
