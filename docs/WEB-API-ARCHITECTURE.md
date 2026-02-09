# v2doc Web Service Architecture

## 1. 개요

v2doc는 현재 CLI 도구로 운영되고 있습니다. 이 문서는 CLI를 REST API 기반의 웹 서비스로 전환하는 아키텍처를 정의합니다.

### 1.1 핵심 목표

- **클라우드 중립성**: GCP와 AWS를 동일하게 지원하는 추상화 레이어
- **비동기 처리**: 큰 영상 처리를 위한 작업 큐 시스템
- **확장성**: 여러 워커로 병렬 처리 지원
- **기존 코드 재사용**: 핵심 로직(Orchestrator, Provider)은 그대로 유지

### 1.2 주요 특징

| 기능 | 설명 |
|------|------|
| **REST API** | 작업 생성, 상태 조회, 결과 다운로드 |
| **클라우드 스토리지** | GCP Cloud Storage / AWS S3 자동 선택 |
| **작업 큐** | BullMQ 기반 비동기 처리 |
| **진행률 추적** | WebSocket 또는 Server-Sent Events (SSE) |
| **멀티 워커** | 수평 확장 가능한 아키텍처 |

---

## 2. 시스템 아키텍처

### 2.1 전체 구조 다이어그램

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                   │
├────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │ Web Browser  │   │ Mobile App   │   │ CLI Client   │   │ 3rd Party    │ │
│  │ (UI)         │   │ (Native)     │   │ (upgraded)   │   │ Integration  │ │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘ │
│         │                  │                  │                  │         │
│         └──────────────────┼──────────────────┼──────────────────┘         │
│                            ▼                                               │
├────────────────────────────────────────────────────────────────────────────┤
│                        API Gateway Layer (Express)                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  POST /api/v1/jobs                    # 작업 생성                   │  │
│  │  GET  /api/v1/jobs/:id                # 작업 상태 조회             │  │
│  │  DELETE /api/v1/jobs/:id              # 작업 취소                  │  │
│  │  POST /api/v1/jobs/:id/cancel         # 강제 취소                  │  │
│  │  GET  /api/v1/jobs/:id/download       # 결과 다운로드              │  │
│  │  POST /api/v1/analyze                 # 영상 분석                  │  │
│  │  GET  /api/v1/health                  # 헬스 체크                  │  │
│  └────────────────────────┬───────────────────────────────────────────┘  │
│                           │                                               │
├───────────────────────────┼───────────────────────────────────────────────┤
│                           ▼                                               │
│                    Queue Layer (BullMQ)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Queue State:                                                       │  │
│  │  - Pending (대기)                                                  │  │
│  │  - Active (처리 중)                                                │  │
│  │  - Completed (완료)                                                │  │
│  │  - Failed (실패)                                                   │  │
│  │                                                                     │  │
│  │  Redis / In-Memory Storage                                         │  │
│  └────────────────┬────────────────────────────────────────────────────┘  │
│                   │                                                       │
├───────────────────┼───────────────────────────────────────────────────────┤
│                   ▼                                                       │
│              Worker Layer (Node.js Cluster)                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │  │
│  │  │   Worker 1   │  │   Worker 2   │  │   Worker N   │             │  │
│  │  │              │  │              │  │              │             │  │
│  │  │ CloudOrches. │  │ CloudOrches. │  │ CloudOrches. │             │  │
│  │  │ - Subtitle   │  │ - Subtitle   │  │ - Subtitle   │             │  │
│  │  │ - Screenshot │  │ - Screenshot │  │ - Screenshot │             │  │
│  │  │ - PDF Gen    │  │ - PDF Gen    │  │ - PDF Gen    │             │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │  │
│  └────────────┬──────────────────────────────────────┬─────────────────┘  │
│               │                                      │                    │
├───────────────┼──────────────────────────────────────┼────────────────────┤
│               ▼                                      ▼                    │
│          Cloud Provider Abstraction                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  IStorageProvider (인터페이스)                                      │ │
│  │  ├─ GCPStorageProvider                                              │ │
│  │  └─ AWSStorageProvider                                              │ │
│  │                                                                     │ │
│  │  IQueueProvider (인터페이스)                                        │ │
│  │  ├─ CloudTasksProvider (GCP)                                        │ │
│  │  └─ SQSProvider (AWS)                                               │ │
│  │                                                                     │ │
│  │  CloudProviderFactory                                               │ │
│  └──────┬───────────────────────────────────┬──────────────────────────┘ │
│         │                                   │                            │
├─────────┼───────────────────────────────────┼────────────────────────────┤
│         ▼                                   ▼                            │
│    ┌──────────────────┐           ┌──────────────────┐                 │
│    │  Cloud Storage   │           │  Message Queue   │                 │
│    │  (GCS / S3)      │           │  (Pub/Sub / SQS) │                 │
│    └──────────────────┘           └──────────────────┘                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 데이터 흐름 (웹 서비스)

```
User Request
    │
    ▼
POST /api/v1/jobs
{
  "url": "https://youtube.com/watch?v=...",
  "format": "pdf",
  "options": { ... }
}
    │
    ▼
┌──────────────────────────┐
│  Job Validation          │ ─── URL 검증, 옵션 검증
│  Create Job Record       │ ─── DB에 Job 저장
└────────────┬─────────────┘
             │
             ▼
     ┌──────────────────┐
     │  Push to Queue   │ ─── BullMQ에 작업 추가
     └────────┬─────────┘
              │
              ▼
    Response with Job ID
    (202 Accepted)
              │
              ├─────────────────────────────────┐
              │                                 │
              ▼                                 ▼
        Polling API                        WebSocket/SSE
      GET /api/v1/jobs/:id                (Progress Stream)
              │
              ├─► Pending (대기)
              ├─► Active (처리 중)
              │   ├─► Fetching metadata
              │   ├─► Extracting subtitles
              │   ├─► Capturing screenshots
              │   ├─► Generating PDF
              │   └─► Uploading to storage
              ├─► Completed (완료)
              │   └─ GET /api/v1/jobs/:id/download
              │
              └─► Failed (실패)
                  └─ Error details
```

---

## 3. 클라우드 추상화 설계

### 3.1 아키텍처 원칙

클라우드 서비스는 **인터페이스 기반**으로 추상화하여 특정 클라우드에 의존하지 않습니다.

### 3.2 Storage Provider 인터페이스

```typescript
// src/cloud/interfaces/storage-provider.ts

export interface StorageMetadata {
  contentType: string;
  size: number;
  uploadedAt: Date;
}

export interface UploadOptions {
  contentType?: string;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

export interface IStorageProvider {
  // 파일 업로드
  upload(
    filePath: string,
    remotePath: string,
    options?: UploadOptions
  ): Promise<string>;  // Returns public URL

  // 파일 다운로드
  download(remotePath: string, localPath: string): Promise<void>;

  // Signed URL 생성 (임시 다운로드 링크)
  getSignedUrl(
    remotePath: string,
    expirationMinutes?: number
  ): Promise<string>;

  // 파일 삭제
  delete(remotePath: string): Promise<void>;

  // 파일 존재 여부
  exists(remotePath: string): Promise<boolean>;

  // 메타데이터 조회
  getMetadata(remotePath: string): Promise<StorageMetadata>;

  // 폴더 내 파일 목록
  listFiles(prefix: string): Promise<string[]>;

  // 폴더 삭제
  deleteFolder(prefix: string): Promise<void>;
}
```

### 3.3 Queue Provider 인터페이스

```typescript
// src/cloud/interfaces/queue-provider.ts

export interface QueueJob {
  id: string;
  url: string;
  userId: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: {
    code: string;
    message: string;
  };
  result?: {
    outputPath: string;
    downloadUrl: string;
  };
}

export interface IQueueProvider {
  // 작업 추가
  enqueue(job: Partial<QueueJob>): Promise<QueueJob>;

  // 작업 조회
  getJob(jobId: string): Promise<QueueJob | null>;

  // 작업 상태 업데이트
  updateJob(jobId: string, updates: Partial<QueueJob>): Promise<void>;

  // 작업 취소
  cancelJob(jobId: string): Promise<void>;

  // 작업 목록 조회
  listJobs(userId: string, limit?: number): Promise<QueueJob[]>;

  // 작업 삭제
  deleteJob(jobId: string): Promise<void>;

  // 진행 상황 스트림 (진행 업데이트 감지)
  watchProgress(jobId: string): AsyncIterable<QueueJob>;

  // 작업 실행 (워커용)
  claimJob(): Promise<QueueJob | null>;

  // 작업 완료
  completeJob(jobId: string, result: any): Promise<void>;

  // 작업 실패
  failJob(jobId: string, error: Error): Promise<void>;
}
```

### 3.4 GCP 구현 (Cloud Storage + Pub/Sub)

```typescript
// src/cloud/providers/gcp-storage.ts

import { Storage } from '@google-cloud/storage';

export class GCPStorageProvider implements IStorageProvider {
  private storage: Storage;
  private bucket: string;

  constructor(bucketName: string) {
    this.storage = new Storage();
    this.bucket = bucketName;
  }

  async upload(
    filePath: string,
    remotePath: string,
    options?: UploadOptions
  ): Promise<string> {
    const bucket = this.storage.bucket(this.bucket);
    const file = bucket.file(remotePath);

    const uploadOptions = {
      metadata: {
        contentType: options?.contentType || 'application/octet-stream',
        metadata: options?.metadata || {},
      },
    };

    await file.save(require('fs').readFileSync(filePath), uploadOptions);

    // Public URL 반환
    return `https://storage.googleapis.com/${this.bucket}/${remotePath}`;
  }

  async getSignedUrl(
    remotePath: string,
    expirationMinutes: number = 60
  ): Promise<string> {
    const bucket = this.storage.bucket(this.bucket);
    const file = bucket.file(remotePath);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expirationMinutes * 60 * 1000,
    });

    return url;
  }

  // ... 나머지 구현
}

// src/cloud/providers/gcp-queue.ts

import { PubSub } from '@google-cloud/pubsub';
import { Datastore } from '@google-cloud/datastore';

export class GCPQueueProvider implements IQueueProvider {
  private pubsub: PubSub;
  private datastore: Datastore;
  private topic: string = 'v2doc-jobs';

  constructor(projectId: string) {
    this.pubsub = new PubSub({ projectId });
    this.datastore = new Datastore({ projectId });
  }

  async enqueue(job: Partial<QueueJob>): Promise<QueueJob> {
    const jobId = crypto.randomUUID();
    const fullJob: QueueJob = {
      id: jobId,
      status: 'pending',
      progress: 0,
      currentStep: 'pending',
      createdAt: new Date(),
      ...job,
    } as QueueJob;

    // Datastore에 저장
    await this.datastore.save({
      key: this.datastore.key(['Job', jobId]),
      data: fullJob,
    });

    // Pub/Sub에 발행
    const topic = this.pubsub.topic(this.topic);
    await topic.publish(
      Buffer.from(JSON.stringify({ type: 'job:enqueued', jobId }))
    );

    return fullJob;
  }

  // ... 나머지 구현
}
```

### 3.5 AWS 구현 (S3 + SQS)

```typescript
// src/cloud/providers/aws-storage.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class AWSStorageProvider implements IStorageProvider {
  private s3: S3Client;
  private bucketName: string;

  constructor(region: string, bucketName: string) {
    this.s3 = new S3Client({ region });
    this.bucketName = bucketName;
  }

  async upload(
    filePath: string,
    remotePath: string,
    options?: UploadOptions
  ): Promise<string> {
    const fileContent = require('fs').readFileSync(filePath);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: remotePath,
      Body: fileContent,
      ContentType: options?.contentType || 'application/octet-stream',
      Metadata: options?.metadata || {},
    });

    await this.s3.send(command);

    return `https://${this.bucketName}.s3.amazonaws.com/${remotePath}`;
  }

  async getSignedUrl(
    remotePath: string,
    expirationMinutes: number = 60
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: remotePath,
    });

    const url = await getSignedUrl(this.s3, command, {
      expiresIn: expirationMinutes * 60,
    });

    return url;
  }

  // ... 나머지 구현
}

// src/cloud/providers/aws-queue.ts

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export class AWSQueueProvider implements IQueueProvider {
  private sqs: SQSClient;
  private dynamodb: DynamoDBClient;
  private queueUrl: string;
  private tableName: string = 'v2doc-jobs';

  constructor(region: string, queueUrl: string) {
    this.sqs = new SQSClient({ region });
    this.dynamodb = new DynamoDBClient({ region });
    this.queueUrl = queueUrl;
  }

  async enqueue(job: Partial<QueueJob>): Promise<QueueJob> {
    const jobId = crypto.randomUUID();
    const fullJob: QueueJob = {
      id: jobId,
      status: 'pending',
      progress: 0,
      currentStep: 'pending',
      createdAt: new Date(),
      ...job,
    } as QueueJob;

    // DynamoDB에 저장
    await this.dynamodb.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: {
          jobId: { S: jobId },
          status: { S: 'pending' },
          data: { S: JSON.stringify(fullJob) },
        },
      })
    );

    // SQS에 메시지 발행
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({ type: 'job:enqueued', jobId }),
      })
    );

    return fullJob;
  }

  // ... 나머지 구현
}
```

### 3.6 Cloud Provider Factory

```typescript
// src/cloud/factory.ts

import { IStorageProvider } from './interfaces/storage-provider';
import { IQueueProvider } from './interfaces/queue-provider';

export type CloudProvider = 'gcp' | 'aws' | 'local';

export interface CloudConfig {
  provider: CloudProvider;
  gcp?: {
    projectId: string;
    bucketName: string;
  };
  aws?: {
    region: string;
    bucketName: string;
    queueUrl: string;
  };
  local?: {
    storagePath: string;
    redisUrl: string;
  };
}

export class CloudProviderFactory {
  static createStorageProvider(config: CloudConfig): IStorageProvider {
    switch (config.provider) {
      case 'gcp':
        if (!config.gcp) throw new Error('GCP config required');
        return new GCPStorageProvider(config.gcp.bucketName);

      case 'aws':
        if (!config.aws) throw new Error('AWS config required');
        return new AWSStorageProvider(config.aws.region, config.aws.bucketName);

      case 'local':
        if (!config.local) throw new Error('Local config required');
        return new LocalStorageProvider(config.local.storagePath);

      default:
        throw new Error(`Unknown cloud provider: ${config.provider}`);
    }
  }

  static createQueueProvider(config: CloudConfig): IQueueProvider {
    switch (config.provider) {
      case 'gcp':
        if (!config.gcp) throw new Error('GCP config required');
        return new GCPQueueProvider(config.gcp.projectId);

      case 'aws':
        if (!config.aws) throw new Error('AWS config required');
        return new AWSQueueProvider(config.aws.region, config.aws.queueUrl);

      case 'local':
        if (!config.local) throw new Error('Local config required');
        return new LocalQueueProvider(config.local.redisUrl);

      default:
        throw new Error(`Unknown cloud provider: ${config.provider}`);
    }
  }
}
```

---

## 4. API 설계

### 4.1 REST Endpoints

#### 4.1.1 작업 생성

```http
POST /api/v1/jobs
Content-Type: application/json
Authorization: Bearer <token>

{
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "format": "pdf",
  "options": {
    "screenshot": {
      "interval": 60,
      "quality": "medium"
    },
    "subtitle": {
      "language": "ko"
    },
    "pdf": {
      "layout": "vertical",
      "theme": "default"
    }
  }
}
```

**Response (202 Accepted):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "createdAt": "2025-02-02T10:30:00Z",
  "estimatedDuration": "5-10 minutes",
  "pollUrl": "/api/v1/jobs/550e8400-e29b-41d4-a716-446655440000",
  "streamUrl": "wss://api.example.com/api/v1/jobs/550e8400-e29b-41d4-a716-446655440000/stream"
}
```

#### 4.1.2 작업 상태 조회

```http
GET /api/v1/jobs/:jobId
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "active",
  "progress": 45,
  "currentStep": "Capturing screenshots (45/60)",
  "startedAt": "2025-02-02T10:31:00Z",
  "estimatedCompletionTime": "2025-02-02T10:40:00Z",
  "stats": {
    "videoDuration": 600,
    "screenshotCount": 45,
    "subtitleSegments": 120
  }
}
```

#### 4.1.3 작업 다운로드

```http
GET /api/v1/jobs/:jobId/download
Authorization: Bearer <token>
```

**Response (302 Found):**
```
Location: https://storage.example.com/signed-url-with-expiry
```

또는 직접 파일 스트리밍:
```http
GET /api/v1/jobs/:jobId/download?redirect=false
```

#### 4.1.4 작업 취소

```http
DELETE /api/v1/jobs/:jobId
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "cancelled",
  "cancelledAt": "2025-02-02T10:35:00Z"
}
```

#### 4.1.5 영상 분석 (메타데이터 조회)

```http
POST /api/v1/analyze
Content-Type: application/json
Authorization: Bearer <token>

{
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response (200 OK):**
```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "duration": 212,
  "channel": "Rick Astley",
  "thumbnail": "https://...",
  "availableFormats": {
    "youtube": true,
    "whisper": true
  },
  "estimatedCost": {
    "whisper": 0.01,
    "storage": 0.05
  },
  "estimatedDuration": "3-5 minutes"
}
```

#### 4.1.6 사용자 작업 목록

```http
GET /api/v1/jobs?limit=20&offset=0&status=all
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "jobs": [
    {
      "jobId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "completed",
      "createdAt": "2025-02-02T10:30:00Z",
      "completedAt": "2025-02-02T10:40:00Z",
      "outputPath": "results/job-550e8400.pdf"
    },
    // ... 더 많은 작업
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

#### 4.1.7 헬스 체크

```http
GET /api/v1/health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "uptime": 86400,
  "services": {
    "storage": "connected",
    "queue": "connected",
    "workers": {
      "total": 4,
      "active": 2,
      "idle": 2
    }
  }
}
```

### 4.2 WebSocket / Server-Sent Events (SSE)

```typescript
// 진행 상황 실시간 스트리밍
GET /api/v1/jobs/:jobId/stream

// Server-Sent Events 스트림
event: progress
data: {
  "progress": 50,
  "currentStep": "Generating PDF",
  "timestamp": "2025-02-02T10:35:00Z"
}

event: step-complete
data: {
  "step": "screenshots",
  "count": 60
}

event: complete
data: {
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "outputPath": "results/job-550e8400.pdf",
  "downloadUrl": "https://signed-url..."
}
```

### 4.3 Error Response 형식

```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "URL is not a valid YouTube link",
    "details": {
      "providedUrl": "https://example.com/video"
    }
  }
}
```

**Common Error Codes:**
```
INVALID_URL              - URL이 유효하지 않음
VIDEO_NOT_FOUND          - 영상을 찾을 수 없음
VIDEO_PRIVATE            - 비공개 영상
NO_CAPTIONS_AVAILABLE    - 사용 가능한 자막 없음
WHISPER_API_ERROR        - Whisper API 오류
FFMPEG_NOT_INSTALLED     - FFmpeg 설치 안 됨
DISK_FULL                - 디스크 부족
TIMEOUT                  - 처리 시간 초과
INTERNAL_ERROR           - 서버 내부 오류
```

---

## 5. 비동기 처리 흐름

### 5.1 BullMQ 기반 작업 큐 시스템

```typescript
// src/queue/job-queue.ts

import Queue from 'bull';
import { IQueueProvider } from '../cloud/interfaces/queue-provider';

export interface ConversionJobData {
  jobId: string;
  url: string;
  userId: string;
  options: ConvertOptions;
  timestamp: number;
}

export class JobQueue {
  private queue: Queue.Queue<ConversionJobData>;
  private queueProvider: IQueueProvider;

  constructor(redisUrl: string, queueProvider: IQueueProvider) {
    this.queue = new Queue('v2doc-conversion', redisUrl);
    this.queueProvider = queueProvider;

    // 이벤트 리스너 등록
    this.setupListeners();
  }

  // 작업 추가
  async enqueueJob(data: ConversionJobData): Promise<string> {
    const job = await this.queue.add(data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    return job.id;
  }

  // 처리 함수 등록
  registerProcessor(concurrency: number = 2) {
    this.queue.process(concurrency, async (job) => {
      return this.processJob(job);
    });
  }

  // 작업 처리
  private async processJob(job: Queue.Job<ConversionJobData>) {
    const { jobId, url, userId, options } = job.data;

    try {
      // 작업 상태 업데이트
      await this.queueProvider.updateJob(jobId, {
        status: 'active',
        startedAt: new Date(),
      });

      // CloudOrchestrator로 처리
      const orchestrator = new CloudOrchestrator(
        this.queueProvider,
        this.storageProvider,
        logger
      );

      const result = await orchestrator.process(url, options, {
        onProgress: async (state) => {
          // 진행 상황 업데이트
          await this.queueProvider.updateJob(jobId, {
            progress: state.progress,
            currentStep: state.currentStep,
          });

          // 진행 상황 이벤트 발행
          await this.publishProgress(jobId, state);
        },
      });

      // 결과 업로드
      const outputUrl = await this.uploadResult(jobId, result);

      // 작업 완료
      await this.queueProvider.updateJob(jobId, {
        status: 'completed',
        completedAt: new Date(),
        result: {
          outputPath: result.outputPath,
          downloadUrl: outputUrl,
        },
      });

      return { success: true, outputUrl };
    } catch (error) {
      // 작업 실패
      await this.queueProvider.updateJob(jobId, {
        status: 'failed',
        error: {
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message,
        },
      });

      throw error;
    }
  }

  // 진행 상황 이벤트 발행
  private async publishProgress(jobId: string, state: PipelineState) {
    // Redis Pub/Sub 또는 WebSocket으로 클라이언트에 알림
    // Redis: PUBLISH job:{jobId}:progress "{progress,currentStep}"
    // WebSocket: 연결된 클라이언트에게 메시지 전송
  }

  private setupListeners() {
    this.queue.on('progress', (job, progress) => {
      console.log(`Job ${job.id} progress: ${progress}%`);
    });

    this.queue.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });

    this.queue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
    });
  }
}
```

### 5.2 Worker 구현

```typescript
// src/worker/index.ts

import { JobQueue, ConversionJobData } from '../queue/job-queue';
import { CloudProviderFactory } from '../cloud/factory';

async function runWorker() {
  // 환경변수에서 설정 로드
  const cloudConfig = {
    provider: process.env.CLOUD_PROVIDER as 'gcp' | 'aws' | 'local',
    gcp: {
      projectId: process.env.GCP_PROJECT_ID,
      bucketName: process.env.GCP_BUCKET_NAME,
    },
    aws: {
      region: process.env.AWS_REGION,
      bucketName: process.env.AWS_BUCKET_NAME,
      queueUrl: process.env.AWS_SQS_URL,
    },
    local: {
      storagePath: process.env.LOCAL_STORAGE_PATH || './storage',
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    },
  };

  const queueProvider = CloudProviderFactory.createQueueProvider(cloudConfig);
  const storageProvider = CloudProviderFactory.createStorageProvider(cloudConfig);

  const jobQueue = new JobQueue(
    process.env.REDIS_URL || 'redis://localhost:6379',
    queueProvider
  );

  // 워커 시작 (동시 처리 2개)
  jobQueue.registerProcessor(2);

  console.log('Worker started, waiting for jobs...');
}

runWorker().catch(console.error);
```

### 5.3 CloudOrchestrator 확장

```typescript
// src/core/cloud-orchestrator.ts

import { Orchestrator } from './orchestrator';
import { IStorageProvider } from '../cloud/interfaces/storage-provider';
import { IQueueProvider } from '../cloud/interfaces/queue-provider';

export interface ProgressCallback {
  onProgress: (state: PipelineState) => Promise<void>;
}

export class CloudOrchestrator extends Orchestrator {
  constructor(
    private queueProvider: IQueueProvider,
    private storageProvider: IStorageProvider,
    private logger: Logger
  ) {
    super();
  }

  async process(
    url: string,
    options: ConvertOptions,
    callbacks?: ProgressCallback
  ): Promise<ConvertResult> {
    const result = await super.process(url, options);

    // 임시 파일을 클라우드 스토리지에 업로드
    const remotePath = `results/${crypto.randomUUID()}/${result.outputPath}`;
    const publicUrl = await this.storageProvider.upload(
      result.outputPath,
      remotePath,
      {
        contentType: 'application/pdf',
      }
    );

    // 메타데이터와 함께 반환
    return {
      ...result,
      outputPath: remotePath,
      publicUrl,
    };
  }

  // 진행 상황 콜백 통합
  protected async onProgress(state: PipelineState, callbacks?: ProgressCallback) {
    if (callbacks?.onProgress) {
      await callbacks.onProgress(state);
    }
  }
}
```

---

## 6. 파일 저장 전략

### 6.1 임시 파일 흐름

```
로컬 처리
├─ 자막: /tmp/v2doc/{jobId}/subtitles.json
├─ 스크린샷: /tmp/v2doc/{jobId}/screenshots/*.jpg
├─ 오디오: /tmp/v2doc/{jobId}/audio.m4a
└─ PDF: /tmp/v2doc/{jobId}/output.pdf
    │
    ▼
클라우드 업로드
└─ gs://bucket/results/{jobId}/output.pdf
└─ s3://bucket/results/{jobId}/output.pdf
    │
    ▼
Signed URL 생성
└─ https://...?token=...&expires=...
    │
    ▼
클라이언트 다운로드
```

### 6.2 스토리지 구조

```
Cloud Storage (GCP Cloud Storage / AWS S3)
├── results/
│   ├── {jobId-1}/
│   │   ├── output.pdf
│   │   ├── metadata.json
│   │   └── processing-log.txt
│   └── {jobId-2}/
│       └── ...
├── temp/  (24시간 후 자동 삭제)
│   └── ...
└── backups/  (7일 보관)
    └── ...
```

### 6.3 파일 정리 정책

```typescript
// src/utils/cleanup.ts

export class StorageCleanup {
  // 24시간 이상 된 임시 파일 삭제
  async cleanupTempFiles(storageProvider: IStorageProvider) {
    const files = await storageProvider.listFiles('temp/');
    const now = Date.now();

    for (const file of files) {
      const metadata = await storageProvider.getMetadata(file);
      const age = now - metadata.uploadedAt.getTime();

      if (age > 24 * 60 * 60 * 1000) {
        await storageProvider.delete(file);
      }
    }
  }

  // 7일 이상 된 백업 삭제
  async cleanupBackups(storageProvider: IStorageProvider) {
    const files = await storageProvider.listFiles('backups/');
    const now = Date.now();

    for (const file of files) {
      const metadata = await storageProvider.getMetadata(file);
      const age = now - metadata.uploadedAt.getTime();

      if (age > 7 * 24 * 60 * 60 * 1000) {
        await storageProvider.delete(file);
      }
    }
  }
}
```

---

## 7. 기존 코드 통합

### 7.1 기존 Orchestrator 유지

**기존 코드는 그대로 유지되며**, `CloudOrchestrator`가 상속하여 확장합니다.

```typescript
// src/core/orchestrator.ts (기존)
export class Orchestrator {
  async process(url: string, options: ConvertOptions): Promise<ConvertResult> {
    // 기존 구현 유지
  }
}

// src/core/cloud-orchestrator.ts (신규)
export class CloudOrchestrator extends Orchestrator {
  // 클라우드 스토리지 업로드 추가
  async process(url: string, options: ConvertOptions): Promise<ConvertResult> {
    const result = await super.process(url, options);
    // 클라우드에 업로드
    return result;
  }
}
```

### 7.2 Provider 재사용

모든 기존 Provider는 그대로 사용:
- `YouTubeProvider` - 메타데이터 및 다운로드
- `WhisperProvider` - 음성 인식
- `FFmpegWrapper` - 스크린샷 캡처

### 7.3 Subtitle Extractor, Screenshot Capturer, PDF Generator

기존 코드 그대로 재사용되며, 클라우드 스토리지에 업로드하는 래퍼 추가:

```typescript
// src/core/cloud-pdf-generator.ts

export class CloudPDFGenerator extends PDFGenerator {
  constructor(
    templateEngine: TemplateEngine,
    private storageProvider: IStorageProvider
  ) {
    super(templateEngine);
  }

  async generate(content: PDFContent, options: PDFOptions): Promise<string> {
    // 기존 PDF 생성
    const buffer = await super.generate(content, options);

    // 클라우드에 업로드
    const tempPath = `/tmp/output-${Date.now()}.pdf`;
    fs.writeFileSync(tempPath, buffer);

    const remotePath = `results/${Date.now()}/output.pdf`;
    const publicUrl = await this.storageProvider.upload(tempPath, remotePath, {
      contentType: 'application/pdf',
    });

    return publicUrl;
  }
}
```

---

## 8. 테스트 전략

### 8.1 클라우드 서비스 Mocking

```typescript
// tests/mocks/mock-storage-provider.ts

export class MockStorageProvider implements IStorageProvider {
  private files: Map<string, Buffer> = new Map();

  async upload(filePath: string, remotePath: string): Promise<string> {
    const content = fs.readFileSync(filePath);
    this.files.set(remotePath, content);
    return `mock://storage/${remotePath}`;
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const content = this.files.get(remotePath);
    if (!content) throw new Error('File not found');
    fs.writeFileSync(localPath, content);
  }

  async getSignedUrl(remotePath: string): Promise<string> {
    return `mock://signed/${remotePath}?token=test`;
  }

  // ... 나머지 구현
}

// tests/mocks/mock-queue-provider.ts

export class MockQueueProvider implements IQueueProvider {
  private jobs: Map<string, QueueJob> = new Map();

  async enqueue(job: Partial<QueueJob>): Promise<QueueJob> {
    const fullJob: QueueJob = {
      id: crypto.randomUUID(),
      status: 'pending',
      progress: 0,
      currentStep: 'pending',
      createdAt: new Date(),
      ...job,
    } as QueueJob;

    this.jobs.set(fullJob.id, fullJob);
    return fullJob;
  }

  async getJob(jobId: string): Promise<QueueJob | null> {
    return this.jobs.get(jobId) || null;
  }

  // ... 나머지 구현
}
```

### 8.2 Integration 테스트

```typescript
// tests/integration/api.test.ts

describe('v2doc Web API', () => {
  let app: Express;
  let storageProvider: MockStorageProvider;
  let queueProvider: MockQueueProvider;

  beforeAll(() => {
    storageProvider = new MockStorageProvider();
    queueProvider = new MockQueueProvider();
    app = createApp(queueProvider, storageProvider);
  });

  describe('POST /api/v1/jobs', () => {
    it('should create a job and return job ID', async () => {
      const response = await request(app).post('/api/v1/jobs').send({
        url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        format: 'pdf',
      });

      expect(response.status).toBe(202);
      expect(response.body.jobId).toBeDefined();
      expect(response.body.status).toBe('pending');
    });
  });

  describe('GET /api/v1/jobs/:id', () => {
    it('should return job status', async () => {
      const jobId = (
        await request(app).post('/api/v1/jobs').send({
          url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        })
      ).body.jobId;

      const response = await request(app).get(`/api/v1/jobs/${jobId}`);

      expect(response.status).toBe(200);
      expect(response.body.jobId).toBe(jobId);
    });
  });
});
```

### 8.3 E2E 테스트

```typescript
// tests/e2e/convert.test.ts

describe('E2E: Video Conversion', () => {
  it('should convert a sample video end-to-end', async (done) => {
    const jobId = await createJob({
      url: 'https://youtube.com/watch?v=sample-video-id',
      format: 'pdf',
    });

    // 작업 완료 대기
    const maxWaitTime = 30000; // 30초
    const startTime = Date.now();

    const checkStatus = async () => {
      const job = await getJob(jobId);

      if (job.status === 'completed') {
        expect(job.result.outputPath).toBeDefined();
        expect(job.result.downloadUrl).toBeDefined();
        done();
      } else if (job.status === 'failed') {
        throw new Error(`Job failed: ${job.error?.message}`);
      } else if (Date.now() - startTime > maxWaitTime) {
        throw new Error('Job timeout');
      } else {
        setTimeout(checkStatus, 1000);
      }
    };

    checkStatus();
  }, 40000);
});
```

---

## 9. 디렉토리 구조

```
src/
├── api/                           # REST API
│   ├── middleware/
│   │   ├── auth.ts               # 인증 미들웨어
│   │   ├── error-handler.ts      # 에러 처리
│   │   └── validation.ts         # 요청 검증
│   ├── routes/
│   │   ├── jobs.ts               # 작업 엔드포인트
│   │   ├── analyze.ts            # 분석 엔드포인트
│   │   ├── health.ts             # 헬스 체크
│   │   └── index.ts              # 라우트 통합
│   └── index.ts                  # Express 앱 설정
│
├── cloud/                         # 클라우드 추상화
│   ├── interfaces/
│   │   ├── storage-provider.ts   # Storage 인터페이스
│   │   └── queue-provider.ts     # Queue 인터페이스
│   ├── providers/
│   │   ├── gcp-storage.ts        # GCP Storage 구현
│   │   ├── gcp-queue.ts          # GCP Pub/Sub 구현
│   │   ├── aws-storage.ts        # AWS S3 구현
│   │   ├── aws-queue.ts          # AWS SQS 구현
│   │   ├── local-storage.ts      # 로컬 파일시스템
│   │   └── local-queue.ts        # Redis 기반 로컬 큐
│   └── factory.ts                # 클라우드 팩토리
│
├── worker/                        # 워커 프로세스
│   ├── index.ts                  # 워커 진입점
│   └── processor.ts              # 작업 처리기
│
├── queue/                         # BullMQ 통합
│   └── job-queue.ts              # 작업 큐 관리
│
├── core/                          # 기존 핵심 로직
│   ├── orchestrator.ts           # (기존)
│   ├── cloud-orchestrator.ts     # (신규) 클라우드 확장
│   ├── subtitle-extractor.ts     # (기존)
│   ├── screenshot-capturer.ts    # (기존)
│   ├── pdf-generator.ts          # (기존)
│   ├── cloud-pdf-generator.ts    # (신규) 클라우드 래퍼
│   ├── content-merger.ts         # (기존)
│   └── cost-estimator.ts         # (기존)
│
├── providers/                     # (기존) 모든 Provider 유지
│   ├── youtube.ts
│   ├── whisper.ts
│   ├── ffmpeg.ts
│   ├── unified-ai.ts
│   └── ai.ts
│
├── cli/                           # (기존) CLI 유지
│   ├── commands/
│   │   ├── convert.ts
│   │   ├── config.ts
│   │   ├── cache.ts
│   │   └── setup.ts
│   └── index.ts
│
├── utils/                         # (기존) 유틸리티 + 신규 추가
│   ├── config.ts
│   ├── cache.ts
│   ├── logger.ts
│   ├── file.ts
│   ├── url.ts
│   ├── cleanup.ts               # (신규) 스토리지 정리
│   └── request-validator.ts     # (신규) API 요청 검증
│
├── types/                         # (기존) 타입 정의
│   ├── index.ts
│   ├── config.ts
│   ├── video.ts
│   └── cloud.ts                 # (신규) 클라우드 타입
│
├── bin/
│   ├── v2doc.ts               # (기존) CLI
│   ├── server.ts               # (신규) API 서버
│   └── worker.ts               # (신규) 워커 프로세스
│
├── index.ts                     # 라이브러리 진입점 (기존)
└── web-server.ts               # API 서버 진입점 (신규)

tests/
├── unit/
│   ├── api/
│   ├── cloud/
│   └── queue/
├── integration/
│   ├── api.test.ts
│   └── cloud-providers.test.ts
├── e2e/
│   └── convert.test.ts
├── mocks/
│   ├── mock-storage-provider.ts
│   ├── mock-queue-provider.ts
│   └── mock-youtube-provider.ts
└── fixtures/
    └── sample-video.json

docs/
├── ARCHITECTURE.md              # (기존) CLI 아키텍처
├── WEB-API-ARCHITECTURE.md      # (이 문서) 웹 서비스 아키텍처
├── API.md                       # REST API 상세 문서
└── DEPLOYMENT.md               # 배포 가이드 (신규)
```

---

## 10. 배포 전략

### 10.1 로컬 개발 환경

```bash
# 환경변수 설정
CLOUD_PROVIDER=local
REDIS_URL=redis://localhost:6379

# 서버 시작
npm run server

# 워커 시작 (별도 터미널)
npm run worker
```

### 10.2 GCP Cloud Run 배포

```yaml
# cloud-run-config.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: v2doc-api
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: '10'
    spec:
      containers:
      - image: gcr.io/project/v2doc-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: CLOUD_PROVIDER
          value: 'gcp'
        - name: GCP_PROJECT_ID
          value: 'my-project'
        - name: GCP_BUCKET_NAME
          value: 'v2doc-storage'
        - name: PORT
          value: '3000'
```

### 10.3 AWS Lambda 배포

```typescript
// src/bin/lambda.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { createApp } from '../api';

const app = createApp(queueProvider, storageProvider);

export const handler: APIGatewayProxyHandler = async (event, context) => {
  // Lambda 환경에 맞게 요청 변환
  const response = await app(event);
  return response;
};
```

---

## 11. 모니터링 및 로깅

### 11.1 로깅 전략

```typescript
// src/utils/logger.ts (확장)

export class Logger {
  // 작업 로그
  logJobStart(jobId: string, url: string) {
    this.info(`Job ${jobId} started for ${url}`, {
      jobId,
      url,
      timestamp: new Date(),
    });
  }

  logJobProgress(jobId: string, progress: number, step: string) {
    this.debug(`Job ${jobId} progress: ${progress}% - ${step}`, {
      jobId,
      progress,
      step,
    });
  }

  logJobComplete(jobId: string, duration: number) {
    this.info(`Job ${jobId} completed in ${duration}ms`, {
      jobId,
      duration,
      timestamp: new Date(),
    });
  }

  logJobError(jobId: string, error: Error) {
    this.error(`Job ${jobId} failed: ${error.message}`, error, {
      jobId,
      errorCode: error.code,
    });
  }
}
```

### 11.2 메트릭 수집

```typescript
// src/utils/metrics.ts (신규)

export class Metrics {
  // 작업 통계
  trackJobMetrics(job: QueueJob) {
    const duration = job.completedAt
      ? job.completedAt.getTime() - job.createdAt.getTime()
      : 0;

    metrics.recordHistogram('job.duration_ms', duration);
    metrics.recordCounter('job.completed', 1);
  }

  // API 응답 시간
  trackApiRequest(path: string, duration: number, statusCode: number) {
    metrics.recordHistogram('api.request_duration_ms', duration);
    metrics.recordCounter(`api.status.${statusCode}`, 1);
  }
}
```

---

## 12. 보안 고려사항

### 12.1 인증 및 인가

```typescript
// src/api/middleware/auth.ts

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    (req as any).userId = decoded.sub;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

### 12.2 Rate Limiting

```typescript
// src/api/middleware/rate-limit.ts

import rateLimit from 'express-rate-limit';

export const jobLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 사용자당 최대 100개 요청
  keyGenerator: (req: Request) => (req as any).userId,
});
```

### 12.3 입력 검증

```typescript
// src/api/middleware/validation.ts

export function validateJobRequest(req: Request, res: Response, next: NextFunction) {
  const { url, format, options } = req.body;

  if (!url || !URLValidator.isYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  if (format && !['pdf', 'md', 'html'].includes(format)) {
    return res.status(400).json({ error: 'Invalid format' });
  }

  next();
}
```

---

## 13. 마이그레이션 가이드

### 13.1 CLI에서 웹 API로 전환

기존 CLI 사용자는 API 클라이언트로 쉽게 전환 가능:

```typescript
// 기존 CLI 방식
const result = await convert({
  url: 'https://youtube.com/watch?v=...',
  format: 'pdf',
});

// 신규 API 방식
const response = await fetch('/api/v1/jobs', {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://youtube.com/watch?v=...',
    format: 'pdf',
  }),
});

const { jobId } = await response.json();

// 진행 상황 폴링 또는 스트리밍
const job = await fetch(`/api/v1/jobs/${jobId}`);
```

---

## 14. 향후 확장 계획

### 14.1 기능 확장
- 플레이리스트 배치 처리
- 실시간 자막 편집 UI
- PDF 템플릿 커스터마이징
- 멀티 언어 자막 지원

### 14.2 성능 최적화
- 비디오 스트리밍 처리 (다운로드 없이)
- 증분 스크린샷 캡처
- 캐시 기반 빠른 재처리

### 14.3 통합 확장
- Slack 봇 통합
- Google Drive / OneDrive 직접 저장
- Webhook 기반 이벤트 알림

---

## 15. 참고 자료

### 15.1 GCP 참고 문서
- [Cloud Storage](https://cloud.google.com/storage/docs)
- [Pub/Sub](https://cloud.google.com/pubsub/docs)
- [Cloud Tasks](https://cloud.google.com/tasks/docs)
- [Cloud Run](https://cloud.google.com/run/docs)

### 15.2 AWS 참고 문서
- [S3](https://docs.aws.amazon.com/s3/)
- [SQS](https://docs.aws.amazon.com/sqs/)
- [Lambda](https://docs.aws.amazon.com/lambda/)
- [ECS](https://docs.aws.amazon.com/ecs/)

### 15.3 관련 라이브러리
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Express.js](https://expressjs.com/)
- [Google Cloud Client Libraries](https://cloud.google.com/nodejs/docs/reference)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/)

---

*마지막 업데이트: 2025-02-02*
*Author: v2doc Team*
