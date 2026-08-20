/**
 * Mirrors backend/src/auth/rbac/permissions.ts and role-hierarchy.ts.
 * The backend is the source of truth and re-checks every write — this copy
 * only drives client-side nav visibility and form gating, never a security
 * boundary. Keep in sync by hand when the backend matrix changes.
 */

export const UserRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  RESALE_ADMIN: "RESALE_ADMIN",
  RESALE_OPERATOR: "RESALE_OPERATOR",
  CLIENT_ADMIN: "CLIENT_ADMIN",
  CLIENT_OPERATOR: "CLIENT_OPERATOR",
  CONDO_MANAGER: "CONDO_MANAGER",
  CONDO_OPERATOR: "CONDO_OPERATOR",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const PERMISSIONS = {
  PLATFORM_MANAGE: "platform:manage",
  RESALE_MANAGE: "resale:manage",
  CLIENT_MANAGE: "client:manage",
  CONDOMINIUM_MANAGE: "condominium:manage",
  USER_MANAGE: "user:manage",
  FEATURE_FLAG_MANAGE: "feature_flag:manage",
  WHITE_LABEL_MANAGE: "white_label:manage",
  COMMUNICATION_MANAGE: "communication:manage",
  PRIVACY_MANAGE: "privacy:manage",
  GATEHOUSE_OPERATE: "gatehouse:operate",
  SECURITY_OPERATE: "security:operate",
  TELEPHONY_OPERATE: "telephony:operate",
  AUDIT_VIEW: "audit:view",
  REPORTS_VIEW: "reports:view",
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

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
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
  CONDO_OPERATOR: new Set([
    PERMISSIONS.GATEHOUSE_OPERATE,
    PERMISSIONS.SECURITY_OPERATE,
    PERMISSIONS.TELEPHONY_OPERATE,
  ]),
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Depth in the tenancy tree: 0 = platform, 1 = resale, 2 = client, 3 = condominium. */
export const ROLE_DEPTH: Record<UserRole, number> = {
  SUPER_ADMIN: 0,
  RESALE_ADMIN: 1,
  RESALE_OPERATOR: 1,
  CLIENT_ADMIN: 2,
  CLIENT_OPERATOR: 2,
  CONDO_MANAGER: 3,
  CONDO_OPERATOR: 3,
};

export function canProvisionRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (targetRole === UserRole.SUPER_ADMIN) return false;
  return ROLE_DEPTH[targetRole] >= ROLE_DEPTH[actorRole];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  RESALE_ADMIN: "Admin da Revenda",
  RESALE_OPERATOR: "Operador da Revenda",
  CLIENT_ADMIN: "Admin do Cliente",
  CLIENT_OPERATOR: "Operador do Cliente",
  CONDO_MANAGER: "Síndico/Gestor do Condomínio",
  CONDO_OPERATOR: "Porteiro/Operador",
};
