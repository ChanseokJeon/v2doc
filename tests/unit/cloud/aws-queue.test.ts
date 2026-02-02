// Mock AWS SDK before importing the provider
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  SendMessageCommand: jest.fn().mockImplementation((input) => ({
    input,
    _type: 'SendMessage',
  })),
  ReceiveMessageCommand: jest.fn().mockImplementation((input) => ({
    input,
    _type: 'ReceiveMessage',
  })),
  DeleteMessageCommand: jest.fn().mockImplementation((input) => ({
    input,
    _type: 'DeleteMessage',
  })),
  ChangeMessageVisibilityCommand: jest.fn().mockImplementation((input) => ({
    input,
    _type: 'ChangeMessageVisibility',
  })),
  GetQueueUrlCommand: jest.fn().mockImplementation((input) => ({
    input,
    _type: 'GetQueueUrl',
  })),
}));

import { SqsQueueProvider } from '../../../src/cloud/aws/queue';
import { QueueMessage } from '../../../src/cloud/interfaces';

describe('SqsQueueProvider', () => {
  let queue: SqsQueueProvider;
  const testQueueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
  const testDlqUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue-dlq';

  beforeEach(() => {
    jest.clearAllMocks();
    queue = new SqsQueueProvider({ region: 'us-east-1', cacheQueueUrls: false });

    // Default GetQueueUrl mock
    mockSend.mockImplementation((command: any) => {
      if (command._type === 'GetQueueUrl') {
        if (command.input.QueueName.endsWith('-dlq')) {
          return Promise.resolve({ QueueUrl: testDlqUrl });
        }
        return Promise.resolve({ QueueUrl: testQueueUrl });
      }
      return Promise.resolve({});
    });
  });

  describe('enqueue', () => {
    it('should enqueue a message and return message id', async () => {
      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          return Promise.resolve({ QueueUrl: testQueueUrl });
        }
        if (command._type === 'SendMessage') {
          return Promise.resolve({ MessageId: 'msg-123' });
        }
        return Promise.resolve({});
      });

      const id = await queue.enqueue('test-queue', { data: 'test' });

      expect(id).toBe('msg-123');
      expect(mockSend).toHaveBeenCalledTimes(2); // GetQueueUrl + SendMessage
    });

    it('should include delay seconds when specified', async () => {
      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          return Promise.resolve({ QueueUrl: testQueueUrl });
        }
        if (command._type === 'SendMessage') {
          expect(command.input.DelaySeconds).toBe(30);
          return Promise.resolve({ MessageId: 'msg-delayed' });
        }
        return Promise.resolve({});
      });

      await queue.enqueue('test-queue', { data: 'delayed' }, { delaySeconds: 30 });
    });

    it('should include priority as message attribute', async () => {
      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          return Promise.resolve({ QueueUrl: testQueueUrl });
        }
        if (command._type === 'SendMessage') {
          expect(command.input.MessageAttributes).toEqual({
            priority: {
              DataType: 'String',
              StringValue: 'high',
            },
          });
          return Promise.resolve({ MessageId: 'msg-priority' });
        }
        return Promise.resolve({});
      });

      await queue.enqueue('test-queue', { data: 'priority' }, { priority: 'high' });
    });

    it('should include deduplication and group id for FIFO queues', async () => {
      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          return Promise.resolve({ QueueUrl: testQueueUrl + '.fifo' });
        }
        if (command._type === 'SendMessage') {
          expect(command.input.MessageDeduplicationId).toBe('dedup-123');
          expect(command.input.MessageGroupId).toBe('group-A');
          return Promise.resolve({ MessageId: 'msg-fifo' });
        }
        return Promise.resolve({});
      });

      await queue.enqueue(
        'test-queue',
        { data: 'fifo' },
        { deduplicationId: 'dedup-123', groupId: 'group-A' }
      );
    });
  });

  describe('receive', () => {
    it('should receive messages from queue', async () => {
      const mockMessages = [
        {
          MessageId: 'msg-1',
          Body: JSON.stringify({ order: 1 }),
          ReceiptHandle: 'receipt-1',
          Attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1700000000000',
          },
          MessageAttributes: {
            priority: { StringValue: 'high' },
          },
        },
        {
          MessageId: 'msg-2',
          Body: JSON.stringify({ order: 2 }),
          ReceiptHandle: 'receipt-2',
          Attributes: {
            ApproximateReceiveCount: '3',
            SentTimestamp: '1700000001000',
          },
        },
      ];

      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          return Promise.resolve({ QueueUrl: testQueueUrl });
        }
        if (command._type === 'ReceiveMessage') {
          return Promise.resolve({ Messages: mockMessages });
        }
        return Promise.resolve({});
      });

      const messages = await queue.receive('test-queue');

      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({
        id: 'msg-1',
        body: { order: 1 },
        receiptHandle: 'receipt-1',
        retryCount: 0,
        attributes: { priority: 'high' },
      });
      expect(messages[1]).toMatchObject({
        id: 'msg-2',
        body: { order: 2 },
        receiptHandle: 'receipt-2',
        retryCount: 2,
      });
    });

    it('should return empty array when no messages', async () => {
      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          return Promise.resolve({ QueueUrl: testQueueUrl });
        }
        if (command._type === 'ReceiveMessage') {
          return Promise.resolve({ Messages: undefined });
        }
        return Promise.resolve({});
      });

      const messages = await queue.receive('test-queue');

      expect(messages).toEqual([]);
    });

    it('should respect receive options', async () => {
      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          return Promise.resolve({ QueueUrl: testQueueUrl });
        }
        if (command._type === 'ReceiveMessage') {
          expect(command.input.MaxNumberOfMessages).toBe(5);
          expect(command.input.VisibilityTimeout).toBe(60);
          expect(command.input.WaitTimeSeconds).toBe(20);
          return Promise.resolve({ Messages: [] });
        }
        return Promise.resolve({});
      });

      await queue.receive('test-queue', {
        maxMessages: 5,
        visibilityTimeoutSeconds: 60,
        waitTimeSeconds: 20,
      });
    });
  });

  describe('ack', () => {
    it('should delete message from queue', async () => {
      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          return Promise.resolve({ QueueUrl: testQueueUrl });
        }
        if (command._type === 'DeleteMessage') {
          expect(command.input.ReceiptHandle).toBe('receipt-123');
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      await queue.ack('test-queue', 'receipt-123');

      const deleteCall = mockSend.mock.calls.find(
        (call) => call[0]._type === 'DeleteMessage'
      );
      expect(deleteCall).toBeDefined();
    });
  });

  describe('nack', () => {
    it('should change message visibility to make it visible again', async () => {
      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          return Promise.resolve({ QueueUrl: testQueueUrl });
        }
        if (command._type === 'ChangeMessageVisibility') {
          expect(command.input.ReceiptHandle).toBe('receipt-456');
          expect(command.input.VisibilityTimeout).toBe(0);
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      await queue.nack('test-queue', 'receipt-456');
    });

    it('should use delay seconds for visibility timeout', async () => {
      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          return Promise.resolve({ QueueUrl: testQueueUrl });
        }
        if (command._type === 'ChangeMessageVisibility') {
          expect(command.input.VisibilityTimeout).toBe(30);
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      await queue.nack('test-queue', 'receipt-456', 30);
    });
  });

  describe('moveToDLQ', () => {
    it('should send message to DLQ with metadata', async () => {
      const message: QueueMessage = {
        id: 'original-msg-id',
        body: { data: 'failed' },
        receiptHandle: 'receipt-original',
        attributes: { priority: 'high' },
        enqueuedAt: new Date(),
        retryCount: 5,
      };

      let sentToDlq = false;
      let deletedFromOriginal = false;

      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          if (command.input.QueueName === 'test-queue-dlq') {
            return Promise.resolve({ QueueUrl: testDlqUrl });
          }
          return Promise.resolve({ QueueUrl: testQueueUrl });
        }
        if (command._type === 'SendMessage' && command.input.QueueUrl === testDlqUrl) {
          sentToDlq = true;
          expect(command.input.MessageAttributes.originalQueue.StringValue).toBe(
            'test-queue'
          );
          expect(command.input.MessageAttributes.originalMessageId.StringValue).toBe(
            'original-msg-id'
          );
          expect(command.input.MessageAttributes.original_priority.StringValue).toBe(
            'high'
          );
          return Promise.resolve({ MessageId: 'dlq-msg' });
        }
        if (command._type === 'DeleteMessage') {
          deletedFromOriginal = true;
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      await queue.moveToDLQ('test-queue', message);

      expect(sentToDlq).toBe(true);
      expect(deletedFromOriginal).toBe(true);
    });

    it('should work without receipt handle', async () => {
      const message: QueueMessage = {
        id: 'msg-no-receipt',
        body: { data: 'failed' },
        enqueuedAt: new Date(),
      };

      let deleteAttempted = false;

      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          return Promise.resolve({ QueueUrl: testDlqUrl });
        }
        if (command._type === 'SendMessage') {
          return Promise.resolve({ MessageId: 'dlq-msg' });
        }
        if (command._type === 'DeleteMessage') {
          deleteAttempted = true;
        }
        return Promise.resolve({});
      });

      await queue.moveToDLQ('test-queue', message);

      expect(deleteAttempted).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should use queue prefix', async () => {
      const prefixedQueue = new SqsQueueProvider({
        queuePrefix: 'prod-',
        cacheQueueUrls: false,
      });

      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          expect(command.input.QueueName).toBe('prod-my-queue');
          return Promise.resolve({ QueueUrl: 'https://sqs.../prod-my-queue' });
        }
        if (command._type === 'SendMessage') {
          return Promise.resolve({ MessageId: 'msg-prefixed' });
        }
        return Promise.resolve({});
      });

      await prefixedQueue.enqueue('my-queue', { data: 'test' });
    });

    it('should cache queue URLs when enabled', async () => {
      const cachedQueue = new SqsQueueProvider({
        cacheQueueUrls: true,
      });

      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          return Promise.resolve({ QueueUrl: testQueueUrl });
        }
        if (command._type === 'SendMessage') {
          return Promise.resolve({ MessageId: 'msg' });
        }
        return Promise.resolve({});
      });

      // First call should lookup URL
      await cachedQueue.enqueue('cached-queue', { data: 1 });
      // Second call should use cache
      await cachedQueue.enqueue('cached-queue', { data: 2 });

      const getQueueUrlCalls = mockSend.mock.calls.filter(
        (call) => call[0]._type === 'GetQueueUrl'
      );
      expect(getQueueUrlCalls).toHaveLength(1);
    });

    it('should clear URL cache', async () => {
      const cachedQueue = new SqsQueueProvider({
        cacheQueueUrls: true,
      });

      mockSend.mockImplementation((command: any) => {
        if (command._type === 'GetQueueUrl') {
          return Promise.resolve({ QueueUrl: testQueueUrl });
        }
        if (command._type === 'SendMessage') {
          return Promise.resolve({ MessageId: 'msg' });
        }
        return Promise.resolve({});
      });

      await cachedQueue.enqueue('clear-test', { data: 1 });
      cachedQueue.clearUrlCache();
      await cachedQueue.enqueue('clear-test', { data: 2 });

      const getQueueUrlCalls = mockSend.mock.calls.filter(
        (call) => call[0]._type === 'GetQueueUrl'
      );
      expect(getQueueUrlCalls).toHaveLength(2);
    });
  });
});
