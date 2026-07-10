import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(request: Request, response: Response, next: NextFunction) {
  const header = request.headers['x-request-id'];
  const incoming = Array.isArray(header) ? header[0] : header;
  const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
  response.setHeader('X-Request-Id', requestId);
  next();
}
