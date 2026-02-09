/**
 * API Deployment Verification Test Suite
 *
 * Validates that the API server starts correctly, endpoints respond as expected,
 * and deployment prerequisites (package.api.json sync) are met.
 *
 * Run with: npm run verify:api
 */

import { spawn, ChildProcess } from 'child_process';
import { createServer } from 'net';
import SwaggerParser from '@apidevtools/swagger-parser';

describe('API Deployment Verification', () => {
  let serverProcess: ChildProcess;
  let PORT: number;
  let BASE_URL: string;

  beforeAll(async () => {
    // Find available port
    PORT = await getAvailablePort();
    BASE_URL = `http://localhost:${PORT}`;

    // Start server
    serverProcess = spawn('node', ['dist/api/server.js'], {
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
      stdio: 'pipe',
    });

    // Log server stderr for debugging
    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[server stderr] ${data.toString().trim()}`);
    });

    // Wait for server to be ready (max 30s)
    await waitForServer(`${BASE_URL}/api/v1/health`, 30000);
  }, 35000);

  afterAll((done) => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      serverProcess.on('exit', () => done());

      // Force kill after 5s if graceful shutdown fails
      setTimeout(() => {
        try {
          serverProcess.kill('SIGKILL');
        } catch {
          // Process may already be dead
        }
        done();
      }, 5000);
    } else {
      done();
    }
  });

  describe('Deployment Prerequisites', () => {
    test('package.api.json dependencies match package.json', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require('../../package.json');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const apiPkg = require('../../package.api.json');

      // Check that API package has all required dependencies
      const requiredDeps = ['@hono/zod-openapi', '@scalar/hono-api-reference', 'hono', 'zod'];
      for (const dep of requiredDeps) {
        expect(apiPkg.dependencies).toHaveProperty(dep);
        if (pkg.dependencies[dep]) {
          expect(apiPkg.dependencies[dep]).toBe(pkg.dependencies[dep]);
        }
      }
    });
  });

  describe('Server Endpoints', () => {
    test('root endpoint responds with API info', async () => {
      const res = await fetch(`${BASE_URL}/`);
      expect(res.ok).toBe(true);
      const json = await res.json();
      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('docs', '/docs');
      expect(json).toHaveProperty('openapi', '/openapi.json');
    });

    test('health endpoint is accessible', async () => {
      const res = await fetch(`${BASE_URL}/api/v1/health`);
      // Health can be 200 (healthy/degraded) or 503 (unhealthy) - both are valid responses
      expect([200, 503]).toContain(res.status);
      const json = await res.json();
      expect(json).toHaveProperty('status');
      expect(json).toHaveProperty('dependencies');
    });

    test('OpenAPI spec is valid', async () => {
      const res = await fetch(`${BASE_URL}/openapi.json`);
      expect(res.ok).toBe(true);
      const spec = await res.json();

      // Validate against OpenAPI 3.0 spec
      await expect(SwaggerParser.validate(spec)).resolves.toBeDefined();

      // Verify spec structure
      expect(spec).toHaveProperty('openapi', '3.0.0');
      expect(spec).toHaveProperty('info');
      expect(spec).toHaveProperty('paths');
      expect(spec.paths).toHaveProperty('/api/v1/jobs/sync');
      expect(spec.paths).toHaveProperty('/api/v1/analyze');
      expect(spec.paths).toHaveProperty('/api/v1/health');
    });

    test('Scalar docs endpoint is accessible', async () => {
      const res = await fetch(`${BASE_URL}/docs`);
      expect(res.ok).toBe(true);
      const html = await res.text();
      expect(html.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions
async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('Failed to get port'));
      }
    });
  });
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch(url);
      // Accept both 200 and 503 since health endpoint may report degraded/unhealthy
      if (res.status === 200 || res.status === 503) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server failed to start within ${timeoutMs}ms`);
}
