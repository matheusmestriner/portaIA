import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import type { Request, Response } from 'express';

interface StandardErrorBody {
  error: {
    code: string;
    message: string;
    correlationId: string;
    details?: unknown;
  };
}

/**
 * Every error response follows the same envelope so API consumers never
 * have to special-case NestJS's default shape vs a thrown Error vs a
 * validation failure. correlationId ties the response back to the
 * structured log line (nestjs-pino sets req.id the same way).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const correlationId = request.id ?? 'unknown';

    const { status, code, message, details } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error({ correlationId, err: exception }, 'Unhandled exception');
    }

    const body: StandardErrorBody = {
      error: { code, message, correlationId, details },
    };
    response.status(status).setHeader('X-Correlation-Id', correlationId).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { status, code: HttpStatus[status] ?? 'ERROR', message: payload };
      }
      const payloadObj = payload as { message?: string | string[]; error?: string };
      const message = Array.isArray(payloadObj.message)
        ? payloadObj.message.join('; ')
        : (payloadObj.message ?? exception.message);
      return {
        status,
        code: payloadObj.error ?? HttpStatus[status] ?? 'ERROR',
        message,
        details: Array.isArray(payloadObj.message) ? payloadObj.message : undefined,
      };
    }

    // A file that exceeds the upload limit is client error traffic, not a
    // server bug — without this it falls through to a logged 500, which is
    // both the wrong status code and noise indistinguishable from a real
    // crash in the logs.
    if (exception instanceof MulterError) {
      if (exception.code === 'LIMIT_FILE_SIZE') {
        return { status: HttpStatus.PAYLOAD_TOO_LARGE, code: 'PAYLOAD_TOO_LARGE', message: 'Arquivo excede o tamanho máximo permitido' };
      }
      return { status: HttpStatus.BAD_REQUEST, code: 'BAD_REQUEST', message: exception.message };
    }

    // Prisma errors that reflect a client mistake, not a server bug, get a
    // proper 4xx instead of leaking as an unhandled 500.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { status: HttpStatus.CONFLICT, code: 'CONFLICT', message: 'Registro já existe (violação de unicidade)' };
      }
      if (exception.code === 'P2025') {
        return { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'Registro não encontrado' };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno inesperado',
    };
  }
}
