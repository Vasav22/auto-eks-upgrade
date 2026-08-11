import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  error?: string;
  correlationId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = (request.headers['x-correlation-id'] ||
      request.headers['x-request-id']) as string;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, any>;
        message = resp.message || message;
        error = resp.error;
      }
    } else if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Database query failed';
      error = 'Bad Request';

      this.logger.error(
        `Database error: ${exception.message}`,
        exception.stack,
      );
    } else if (exception instanceof Error) {
      message = this.sanitizeErrorMessage(exception.message);
      error = exception.name;

      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error('Unknown error type', String(exception));
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(error && { error }),
      ...(correlationId && { correlationId }),
    };

    if (status >= 500) {
      this.logger.error(
        `[${correlationId || 'N/A'}] ${request.method} ${request.url} - ${status}`,
        JSON.stringify(errorResponse),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${correlationId || 'N/A'}] ${request.method} ${request.url} - ${status}`,
      );
    }

    response.status(status).json(errorResponse);
  }

  private sanitizeErrorMessage(message: string): string {
    const sensitivePatterns = [
      /password[=:]\s*\S+/gi,
      /token[=:]\s*\S+/gi,
      /secret[=:]\s*\S+/gi,
      /apikey[=:]\s*\S+/gi,
      /authorization:\s*\S+/gi,
    ];

    let sanitized = message;
    sensitivePatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }
}
