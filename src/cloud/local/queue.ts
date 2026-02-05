import {
  IQueueProvider,
  QueueMessage,
  QueueEnqueueOptions,
  QueueReceiveOptions,
} from '../interfaces';

export class LocalQueueProvider implements IQueueProvider {
  private queues: Map<string, QueueMessage[]> = new Map();
  private dlqQueues: Map<string, QueueMessage[]> = new Map();
  private messageId = 0;
  private inFlight: Map<string, QueueMessage> = new Map();

  private getQueue(name: string): QueueMessage[] {
    if (!this.queues.has(name)) {
      this.queues.set(name, []);
    }
    return this.queues.get(name)!;
  }

  private getDLQ(name: string): QueueMessage[] {
    const dlqName = `${name}-dlq`;
    if (!this.dlqQueues.has(dlqName)) {
      this.dlqQueues.set(dlqName, []);
    }
    return this.dlqQueues.get(dlqName)!;
  }

  enqueue<T>(queueName: string, message: T, options?: QueueEnqueueOptions): Promise<string> {
    const queue = this.getQueue(queueName);
    const id = `local-msg-${++this.messageId}`;

    const queueMessage: QueueMessage<T> = {
      id,
      body: message,
      receiptHandle: id,
      attributes: {
        priority: options?.priority || 'normal',
        groupId: options?.groupId || '',
      },
      enqueuedAt: new Date(),
      retryCount: 0,
    };

    if (options?.delaySeconds && options.delaySeconds > 0) {
      // Simulate delayed message
      setTimeout(() => {
        queue.push(queueMessage);
      }, options.delaySeconds * 1000);
    } else {
      // Sort by priority (high first)
      if (options?.priority === 'high') {
        queue.unshift(queueMessage);
      } else {
        queue.push(queueMessage);
      }
    }

    return Promise.resolve(id);
  }

  async receive<T>(queueName: string, options?: QueueReceiveOptions): Promise<QueueMessage<T>[]> {
    const queue = this.getQueue(queueName);
    const maxMessages = options?.maxMessages || 10;
    const waitTime = options?.waitTimeSeconds || 0;

    // If queue is empty and waitTime > 0, wait
    if (queue.length === 0 && waitTime > 0) {
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (queue.length > 0) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, waitTime * 1000);
      });
    }

    const messages = queue.splice(0, maxMessages) as QueueMessage<T>[];

    // Track in-flight messages for potential NACK
    messages.forEach((msg) => {
      this.inFlight.set(msg.receiptHandle!, msg);
    });

    return messages;
  }

  ack(_queueName: string, receiptHandle: string): Promise<void> {
    // Remove from in-flight tracking
    this.inFlight.delete(receiptHandle);
    return Promise.resolve();
  }

  nack(queueName: string, receiptHandle: string, delaySeconds?: number): Promise<void> {
    const queue = this.getQueue(queueName);

    // Retrieve the original message from in-flight tracking
    const originalMessage = this.inFlight.get(receiptHandle);
    if (!originalMessage) {
      throw new Error(
        `Message with receiptHandle ${receiptHandle} not found in in-flight messages`
      );
    }

    // Remove from in-flight tracking
    this.inFlight.delete(receiptHandle);

    // Re-enqueue with incremented retry count and original body preserved
    const message: QueueMessage = {
      ...originalMessage,
      enqueuedAt: new Date(),
      retryCount: (originalMessage.retryCount || 0) + 1,
    };

    if (delaySeconds && delaySeconds > 0) {
      setTimeout(() => {
        queue.push(message);
      }, delaySeconds * 1000);
    } else {
      queue.push(message);
    }

    return Promise.resolve();
  }

  moveToDLQ(queueName: string, message: QueueMessage): Promise<void> {
    const dlq = this.getDLQ(queueName);
    dlq.push({
      ...message,
      attributes: {
        ...message.attributes,
        originalQueue: queueName,
        failedAt: new Date().toISOString(),
      },
    });
    return Promise.resolve();
  }

  // Test helpers
  getQueueLength(queueName: string): number {
    return this.getQueue(queueName).length;
  }

  getDLQLength(queueName: string): number {
    return this.getDLQ(queueName).length;
  }

  clear(): void {
    this.queues.clear();
    this.dlqQueues.clear();
  }

  clearQueue(queueName: string): void {
    this.queues.set(queueName, []);
  }
}
