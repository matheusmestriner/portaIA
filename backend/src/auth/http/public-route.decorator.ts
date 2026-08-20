import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE_KEY = 'isPublicRoute';

/** Marks a controller/handler as reachable without a bearer access token (e.g. login, refresh). */
export const PublicRoute = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
