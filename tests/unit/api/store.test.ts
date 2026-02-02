import { JobStore } from '../../../src/api/store/job-store';
import { Job, JobStatus } from '../../../src/api/models/job';

describe('JobStore', () => {
  let store: JobStore;

  const createMockJob = (overrides: Partial<Job> = {}): Job => ({
    id: 'test-job-1',
    userId: 'user-1',
    status: 'queued',
    videoUrl: 'https://youtube.com/watch?v=test',
    videoId: 'test',
    options: {
      format: 'pdf',
      layout: 'vertical',
      screenshotInterval: 60,
      quality: 'low',
      includeTranslation: false,
      includeSummary: true,
    },
    progress: {
      percent: 0,
      currentStep: 'Queued',
      stepsCompleted: [],
      stepsRemaining: [],
    },
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  });

  beforeEach(() => {
    store = new JobStore();
  });

  describe('create', () => {
    it('should create a job', async () => {
      const job = createMockJob();
      await store.create(job);

      const found = await store.findById(job.id);
      expect(found).toEqual(job);
    });
  });

  describe('findById', () => {
    it('should return null for non-existent job', async () => {
      const found = await store.findById('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should return jobs for user', async () => {
      const job1 = createMockJob({ id: 'job-1', userId: 'user-1' });
      const job2 = createMockJob({ id: 'job-2', userId: 'user-1' });
      const job3 = createMockJob({ id: 'job-3', userId: 'user-2' });

      await store.create(job1);
      await store.create(job2);
      await store.create(job3);

      const user1Jobs = await store.findByUserId('user-1');
      expect(user1Jobs).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const job1 = createMockJob({ id: 'job-1', status: 'queued' });
      const job2 = createMockJob({ id: 'job-2', status: 'completed' });

      await store.create(job1);
      await store.create(job2);

      const queuedJobs = await store.findByUserId('user-1', { status: 'queued' });
      expect(queuedJobs).toHaveLength(1);
      expect(queuedJobs[0].status).toBe('queued');
    });
  });

  describe('update', () => {
    it('should update job fields', async () => {
      const job = createMockJob();
      await store.create(job);

      const updated = await store.update(job.id, { status: 'processing' });
      expect(updated?.status).toBe('processing');
    });

    it('should return null for non-existent job', async () => {
      const updated = await store.update('non-existent', { status: 'processing' });
      expect(updated).toBeNull();
    });
  });

  describe('updateProgress', () => {
    it('should update progress', async () => {
      const job = createMockJob();
      await store.create(job);

      await store.updateProgress(job.id, {
        percent: 50,
        currentStep: 'Processing',
        stepsCompleted: ['Step 1'],
        stepsRemaining: ['Step 2'],
      });

      const updated = await store.findById(job.id);
      expect(updated?.progress.percent).toBe(50);
    });
  });

  describe('delete', () => {
    it('should delete a job', async () => {
      const job = createMockJob();
      await store.create(job);

      const deleted = await store.delete(job.id);
      expect(deleted).toBe(true);

      const found = await store.findById(job.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent job', async () => {
      const deleted = await store.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('countByUserId', () => {
    it('should count jobs for user', async () => {
      const job1 = createMockJob({ id: 'job-1', userId: 'user-1' });
      const job2 = createMockJob({ id: 'job-2', userId: 'user-1' });
      const job3 = createMockJob({ id: 'job-3', userId: 'user-2' });

      await store.create(job1);
      await store.create(job2);
      await store.create(job3);

      const count = await store.countByUserId('user-1');
      expect(count).toBe(2);
    });

    it('should return 0 for user with no jobs', async () => {
      const count = await store.countByUserId('unknown-user');
      expect(count).toBe(0);
    });
  });

  describe('countByStatus', () => {
    it('should count jobs by status', async () => {
      const job1 = createMockJob({ id: 'job-1', status: 'queued' });
      const job2 = createMockJob({ id: 'job-2', status: 'queued' });
      const job3 = createMockJob({ id: 'job-3', status: 'completed' });

      await store.create(job1);
      await store.create(job2);
      await store.create(job3);

      const queuedCount = await store.countByStatus('queued');
      expect(queuedCount).toBe(2);

      const completedCount = await store.countByStatus('completed');
      expect(completedCount).toBe(1);
    });

    it('should return 0 for status with no jobs', async () => {
      const count = await store.countByStatus('failed');
      expect(count).toBe(0);
    });
  });

  describe('helper methods', () => {
    it('should clear all jobs', async () => {
      const job1 = createMockJob({ id: 'job-1' });
      const job2 = createMockJob({ id: 'job-2' });

      await store.create(job1);
      await store.create(job2);

      store.clear();

      const all = store.getAll();
      expect(all).toHaveLength(0);
    });

    it('should get all jobs', async () => {
      const job1 = createMockJob({ id: 'job-1' });
      const job2 = createMockJob({ id: 'job-2' });

      await store.create(job1);
      await store.create(job2);

      const all = store.getAll();
      expect(all).toHaveLength(2);
    });
  });
});
