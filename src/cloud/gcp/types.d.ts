/**
 * Type declarations for optional GCP dependencies.
 * These allow TypeScript to compile without the actual packages installed.
 */

declare module '@google-cloud/storage' {
  export class Storage {
    bucket(name: string): Bucket;
  }

  export interface Bucket {
    file(name: string): File;
  }

  export interface File {
    save(data: Buffer, options?: SaveOptions): Promise<void>;
    createWriteStream(options?: CreateWriteStreamOptions): NodeJS.WritableStream;
    download(): Promise<[Buffer]>;
    getMetadata(): Promise<[FileMetadata]>;
    getSignedUrl(options: GetSignedUrlOptions): Promise<[string]>;
    delete(options?: { ignoreNotFound?: boolean }): Promise<void>;
    exists(): Promise<[boolean]>;
  }

  export interface SaveOptions {
    contentType?: string;
    metadata?: { metadata?: Record<string, string> };
    cacheControl?: string;
    public?: boolean;
  }

  export interface CreateWriteStreamOptions extends SaveOptions {
    resumable?: boolean;
  }

  export interface FileMetadata {
    contentType?: string;
    metadata?: Record<string, string>;
  }

  export interface GetSignedUrlOptions {
    version: 'v4';
    action: 'read' | 'write';
    expires: number;
    contentType?: string;
  }
}

declare module '@google-cloud/pubsub' {
  export class PubSub {
    topic(name: string): Topic;
  }

  export interface Topic {
    publishMessage(options: PublishOptions): Promise<string>;
    subscription(name: string): Subscription;
  }

  export interface PublishOptions {
    data: Buffer;
    attributes?: Record<string, string>;
  }

  export interface Subscription {
    pull(options?: PullOptions): Promise<[[Message[], unknown]]>;
    acknowledge(ackIds: string[]): Promise<void>;
    modifyAckDeadline(ackId: string, deadline: number): Promise<void>;
  }

  export interface PullOptions {
    maxMessages?: number;
    autoPaginate?: boolean;
  }

  export interface Message {
    id: string;
    data: Buffer;
    attributes?: Record<string, string>;
    publishTime: Date;
    ack(): void;
    nack(): void;
    modifyAckDeadline(deadline: number): void;
  }
}
