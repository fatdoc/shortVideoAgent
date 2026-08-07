import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import type { Router } from 'express';

export type ControlApiDependencies = {
  appVersion: string;
  nodeEnv: 'development' | 'test' | 'production';
  readinessProbe: () => Promise<void>;
  authRouter?: Router;
  termsRouter?: Router;
  internalProductionRouter?: Router;
  contentRouter?: Router;
  productionRouter?: Router;
  trustProxy?: boolean;
};

function requestContext(): RequestHandler {
  return (request, response, next) => {
    const suppliedRequestId = request.header('x-request-id');
    const requestId = suppliedRequestId?.match(/^[A-Za-z0-9._:-]{1,128}$/)
      ? suppliedRequestId
      : randomUUID();

    response.setHeader('x-request-id', requestId);
    response.locals.requestId = requestId;
    next();
  };
}

export function createApp(dependencies: ControlApiDependencies) {
  const app = express();

  app.disable('x-powered-by');
  if (dependencies.trustProxy) app.set('trust proxy', 1);
  app.use(requestContext());
  app.use(express.json({ limit: '1mb', strict: true }));

  app.get('/health/live', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      service: 'control-api',
      version: dependencies.appVersion,
    });
  });

  app.get('/health/ready', async (_request, response) => {
    try {
      await dependencies.readinessProbe();
      response.status(200).json({ status: 'ready', database: 'available' });
    } catch {
      response.status(503).json({ status: 'not_ready', database: 'unavailable' });
    }
  });

  if (dependencies.authRouter) app.use('/api/v1/auth', dependencies.authRouter);
  if (dependencies.termsRouter) app.use('/api/v1', dependencies.termsRouter);
  if (dependencies.internalProductionRouter) {
    app.use('/api/v1/internal', dependencies.internalProductionRouter);
  }
  if (dependencies.contentRouter) app.use('/api/v1', dependencies.contentRouter);
  if (dependencies.productionRouter) app.use('/api/v1', dependencies.productionRouter);

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: '请求的 Control API 路由不存在。',
        requestId: response.locals.requestId,
      },
    });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    void _next;
    const message =
      dependencies.nodeEnv === 'production'
        ? 'Control API 发生未预期错误。'
        : error instanceof Error
          ? error.message
          : String(error);

    response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message,
        requestId: response.locals.requestId,
      },
    });
  };
  app.use(errorHandler);

  return app;
}
