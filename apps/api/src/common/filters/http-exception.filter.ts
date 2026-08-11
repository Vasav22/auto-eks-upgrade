import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface HttpErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  error?: string;
  correlationId?: string;
  details?: any;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const correlationId = (request.headers['x-correlation-id'] ||
      request.headers['x-request-id']) as string;

    let message: string;
    let error: string | undefined;
    let details: any;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const resp = exceptionResponse as Record<string, any>;
      message = resp.message || 'An error occurred';
      error = resp.error;
      details = resp.details;
    } else {
      message = 'An error occurred';
    }

    const errorResponse: HttpErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(error && { error }),
      ...(correlationId && { correlationId }),
      ...(details && { details }),
    };

    if (status >= 500) {
      this.logger.error(
        `[${correlationId || 'N/A'}] ${request.method} ${request.url} - ${status}: ${message}`,
        exception.stack,
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${correlationId || 'N/A'}] ${request.method} ${request.url} - ${status}: ${message}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
