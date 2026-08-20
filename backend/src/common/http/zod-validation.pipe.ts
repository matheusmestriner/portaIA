import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/** Validates a request body/query against an existing domain zod schema, so controllers never duplicate validation rules already defined for the use case. */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        error: 'VALIDATION_ERROR',
      });
    }
    return result.data;
  }
}
