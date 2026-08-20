import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor } from '../../auth/http/current-actor.decorator';
import { RequirePermission } from '../../auth/http/require-permission.decorator';
import { PERMISSIONS } from '../../auth/rbac/permissions';
import { Idempotent } from '../../common/http/idempotent.decorator';
import { type PaginationQuery } from '../../common/http/pagination';
import { scopeIdSchema } from '../../common/http/scope-id.schema';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import type { Actor } from '../../auth/actor';
import { createAlarmEventSchema, createAlarmPanelSchema, createCameraSchema, createVmsServerSchema, setSecurityLicenseSchema, vmsListQuerySchema, type CreateAlarmEventInput, type CreateAlarmPanelInput, type CreateCameraInput, type CreateVmsServerInput, type SetSecurityLicenseInput } from '../dto';
import { VmsService } from '../vms.service';
import { toAlarmEventResponse, toAlarmPanelResponse, toCameraResponse, toSecurityLicenseResponse, toVmsServerResponse } from './response.mappers';

@ApiTags('vms')
@ApiBearerAuth()
@Controller('vms')
export class VmsController {
  constructor(private readonly vms: VmsService) {}

  @Get('servers')
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  async listServers(@CurrentActor() actor: Actor, @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string, @Query(new ZodValidationPipe(vmsListQuerySchema)) query: PaginationQuery) {
    const result = await this.vms.listServers(actor, condominiumId, query); return { ...result, items: result.items.map(toVmsServerResponse) };
  }

  @Post('servers')
  @RequirePermission(PERMISSIONS.SECURITY_OPERATE)
  @Idempotent('POST /vms/servers')
  @ApiOperation({ summary: 'Cadastra uma central VMS. O estado inicial é NOT_CONFIGURED até um adaptador homologado ser configurado.' })
  async createServer(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(createVmsServerSchema)) body: CreateVmsServerInput) { return toVmsServerResponse(await this.vms.createServer(actor, body)); }

  @Get('cameras')
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  async listCameras(@CurrentActor() actor: Actor, @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string, @Query(new ZodValidationPipe(vmsListQuerySchema)) query: PaginationQuery) {
    const result = await this.vms.listCameras(actor, condominiumId, query); return { ...result, items: result.items.map(toCameraResponse) };
  }

  @Post('cameras')
  @RequirePermission(PERMISSIONS.SECURITY_OPERATE)
  @Idempotent('POST /vms/cameras')
  async createCamera(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(createCameraSchema)) body: CreateCameraInput) { return toCameraResponse(await this.vms.createCamera(actor, body)); }

  @Get('alarm-panels')
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  async listPanels(@CurrentActor() actor: Actor, @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string, @Query(new ZodValidationPipe(vmsListQuerySchema)) query: PaginationQuery) {
    const result = await this.vms.listAlarmPanels(actor, condominiumId, query); return { ...result, items: result.items.map(toAlarmPanelResponse) };
  }

  @Post('alarm-panels')
  @RequirePermission(PERMISSIONS.SECURITY_OPERATE)
  @Idempotent('POST /vms/alarm-panels')
  async createPanel(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(createAlarmPanelSchema)) body: CreateAlarmPanelInput) { return toAlarmPanelResponse(await this.vms.createAlarmPanel(actor, body)); }

  @Get('alarm-events')
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  async listEvents(@CurrentActor() actor: Actor, @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string, @Query(new ZodValidationPipe(vmsListQuerySchema)) query: PaginationQuery) {
    const result = await this.vms.listAlarmEvents(actor, condominiumId, query); return { ...result, items: result.items.map(toAlarmEventResponse) };
  }

  @Post('alarm-events')
  @RequirePermission(PERMISSIONS.SECURITY_OPERATE)
  @Idempotent('POST /vms/alarm-events')
  async createEvent(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(createAlarmEventSchema)) body: CreateAlarmEventInput) { return toAlarmEventResponse(await this.vms.createAlarmEvent(actor, body)); }

  @Get('licenses')
  @RequirePermission(PERMISSIONS.REPORTS_VIEW)
  async listLicenses(@CurrentActor() actor: Actor, @Query('condominiumId', new ZodValidationPipe(scopeIdSchema)) condominiumId: string, @Query(new ZodValidationPipe(vmsListQuerySchema)) query: PaginationQuery) {
    const result = await this.vms.listLicenses(actor, condominiumId, query); return { ...result, items: result.items.map(toSecurityLicenseResponse) };
  }

  @Put('licenses')
  @RequirePermission(PERMISSIONS.PLATFORM_MANAGE)
  @Idempotent('PUT /vms/licenses')
  async setLicense(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(setSecurityLicenseSchema)) body: SetSecurityLicenseInput) { return toSecurityLicenseResponse(await this.vms.setLicense(actor, body)); }
}
