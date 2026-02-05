import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
  GetQueueUrlCommand,
} from '@aws-sdk/client-sqs';
import {
  IQueueProvider,
  QueueMessage,
  QueueEnqueueOptions,
  QueueReceiveOptions,
} from '../interfaces';

export interface SqsQueueConfig {
  region?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  /** Prefix for queue names (e.g., 'prod-', 'dev-') */
  queuePrefix?: string;
  /** Suffix for DLQ names (default: '-dlq') */
  dlqSuffix?: string;
  /** Cache queue URLs to avoid repeated lookups */
  cacheQueueUrls?: boolean;
}

export class SqsQueueProvider implements IQueueProvider {
  private client: SQSClient;
  private queuePrefix: string;
  private dlqSuffix: string;
  private queueUrlCache: Map<string, string> = new Map();
  private cacheEnabled: boolean;

  constructor(config?: SqsQueueConfig) {
    this.client = new SQSClient({
      region: config?.region || process.env.AWS_REGION || 'us-east-1',
      endpoint: config?.endpoint || process.env.AWS_SQS_ENDPOINT,
      credentials: config?.credentials,
    });
    this.queuePrefix = config?.queuePrefix || process.env.SQS_QUEUE_PREFIX || '';
    this.dlqSuffix = config?.dlqSuffix || '-dlq';
    this.cacheEnabled = config?.cacheQueueUrls ?? true;
  }

  private async getQueueUrl(queueName: string): Promise<string> {
    const fullName = this.queuePrefix + queueName;

    if (this.cacheEnabled && this.queueUrlCache.has(fullName)) {
      return this.queueUrlCache.get(fullName)!;
    }

    const command = new GetQueueUrlCommand({
      QueueName: fullName,
    });

    const response = await this.client.send(command);
    const queueUrl = response.QueueUrl!;

    if (this.cacheEnabled) {
      this.queueUrlCache.set(fullName, queueUrl);
    }

    return queueUrl;
  }

  async enqueue<T>(queueName: string, message: T, options?: QueueEnqueueOptions): Promise<string> {
    const queueUrl = await this.getQueueUrl(queueName);

    // Map priority to message attributes
    const messageAttributes: Record<string, { DataType: string; StringValue: string }> = {};

    if (options?.priority) {
      messageAttributes['priority'] = {
        DataType: 'String',
        StringValue: options.priority,
      };
    }

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      DelaySeconds: options?.delaySeconds,
      MessageDeduplicationId: options?.deduplicationId,
      MessageGroupId: options?.groupId,
      MessageAttributes: Object.keys(messageAttributes).length > 0 ? messageAttributes : undefined,
    });

    const response = await this.client.send(command);
    return response.MessageId!;
  }

  async receive<T>(queueName: string, options?: QueueReceiveOptions): Promise<QueueMessage<T>[]> {
    const queueUrl = await this.getQueueUrl(queueName);

    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: options?.maxMessages || 10,
      VisibilityTimeout: options?.visibilityTimeoutSeconds,
      WaitTimeSeconds: options?.waitTimeSeconds,
      MessageAttributeNames: ['All'],
      AttributeNames: ['All'],
    });

    const response = await this.client.send(command);

    if (!response.Messages || response.Messages.length === 0) {
      return [];
    }

    return response.Messages.map((msg) => {
      const attributes: Record<string, string> = {};

      // Extract message attributes
      if (msg.MessageAttributes) {
        for (const [key, value] of Object.entries(msg.MessageAttributes)) {
          if (value.StringValue) {
            attributes[key] = value.StringValue;
          }
        }
      }

      // Extract system attributes
      const retryCount = msg.Attributes?.ApproximateReceiveCount
        ? parseInt(msg.Attributes.ApproximateReceiveCount, 10) - 1
        : 0;

      const enqueuedAt = msg.Attributes?.SentTimestamp
        ? new Date(parseInt(msg.Attributes.SentTimestamp, 10))
        : new Date();

      return {
        id: msg.MessageId!,
        body: JSON.parse(msg.Body!) as T,
        receiptHandle: msg.ReceiptHandle,
        attributes,
        enqueuedAt,
        retryCount,
      };
    });
  }

  async ack(queueName: string, receiptHandle: string): Promise<void> {
    const queueUrl = await this.getQueueUrl(queueName);

    const command = new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    });

    await this.client.send(command);
  }

  async nack(queueName: string, receiptHandle: string, delaySeconds?: number): Promise<void> {
    const queueUrl = await this.getQueueUrl(queueName);

    // Change visibility timeout to make message visible again
    const command = new ChangeMessageVisibilityCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: delaySeconds || 0,
    });

    await this.client.send(command);
  }

  async moveToDLQ(queueName: string, message: QueueMessage): Promise<void> {
    const dlqName = queueName + this.dlqSuffix;
    const dlqUrl = await this.getQueueUrl(dlqName);

    // Add metadata about the original queue and failure
    const messageAttributes: Record<string, { DataType: string; StringValue: string }> = {
      originalQueue: {
        DataType: 'String',
        StringValue: queueName,
      },
      failedAt: {
        DataType: 'String',
        StringValue: new Date().toISOString(),
      },
      originalMessageId: {
        DataType: 'String',
        StringValue: message.id,
      },
    };

    // Preserve original attributes
    if (message.attributes) {
      for (const [key, value] of Object.entries(message.attributes)) {
        messageAttributes[`original_${key}`] = {
          DataType: 'String',
          StringValue: value,
        };
      }
    }

    const command = new SendMessageCommand({
      QueueUrl: dlqUrl,
      MessageBody: JSON.stringify(message.body),
      MessageAttributes: messageAttributes,
    });

    await this.client.send(command);

    // Delete from original queue if we have receipt handle
    if (message.receiptHandle) {
      await this.ack(queueName, message.receiptHandle);
    }
  }

  // Helper to clear URL cache (useful for testing)
  clearUrlCache(): void {
    this.queueUrlCache.clear();
  }
}

// Alias for backward compatibility with factory naming
export { SqsQueueProvider as AWSQueueProvider };
