import { createServer } from 'node:http';
import { Logger } from '@nestjs/common';
import { renderMetrics } from './metrics.js';
import type { PrismaService } from './services/prisma.service.js';

const logger = new Logger('HealthServer');

export function startHealthServer(prisma: PrismaService, redisCheck: () => Promise<boolean>) {
  const port = parseInt(process.env.WORKER_HEALTH_PORT ?? '3012', 10);
  const server = createServer(async (req, res) => {
    if (req.url === '/health') {
      try {
        await prisma.$queryRaw`SELECT 1`;
        const redisOk = await redisCheck();
        if (!redisOk) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'degraded', redis: 'unreachable' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', db: 'ok', redis: 'ok' }));
      } catch {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', db: 'unreachable' }));
      }
    } else if (req.url === '/metrics') {
      try {
        const { contentType, body } = await renderMetrics();
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(body);
      } catch (error) {
        logger.error({ msg: 'Falha ao coletar métricas', error: (error as Error).message });
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('metrics collection failed');
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.on('error', (error) => {
    logger.error({ msg: `Health server falhou ao escutar porta ${port}`, error: error.message });
  });

  server.listen(port, '0.0.0.0', () => {
    logger.log(`Health server listening on 0.0.0.0:${port}`);
  });

  return server;
}
