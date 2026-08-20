import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CallsService } from '../calls.service';
import { PublicRoute } from '../../auth/http/public-route.decorator';
import { HmacWebhookGuard } from './hmac-webhook.guard';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { telephonyEventSchema, type TelephonyEvent } from '../dto';

@ApiTags('telephony')
@Controller('telephony/events')
export class TelephonyEventsController {
  constructor(private readonly calls: CallsService) {}

  @PublicRoute()
  @UseGuards(HmacWebhookGuard)
  @Post()
  @ApiOperation({
    summary:
      'Webhook de eventos de uma futura ponte AMI/ARI (CALL_STARTED/CALL_ANSWERED/CALL_ENDED). Autenticado por HMAC (X-Signature/X-Timestamp/X-Nonce), não por JWT — nenhum Asterisk real está conectado na V01.',
  })
  async handleEvent(
    @Body(new ZodValidationPipe(telephonyEventSchema)) body: TelephonyEvent,
  ): Promise<{ callId: string | null }> {
    return this.calls.processEvent(body);
  }
}
