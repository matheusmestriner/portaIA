import { SetMetadata } from '@nestjs/common';

export const RESIDENT_ALLOW_PASSWORD_CHANGE_PENDING_KEY = 'residentAllowPasswordChangePending';

/** Marks a route reachable even when the resident's token carries mustChangePassword=true (change-password itself, logout). */
export const ResidentAllowPasswordChangePending = () => SetMetadata(RESIDENT_ALLOW_PASSWORD_CHANGE_PENDING_KEY, true);
