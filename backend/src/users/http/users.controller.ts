import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from '../users.service';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery, type Paginated } from '../../common/http/pagination';
import { createUserSchema, type CreateUserInput } from '../dto';
import { toUserResponse, type UserResponse } from './response.mappers';
import type { Actor } from '../../auth/actor';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @ApiOperation({ summary: 'Lista usuários dentro do escopo do ator (paginado).' })
  async list(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<UserResponse>> {
    const result = await this.users.listUsers(actor, query);
    return { ...result, items: result.items.map(toUserResponse) };
  }

  @Post()
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Idempotent('POST /users')
  @ApiOperation({
    summary:
      'Provisiona um usuário. O papel do ator determina quais papéis podem ser criados e em qual tenant (nunca confia em tenant id do corpo). Requer header Idempotency-Key.',
  })
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput,
  ): Promise<UserResponse> {
    const user = await this.users.createUser(actor, body);
    return toUserResponse(user);
  }
}
