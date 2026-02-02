import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { jobs, analyze, health } from './routes';

// Create the main app
const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-API-Key'],
}));

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
});

// Not found handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Mount routes
app.route('/api/v1/jobs', jobs);
app.route('/api/v1/analyze', analyze);
app.route('/api/v1/health', health);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'yt2pdf API',
    version: process.env.npm_package_version || '1.0.0',
    docs: '/api/v1/health',
  });
});

export { app };
export default app;
