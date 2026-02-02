import { app } from '../../../src/api/app';
import { resetJobStore, getJobStore } from '../../../src/api/store';
import { resetCloudProvider } from '../../../src/cloud';

describe('Jobs API', () => {
  beforeEach(() => {
    resetJobStore();
    resetCloudProvider();
  });

  describe('POST /api/v1/jobs', () => {
    it('should create a job with valid YouTube URL', async () => {
      const res = await app.request('/api/v1/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        }),
      });

      expect(res.status).toBe(202);
      const data = await res.json();
      expect(data.jobId).toBeDefined();
      expect(data.status).toBe('queued');
      expect(data.statusUrl).toContain('/api/v1/jobs/');
    });

    it('should reject invalid URL', async () => {
      const res = await app.request('/api/v1/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/not-youtube',
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should accept custom options', async () => {
      const res = await app.request('/api/v1/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://youtu.be/dQw4w9WgXcQ',
          options: {
            format: 'pdf',
            layout: 'minimal-neon',
            quality: 'medium',
          },
        }),
      });

      expect(res.status).toBe(202);
    });
  });

  describe('GET /api/v1/jobs/:jobId', () => {
    it('should return job status', async () => {
      // Create a job first
      const createRes = await app.request('/api/v1/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        }),
      });
      const { jobId } = await createRes.json();

      // Get status
      const res = await app.request(`/api/v1/jobs/${jobId}`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.jobId).toBe(jobId);
      expect(data.status).toBe('queued');
    });

    it('should return 404 for non-existent job', async () => {
      const res = await app.request('/api/v1/jobs/non-existent-id');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/jobs/:jobId', () => {
    it('should cancel a queued job', async () => {
      // Create a job
      const createRes = await app.request('/api/v1/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        }),
      });
      const { jobId } = await createRes.json();

      // Cancel
      const res = await app.request(`/api/v1/jobs/${jobId}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('cancelled');
    });

    it('should return 404 for non-existent job', async () => {
      const res = await app.request('/api/v1/jobs/non-existent', {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/jobs', () => {
    it('should list user jobs', async () => {
      const userId = 'test-user-123';
      const headers = {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      };

      // Create multiple jobs (using valid 11-char video IDs)
      await app.request('/api/v1/jobs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
      });
      await app.request('/api/v1/jobs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' }),
      });

      // List
      const res = await app.request('/api/v1/jobs', {
        headers: { 'X-User-Id': userId },
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.jobs.length).toBe(2);
      expect(data.total).toBe(2);
    });

    it('should support pagination', async () => {
      const res = await app.request('/api/v1/jobs?limit=5&offset=0');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.limit).toBe(5);
      expect(data.offset).toBe(0);
    });
  });
});
