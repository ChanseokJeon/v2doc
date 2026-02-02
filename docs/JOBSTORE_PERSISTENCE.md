# JobStore Persistence Requirements

## Overview

The current `JobStore` implementation is **in-memory only**, using a singleton pattern with JavaScript `Map` objects. This design is sufficient for development and testing, but **cannot be used in production** for services requiring persistent, reliable job tracking.

This document outlines:
- Current limitations
- When persistence is needed
- Migration strategies (Redis, SQLite)
- Interface contracts for implementations

## Current Implementation

**Location:** `/src/api/store/job-store.ts`

### Design

```typescript
class JobStore {
  private jobs: Map<string, Job> = new Map();           // Job storage
  private userJobs: Map<string, Set<string>> = new Map(); // User → Job IDs index
}
```

### Singleton Pattern

```typescript
let store: JobStore | null = null;

export function getJobStore(): JobStore {
  if (!store) {
    store = new JobStore();
  }
  return store;
}
```

The singleton is instantiated on first access and persists for the application lifetime.

### Available Methods

| Method | Purpose |
|--------|---------|
| `create(job: Job)` | Create new job record |
| `findById(id: string)` | Retrieve job by ID |
| `findByUserId(userId, options?)` | List jobs for user (with filtering, sorting, pagination) |
| `update(id, updates)` | Partial job update |
| `updateStatus(id, status)` | Update job status only |
| `updateProgress(id, progress)` | Update job progress only |
| `delete(id)` | Remove job record |
| `countByUserId(userId)` | Count jobs for user |
| `countByStatus(status)` | Count jobs with specific status |

## Limitations of In-Memory Store

### 1. Data Loss on Restart
- All jobs lost when server restarts
- No persistence across deployments
- Unacceptable for production services with SLA requirements

### 2. Single-Process Only
- Cannot be shared between multiple server instances
- No support for load balancing or horizontal scaling
- Each instance has independent job view

### 3. No Disaster Recovery
- No backup or recovery mechanism
- Cannot access historical data after restart
- Job audit trails lost

### 4. Limited Scalability
- RAM consumption grows with job count
- No built-in cleanup/archiving strategy
- Memory leaks possible if jobs not properly deleted

## When Persistence Is Required

### Development & Testing
- **Use:** In-memory (current)
- **Reason:** Fast startup, no external dependencies
- **Command:** `npm run dev`

### Production - Always-On Service
- **Use:** Redis or SQLite
- **Reason:** Data durability, high availability
- **Scenarios:**
  - Always-on API service
  - Scheduled workers across multiple instances
  - Long-running batch jobs (videos > 4 hours)
  - Job recovery after unexpected restarts

### Production - Single-Node Service
- **Use:** SQLite
- **Reason:** Simpler setup, file-based durability
- **Scenarios:**
  - Dedicated single server
  - No horizontal scaling planned
  - Self-hosted deployments

### Production - Distributed Service
- **Use:** Redis
- **Reason:** Shared state, atomic operations
- **Scenarios:**
  - Multiple API instances
  - Kubernetes/Docker deployments
  - High-availability requirements
  - Real-time job tracking across instances

## Migration Options

### Option 1: Redis (Recommended for Production)

**Best for:** Multi-instance deployments, high availability, real-time requirements

#### Advantages
- Atomic operations
- Cross-instance data sharing
- Built-in expiration (for job cleanup)
- Optional persistence via RDB/AOF
- Excellent performance
- Pub/Sub for real-time updates

#### Disadvantages
- Additional service to manage
- Requires Redis infrastructure
- Network latency vs in-memory

#### When to Use
- Multiple server instances
- Load-balanced deployments
- Kubernetes/Docker environments
- Need for real-time job tracking
- Scale expectations > 100,000 concurrent jobs

#### Minimal Setup
```bash
# Local development
docker run -d -p 6379:6379 redis:latest

# Production (cloud provider)
- AWS ElastiCache
- Google Cloud Memorystore
- Azure Cache for Redis
- Heroku Redis
```

---

### Option 2: SQLite (Recommended for Single-Node)

**Best for:** Single-server deployments, simpler infrastructure

#### Advantages
- No additional service required
- File-based durability
- ACID transactions
- Simple to backup (copy file)
- Good performance for typical workloads
- Cross-process accessible

#### Disadvantages
- Not ideal for multi-process scenarios
- Read/write locking can be limiting
- Less performant for high concurrency
- Migration complexity from in-memory

#### When to Use
- Single server deployment
- Self-hosted or VPS
- Lower job volume (< 50,000/month)
- Simplified operations
- Predictable workload

#### Setup
```bash
npm install better-sqlite3
# or
npm install sqlite3
```

---

## Interface Contract

All JobStore implementations must satisfy this interface:

```typescript
/**
 * Persistent JobStore interface.
 * All implementations must provide these methods with async signatures.
 */
export interface IJobStore {
  /**
   * Create and store a new job
   * Throws if job with same ID already exists
   */
  create(job: Job): Promise<void>;

  /**
   * Find job by ID
   * Returns null if not found
   */
  findById(id: string): Promise<Job | null>;

  /**
   * List user's jobs with optional filtering
   */
  findByUserId(userId: string, options?: {
    status?: JobStatus;
    limit?: number;
    offset?: number;
  }): Promise<Job[]>;

  /**
   * Update job (full or partial)
   * Returns updated job or null if not found
   */
  update(id: string, updates: Partial<Job>): Promise<Job | null>;

  /**
   * Update only job status
   */
  updateStatus(id: string, status: JobStatus): Promise<Job | null>;

  /**
   * Update only job progress
   */
  updateProgress(id: string, progress: JobProgress): Promise<Job | null>;

  /**
   * Delete job by ID
   * Returns true if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count total jobs for a user
   */
  countByUserId(userId: string): Promise<number>;

  /**
   * Count jobs with specific status
   */
  countByStatus(status: JobStatus): Promise<number>;
}
```

## Implementation Details

### Data Serialization

The `Job` interface contains `Date` objects:
```typescript
interface Job {
  createdAt: Date;
  queuedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt: Date;
  // ... other fields
}
```

**Important:** When implementing persistence, serialize Date fields as ISO 8601 strings:

```typescript
// Storage
const storedJob = {
  ...job,
  createdAt: job.createdAt.toISOString(),
  queuedAt: job.queuedAt?.toISOString(),
  // ...
};

// Retrieval
const job: Job = {
  ...data,
  createdAt: new Date(data.createdAt),
  queuedAt: data.queuedAt ? new Date(data.queuedAt) : undefined,
  // ...
};
```

### Indexing Strategy

Current in-memory implementation maintains:
- **Primary index:** `jobId` → Job (for fast lookup)
- **Secondary index:** `userId` → Set<jobId> (for user job listing)

Persistence implementations should maintain both indexes:

| Index | Purpose | Query | Complexity |
|-------|---------|-------|-----------|
| `jobId` | Direct job lookup | `findById()` | O(1) |
| `userId` | User's jobs | `findByUserId()` | O(n) where n = user's jobs |
| `status` | Jobs by status | `countByStatus()` | O(m) where m = all jobs |

### Job Expiration

Jobs contain `expiresAt` field for cleanup:
```typescript
expiresAt: Date;  // When job can be safely deleted
```

Implementations should support:
1. Storing expiration timestamp
2. Automatic cleanup of expired jobs (cron job or lazy deletion)
3. Preventing access to expired jobs (optional)

## Redis Implementation Outline

```typescript
import Redis from 'ioredis';
import { Job, JobStatus, JobProgress } from '../models/job';

export class RedisJobStore implements IJobStore {
  private redis: Redis;
  private keyPrefix = 'job:';
  private userKeyPrefix = 'user:';

  constructor(redis?: Redis) {
    this.redis = redis || new Redis();
  }

  async create(job: Job): Promise<void> {
    // Set job hash
    await this.redis.hset(
      `${this.keyPrefix}${job.id}`,
      this.serializeJob(job)
    );

    // Add to user's job set
    await this.redis.sadd(
      `${this.userKeyPrefix}${job.userId}:jobs`,
      job.id
    );

    // Set expiration
    await this.redis.expireat(
      `${this.keyPrefix}${job.id}`,
      Math.floor(job.expiresAt.getTime() / 1000)
    );
  }

  async findById(id: string): Promise<Job | null> {
    const data = await this.redis.hgetall(`${this.keyPrefix}${id}`);
    return Object.keys(data).length ? this.deserializeJob(data) : null;
  }

  async findByUserId(userId: string, options?: {
    status?: JobStatus;
    limit?: number;
    offset?: number;
  }): Promise<Job[]> {
    const jobIds = await this.redis.smembers(
      `${this.userKeyPrefix}${userId}:jobs`
    );

    // Fetch all jobs
    const jobs = await Promise.all(
      jobIds.map(id => this.findById(id))
    );

    let filtered = jobs.filter((j): j is Job => j !== null);

    // Filter by status
    if (options?.status) {
      filtered = filtered.filter(j => j.status === options.status);
    }

    // Sort by createdAt descending
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 20;
    return filtered.slice(offset, offset + limit);
  }

  // ... other methods follow similar patterns
}
```

### Key Structure
```
job:{jobId}           → Hash of job data
user:{userId}:jobs    → Set of job IDs for user
```

## SQLite Implementation Outline

```typescript
import Database from 'better-sqlite3';
import { Job, JobStatus, JobProgress } from '../models/job';

export class SqliteJobStore implements IJobStore {
  private db: Database.Database;

  constructor(dbPath: string = 'jobs.db') {
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        status TEXT NOT NULL,
        videoUrl TEXT NOT NULL,
        videoId TEXT NOT NULL,
        options JSON NOT NULL,
        videoMetadata JSON,
        progress JSON NOT NULL,
        result JSON,
        error JSON,
        retryCount INTEGER DEFAULT 0,
        maxRetries INTEGER DEFAULT 3,
        webhook JSON,
        createdAt TEXT NOT NULL,
        queuedAt TEXT,
        startedAt TEXT,
        completedAt TEXT,
        expiresAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_userId ON jobs(userId);
      CREATE INDEX IF NOT EXISTS idx_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_expiresAt ON jobs(expiresAt);
    `);
  }

  async create(job: Job): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO jobs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      job.id,
      job.userId,
      job.status,
      job.videoUrl,
      job.videoId,
      JSON.stringify(job.options),
      job.videoMetadata ? JSON.stringify(job.videoMetadata) : null,
      JSON.stringify(job.progress),
      job.result ? JSON.stringify(job.result) : null,
      job.error ? JSON.stringify(job.error) : null,
      job.retryCount,
      job.maxRetries,
      job.webhook ? JSON.stringify(job.webhook) : null,
      job.createdAt.toISOString(),
      job.queuedAt?.toISOString() || null,
      job.startedAt?.toISOString() || null,
      job.completedAt?.toISOString() || null,
      job.expiresAt.toISOString()
    );
  }

  async findById(id: string): Promise<Job | null> {
    const stmt = this.db.prepare('SELECT * FROM jobs WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.deserializeJob(row) : null;
  }

  async findByUserId(userId: string, options?: {
    status?: JobStatus;
    limit?: number;
    offset?: number;
  }): Promise<Job[]> {
    let query = 'SELECT * FROM jobs WHERE userId = ?';
    const params: any[] = [userId];

    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY createdAt DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.deserializeJob(row));
  }

  // ... other methods follow similar patterns
}
```

### Schema
```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  status TEXT NOT NULL,
  videoUrl TEXT NOT NULL,
  videoId TEXT NOT NULL,
  options JSON NOT NULL,
  videoMetadata JSON,
  progress JSON NOT NULL,
  result JSON,
  error JSON,
  retryCount INTEGER,
  maxRetries INTEGER,
  webhook JSON,
  createdAt TEXT NOT NULL,
  queuedAt TEXT,
  startedAt TEXT,
  completedAt TEXT,
  expiresAt TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_userId ON jobs(userId);
CREATE INDEX idx_status ON jobs(status);
CREATE INDEX idx_expiresAt ON jobs(expiresAt);
```

## Migration Strategy

### From In-Memory to Persistent

1. **Create new store class** implementing `IJobStore`
2. **Update singleton** to use environment variable:
   ```typescript
   export function getJobStore(): IJobStore {
     const storeType = process.env.JOB_STORE_TYPE || 'memory';

     if (storeType === 'redis') {
       return getRedisJobStore();
     } else if (storeType === 'sqlite') {
       return getSqliteJobStore();
     }

     return getMemoryJobStore();
   }
   ```

3. **Configure via environment:**
   ```bash
   # Development (in-memory)
   JOB_STORE_TYPE=memory

   # Production with Redis
   JOB_STORE_TYPE=redis
   REDIS_URL=redis://localhost:6379

   # Production with SQLite
   JOB_STORE_TYPE=sqlite
   SQLITE_PATH=/data/jobs.db
   ```

4. **Add data migration script** (if needed):
   - Load all in-memory jobs
   - Dump to persistence layer
   - Verify counts match

5. **Test thoroughly:**
   - Basic CRUD operations
   - Edge cases (concurrent updates)
   - Cleanup/expiration
   - Recovery after restart

## Recommended Approach

For **new production deployments**:

1. **Start with SQLite** if:
   - Single server
   - Self-hosted
   - Simpler operations preferred

2. **Use Redis** if:
   - Multi-instance deployment
   - High availability required
   - Real-time monitoring needed
   - Already using Redis elsewhere

3. **Both available** via configuration:
   - Development: in-memory (default)
   - Staging: SQLite
   - Production: Redis (configurable)

## Testing Persistence Implementations

```typescript
// Test contract for any IJobStore implementation
describe('JobStore Persistence', () => {
  let store: IJobStore;

  beforeEach(async () => {
    store = createTestStore(); // Implement per store type
  });

  it('should persist jobs across instances', async () => {
    const job = createTestJob();
    await store.create(job);

    // Create new instance
    const store2 = createTestStore();
    const retrieved = await store2.findById(job.id);

    expect(retrieved).toEqual(job);
  });

  it('should maintain user job index', async () => {
    const job1 = createTestJob({ userId: 'user1' });
    const job2 = createTestJob({ userId: 'user1' });

    await store.create(job1);
    await store.create(job2);

    const userJobs = await store.findByUserId('user1');
    expect(userJobs).toHaveLength(2);
  });

  // More tests...
});
```

## References

- **Job Model:** `/src/api/models/job.ts`
- **Current Implementation:** `/src/api/store/job-store.ts`
- **Environment Setup:** `/.env.example`

## Timeline

| Phase | Task | Estimated Time |
|-------|------|-----------------|
| 1 | Design interface contract | 1 day |
| 2 | Implement Redis store | 2-3 days |
| 3 | Implement SQLite store | 2-3 days |
| 4 | Data migration utilities | 1-2 days |
| 5 | Comprehensive testing | 2-3 days |
| 6 | Documentation & deployment guides | 1-2 days |

---

**Status:** ⬜ Pending implementation

**Priority:** HIGH (required for production deployment)

**Owner:** DevOps / Infrastructure team
