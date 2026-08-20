import { Controller, Get, HttpException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { PublicRoute } from '../auth/http/public-route.decorator';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @PublicRoute()
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @PublicRoute()
  @Get('ready')
  @HealthCheck()
  async ready() {
    try {
      return await this.health.check([() => this.prismaIndicator.pingCheck('database', this.prisma)]);
    } catch (err) {
      // Terminus's own failure payload embeds the driver's raw error
      // message (Postgres host/port, connection refused details) — this
      // route is unauthenticated by necessity (load balancers poll it), so
      // that detail is logged server-side and never reflected to the caller.
      this.logger.error({ err }, 'Readiness check failed');
      if (err instanceof HttpException) {
        throw new ServiceUnavailableException({ status: 'error', database: 'down' });
      }
      throw err;
    }
  }
}
