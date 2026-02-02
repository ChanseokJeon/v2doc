import {
  IQueueProvider,
  QueueMessage,
  QueueEnqueueOptions,
  QueueReceiveOptions,
} from '../interfaces';

// Types for @google-cloud/pubsub
interface PubSubMessage {
  id: string;
  data: Buffer;
  attributes?: Record<string, string>;
  publishTime: Date;
  ack(): void;
  nack(): void;
  modifyAckDeadline(deadline: number): void;
}

interface PubSubSubscription {
  pull(options?: { maxMessages?: number; autoPaginate?: boolean }): Promise<[[PubSubMessage[], unknown]]>;
  acknowledge(ackIds: string[]): Promise<void>;
  modifyAckDeadline(ackId: string, deadline: number): Promise<void>;
}

interface PubSubTopic {
  publishMessage(options: {
    data: Buffer;
    attributes?: Record<string, string>;
  }): Promise<string>;
  subscription(name: string): PubSubSubscription;
}

export interface PubSubClient {
  topic(name: string): PubSubTopic;
}

export interface PubSubQueueConfig {
  /** Dead letter queue suffix (default: '-dlq') */
  dlqSuffix?: string;
  /** Injected PubSub client (for testing) */
  client?: PubSubClient;
}

export class PubSubQueueProvider implements IQueueProvider {
  private pubsub: PubSubClient | null = null;
  private dlqSuffix: string;
  private injectedClient?: PubSubClient;

  constructor(config?: PubSubQueueConfig | string) {
    // Support legacy constructor signature (dlqSuffix as string)
    if (typeof config === 'string') {
      this.dlqSuffix = config;
    } else {
      this.dlqSuffix = config?.dlqSuffix || '-dlq';
      this.injectedClient = config?.client;
    }
  }

  private async getPubSub(): Promise<PubSubClient> {
    if (this.injectedClient) {
      return this.injectedClient;
    }
    if (!this.pubsub) {
      try {
        const { PubSub } = await import('@google-cloud/pubsub');
        this.pubsub = new PubSub() as unknown as PubSubClient;
      } catch (error) {
        throw new Error(
          'Failed to load @google-cloud/pubsub. Please install it: npm install @google-cloud/pubsub'
        );
      }
    }
    return this.pubsub;
  }

  async enqueue<T>(
    queueName: string,
    message: T,
    options?: QueueEnqueueOptions
  ): Promise<string> {
    const pubsub = await this.getPubSub();
    const topic = pubsub.topic(queueName);

    const attributes: Record<string, string> = {};

    // Map priority to attribute
    if (options?.priority) {
      attributes.priority = options.priority;
    }

    // Map groupId (useful for ordering)
    if (options?.groupId) {
      attributes.orderingKey = options.groupId;
    }

    // Map deduplicationId
    if (options?.deduplicationId) {
      attributes.deduplicationId = options.deduplicationId;
    }

    // Handle delay by setting a scheduledTime attribute
    // Note: Pub/Sub doesn't natively support delay, this is for consumer handling
    if (options?.delaySeconds && options.delaySeconds > 0) {
      const scheduledTime = Date.now() + options.delaySeconds * 1000;
      attributes.scheduledTime = scheduledTime.toString();
    }

    const messageId = await topic.publishMessage({
      data: Buffer.from(JSON.stringify(message)),
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    });

    return messageId;
  }

  async receive<T>(
    queueName: string,
    options?: QueueReceiveOptions
  ): Promise<QueueMessage<T>[]> {
    const pubsub = await this.getPubSub();
    const topic = pubsub.topic(queueName);
    // Subscription name convention: same as topic name
    const subscription = topic.subscription(queueName);

    const maxMessages = options?.maxMessages || 10;

    // Pull messages synchronously
    // Note: For production, consider using streaming pull
    const [[messages]] = await subscription.pull({
      maxMessages,
      autoPaginate: false,
    });

    // Handle visibility timeout (ack deadline extension)
    if (options?.visibilityTimeoutSeconds) {
      for (const msg of messages) {
        msg.modifyAckDeadline(options.visibilityTimeoutSeconds);
      }
    }

    return messages.map((msg) => {
      let body: T;
      try {
        body = JSON.parse(msg.data.toString()) as T;
      } catch {
        body = msg.data.toString() as unknown as T;
      }

      // Extract retry count from attributes if present
      const retryCount = msg.attributes?.retryCount
        ? parseInt(msg.attributes.retryCount, 10)
        : 0;

      return {
        id: msg.id,
        body,
        receiptHandle: msg.id,
        attributes: msg.attributes,
        enqueuedAt: msg.publishTime,
        retryCount,
      };
    });
  }

  async ack(queueName: string, receiptHandle: string): Promise<void> {
    const pubsub = await this.getPubSub();
    const topic = pubsub.topic(queueName);
    const subscription = topic.subscription(queueName);

    await subscription.acknowledge([receiptHandle]);
  }

  async nack(
    queueName: string,
    receiptHandle: string,
    delaySeconds?: number
  ): Promise<void> {
    const pubsub = await this.getPubSub();
    const topic = pubsub.topic(queueName);
    const subscription = topic.subscription(queueName);

    if (delaySeconds && delaySeconds > 0) {
      // Extend the ack deadline to delay redelivery
      await subscription.modifyAckDeadline(receiptHandle, delaySeconds);
    } else {
      // Immediately make message available (nack with 0 deadline)
      await subscription.modifyAckDeadline(receiptHandle, 0);
    }
  }

  async moveToDLQ(queueName: string, message: QueueMessage): Promise<void> {
    const dlqName = `${queueName}${this.dlqSuffix}`;
    const pubsub = await this.getPubSub();
    const dlqTopic = pubsub.topic(dlqName);

    const attributes: Record<string, string> = {
      ...message.attributes,
      originalQueue: queueName,
      originalMessageId: message.id,
      failedAt: new Date().toISOString(),
      retryCount: (message.retryCount || 0).toString(),
    };

    await dlqTopic.publishMessage({
      data: Buffer.from(JSON.stringify(message.body)),
      attributes,
    });
  }
}

// Alias for backward compatibility with factory
export { PubSubQueueProvider as GCPQueueProvider };
