import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { zValidator } from '@hono/zod-validator';
import {
  CreateJobRequestSchema,
  CreateJobRequest,
  Job,
  JobResponse,
  CreateJobResponse,
  JobOptionsSchema,
} from '../models/job';
import { getJobStore } from '../store/job-store';
import { getCloudProvider } from '../../cloud';
import { parseYouTubeUrl } from '../../utils/url';

const jobs = new Hono();

/**
 * POST /jobs - Create a new conversion job
 */
jobs.post(
  '/',
  zValidator('json', CreateJobRequestSchema),
  async (c) => {
    const body = c.req.valid('json') as CreateJobRequest;
    const store = getJobStore();
    const cloudProvider = await getCloudProvider();

    // Parse YouTube URL
    const urlInfo = parseYouTubeUrl(body.url);
    if (!urlInfo) {
      return c.json({ error: 'Invalid YouTube URL' }, 400);
    }

    // Get userId from header or generate anonymous
    const userId = c.req.header('X-User-Id') || 'anonymous';

    // Create job
    const jobId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const job: Job = {
      id: jobId,
      userId,
      status: 'created',
      videoUrl: body.url,
      videoId: urlInfo.id,
      options: body.options || JobOptionsSchema.parse({}),
      progress: {
        percent: 0,
        currentStep: 'Queued',
        stepsCompleted: [],
        stepsRemaining: ['Metadata', 'Subtitles', 'Screenshots', 'PDF Generation'],
      },
      retryCount: 0,
      maxRetries: 3,
      webhook: body.webhook,
      createdAt: now,
      expiresAt,
    };

    await store.create(job);

    // Enqueue job
    try {
      await cloudProvider.queue.enqueue('yt2pdf-jobs', { jobId });
      await store.updateStatus(jobId, 'queued');
      job.status = 'queued';
    } catch (error) {
      console.error('Failed to enqueue job:', error);
      await store.updateStatus(jobId, 'failed');
      return c.json({ error: 'Failed to queue job' }, 500);
    }

    const response: CreateJobResponse = {
      jobId: job.id,
      status: job.status,
      statusUrl: `/api/v1/jobs/${job.id}`,
      createdAt: job.createdAt.toISOString(),
    };

    return c.json(response, 202);
  }
);

/**
 * GET /jobs/:jobId - Get job status
 */
jobs.get('/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const store = getJobStore();
  const cloudProvider = await getCloudProvider();

  const job = await store.findById(jobId);
  if (!job) {
    return c.json({ error: 'Job not found' }, 404);
  }

  const response: JobResponse = {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    videoMetadata: job.videoMetadata,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString(),
    completedAt: job.completedAt?.toISOString(),
  };

  // Add result with fresh signed URL if completed
  if (job.status === 'completed' && job.result) {
    const signedUrl = await cloudProvider.storage.getSignedUrl(
      process.env.OUTPUT_BUCKET || 'yt2pdf-results',
      job.result.outputPath,
      { expiresInSeconds: 3600, action: 'read' }
    );

    response.result = {
      downloadUrl: signedUrl,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      fileSize: job.result.fileSize,
      pages: job.result.pages,
    };
  }

  // Add error if failed
  if (job.status === 'failed' && job.error) {
    response.error = job.error;
  }

  return c.json(response);
});

/**
 * DELETE /jobs/:jobId - Cancel a job
 */
jobs.delete('/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const store = getJobStore();

  const job = await store.findById(jobId);
  if (!job) {
    return c.json({ error: 'Job not found' }, 404);
  }

  // Can only cancel pending/queued jobs
  if (!['created', 'queued'].includes(job.status)) {
    return c.json(
      { error: `Cannot cancel job with status: ${job.status}` },
      400
    );
  }

  await store.updateStatus(jobId, 'cancelled');

  return c.json({ jobId, status: 'cancelled' });
});

/**
 * GET /jobs - List user's jobs
 */
jobs.get('/', async (c) => {
  const store = getJobStore();
  const userId = c.req.header('X-User-Id') || 'anonymous';

  const status = c.req.query('status') as any;
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const jobs = await store.findByUserId(userId, {
    status,
    limit: Math.min(limit, 100),
    offset,
  });

  const total = await store.countByUserId(userId);

  return c.json({
    jobs: jobs.map(job => ({
      jobId: job.id,
      status: job.status,
      videoMetadata: job.videoMetadata,
      createdAt: job.createdAt.toISOString(),
    })),
    total,
    limit,
    offset,
  });
});

export { jobs };
