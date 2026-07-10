import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { captureException } from './sentry.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const requestId = response.getHeader('X-Request-Id') ?? request.headers['x-request-id'];

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const respBody = exception.getResponse();
      // Reporta ao Sentry apenas erros 5xx (erros do servidor, não do cliente)
      if (status >= 500) {
        captureException(exception, {
          requestId,
          method: request.method,
          path: request.path,
          statusCode: status,
        });
      }
      response.status(status).json(
        typeof respBody === 'string' ? { statusCode: status, message: respBody } : respBody,
      );
      return;
    }

    // Exceção não tratada (bug real) — sempre reporta ao Sentry
    captureException(exception, {
      requestId,
      method: request.method,
      path: request.path,
    });

    this.logger.error({
      msg: 'Unhandled exception',
      requestId,
      method: request.method,
      path: request.path,
      error: exception instanceof Error ? exception.message : String(exception),
    });

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor',
      requestId,
    });
  }
}
