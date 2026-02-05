import { Job, JobStatus, JobProgress } from '../models/job';

/**
 * In-memory Job Store
 *
 * 실제 프로덕션에서는 Redis나 데이터베이스로 교체
 */
export class JobStore {
  private jobs: Map<string, Job> = new Map();
  private userJobs: Map<string, Set<string>> = new Map();

  create(job: Job): void {
    this.jobs.set(job.id, job);

    // Index by user
    if (!this.userJobs.has(job.userId)) {
      this.userJobs.set(job.userId, new Set());
    }
    this.userJobs.get(job.userId)!.add(job.id);
  }

  findById(id: string): Job | null {
    return this.jobs.get(id) || null;
  }

  findByUserId(
    userId: string,
    options?: {
      status?: JobStatus;
      limit?: number;
      offset?: number;
    }
  ): Job[] {
    const jobIds = this.userJobs.get(userId);
    if (!jobIds) return [];

    let jobs = Array.from(jobIds)
      .map((id) => this.jobs.get(id)!)
      .filter((job) => job !== undefined);

    // Filter by status
    if (options?.status) {
      jobs = jobs.filter((job) => job.status === options.status);
    }

    // Sort by createdAt descending
    jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 20;
    return jobs.slice(offset, offset + limit);
  }

  update(id: string, updates: Partial<Job>): Job | null {
    const job = this.jobs.get(id);
    if (!job) return null;

    const updatedJob = { ...job, ...updates };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  updateStatus(id: string, status: JobStatus): Job | null {
    return this.update(id, { status });
  }

  updateProgress(id: string, progress: JobProgress): Job | null {
    return this.update(id, { progress });
  }

  delete(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    this.jobs.delete(id);
    this.userJobs.get(job.userId)?.delete(id);
    return true;
  }

  countByUserId(userId: string): number {
    return this.userJobs.get(userId)?.size || 0;
  }

  countByStatus(status: JobStatus): number {
    return Array.from(this.jobs.values()).filter((job) => job.status === status).length;
  }

  // Test helpers
  clear(): void {
    this.jobs.clear();
    this.userJobs.clear();
  }

  getAll(): Job[] {
    return Array.from(this.jobs.values());
  }
}

// Singleton instance
let store: JobStore | null = null;

export function getJobStore(): JobStore {
  if (!store) {
    store = new JobStore();
  }
  return store;
}

export function resetJobStore(): void {
  store = null;
}
