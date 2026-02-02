import { PubSubQueueProvider, PubSubClient } from '../../../src/cloud/gcp/queue';

describe('PubSubQueueProvider', () => {
  // Mock functions
  const mockPublishMessage = jest.fn();
  const mockPull = jest.fn();
  const mockAcknowledge = jest.fn();
  const mockModifyAckDeadline = jest.fn();

  const mockSubscription = jest.fn(() => ({
    pull: mockPull,
    acknowledge: mockAcknowledge,
    modifyAckDeadline: mockModifyAckDeadline,
  }));

  const mockTopic = jest.fn(() => ({
    publishMessage: mockPublishMessage,
    subscription: mockSubscription,
  }));

  const mockClient: PubSubClient = {
    topic: mockTopic,
  };

  let queue: PubSubQueueProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    queue = new PubSubQueueProvider({ client: mockClient });
  });

  describe('enqueue', () => {
    it('should enqueue a message and return id', async () => {
      const messageId = 'msg-123';
      mockPublishMessage.mockResolvedValue(messageId);

      const id = await queue.enqueue('test-queue', { data: 'test' });

      expect(id).toBe(messageId);
      expect(mockTopic).toHaveBeenCalledWith('test-queue');
      expect(mockPublishMessage).toHaveBeenCalledWith({
        data: Buffer.from(JSON.stringify({ data: 'test' })),
        attributes: undefined,
      });
    });

    it('should handle priority option', async () => {
      mockPublishMessage.mockResolvedValue('msg-456');

      await queue.enqueue('priority-queue', { order: 1 }, { priority: 'high' });

      expect(mockPublishMessage).toHaveBeenCalledWith({
        data: expect.any(Buffer),
        attributes: { priority: 'high' },
      });
    });

    it('should handle groupId option as orderingKey', async () => {
      mockPublishMessage.mockResolvedValue('msg-789');

      await queue.enqueue('ordered-queue', { data: 1 }, { groupId: 'group-1' });

      expect(mockPublishMessage).toHaveBeenCalledWith({
        data: expect.any(Buffer),
        attributes: { orderingKey: 'group-1' },
      });
    });

    it('should handle deduplicationId option', async () => {
      mockPublishMessage.mockResolvedValue('msg-dedup');

      await queue.enqueue('dedup-queue', { data: 1 }, { deduplicationId: 'dedup-123' });

      expect(mockPublishMessage).toHaveBeenCalledWith({
        data: expect.any(Buffer),
        attributes: { deduplicationId: 'dedup-123' },
      });
    });

    it('should handle delaySeconds option by adding scheduledTime attribute', async () => {
      mockPublishMessage.mockResolvedValue('msg-delayed');
      const before = Date.now();

      await queue.enqueue('delay-queue', { data: 1 }, { delaySeconds: 60 });

      const after = Date.now();
      const callArgs = mockPublishMessage.mock.calls[0][0];
      const scheduledTime = parseInt(callArgs.attributes.scheduledTime, 10);

      expect(scheduledTime).toBeGreaterThanOrEqual(before + 60000);
      expect(scheduledTime).toBeLessThanOrEqual(after + 60000);
    });

    it('should handle multiple options together', async () => {
      mockPublishMessage.mockResolvedValue('msg-multi');

      await queue.enqueue('multi-queue', { data: 1 }, {
        priority: 'high',
        groupId: 'group-a',
        deduplicationId: 'dedup-xyz',
      });

      expect(mockPublishMessage).toHaveBeenCalledWith({
        data: expect.any(Buffer),
        attributes: {
          priority: 'high',
          orderingKey: 'group-a',
          deduplicationId: 'dedup-xyz',
        },
      });
    });
  });

  describe('receive', () => {
    it('should receive messages from queue', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          data: Buffer.from(JSON.stringify({ msg: 'first' })),
          attributes: {},
          publishTime: new Date('2024-01-01'),
          modifyAckDeadline: jest.fn(),
        },
        {
          id: 'msg-2',
          data: Buffer.from(JSON.stringify({ msg: 'second' })),
          attributes: { retryCount: '2' },
          publishTime: new Date('2024-01-02'),
          modifyAckDeadline: jest.fn(),
        },
      ];

      mockPull.mockResolvedValue([[mockMessages, {}]]);

      const messages = await queue.receive('receive-queue');

      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[0].body).toEqual({ msg: 'first' });
      expect(messages[0].retryCount).toBe(0);
      expect(messages[1].retryCount).toBe(2);
    });

    it('should respect maxMessages option', async () => {
      mockPull.mockResolvedValue([[[], {}]]);

      await queue.receive('max-queue', { maxMessages: 5 });

      expect(mockPull).toHaveBeenCalledWith({
        maxMessages: 5,
        autoPaginate: false,
      });
    });

    it('should modify ack deadline when visibilityTimeoutSeconds is set', async () => {
      const mockModify = jest.fn();
      const mockMessages = [
        {
          id: 'msg-visibility',
          data: Buffer.from(JSON.stringify({ data: 1 })),
          attributes: {},
          publishTime: new Date(),
          modifyAckDeadline: mockModify,
        },
      ];

      mockPull.mockResolvedValue([[mockMessages, {}]]);

      await queue.receive('visibility-queue', { visibilityTimeoutSeconds: 120 });

      expect(mockModify).toHaveBeenCalledWith(120);
    });

    it('should return empty array for empty queue', async () => {
      mockPull.mockResolvedValue([[[], {}]]);

      const messages = await queue.receive('empty-queue');

      expect(messages).toEqual([]);
    });

    it('should handle non-JSON message data', async () => {
      const mockMessages = [
        {
          id: 'msg-text',
          data: Buffer.from('plain text message'),
          attributes: {},
          publishTime: new Date(),
          modifyAckDeadline: jest.fn(),
        },
      ];

      mockPull.mockResolvedValue([[mockMessages, {}]]);

      const messages = await queue.receive<string>('text-queue');

      expect(messages[0].body).toBe('plain text message');
    });
  });

  describe('ack', () => {
    it('should acknowledge message', async () => {
      mockAcknowledge.mockResolvedValue(undefined);

      await queue.ack('ack-queue', 'receipt-123');

      expect(mockTopic).toHaveBeenCalledWith('ack-queue');
      expect(mockSubscription).toHaveBeenCalledWith('ack-queue');
      expect(mockAcknowledge).toHaveBeenCalledWith(['receipt-123']);
    });
  });

  describe('nack', () => {
    it('should nack message with delay', async () => {
      mockModifyAckDeadline.mockResolvedValue(undefined);

      await queue.nack('nack-queue', 'receipt-456', 30);

      expect(mockModifyAckDeadline).toHaveBeenCalledWith('receipt-456', 30);
    });

    it('should nack message immediately without delay', async () => {
      mockModifyAckDeadline.mockResolvedValue(undefined);

      await queue.nack('nack-queue', 'receipt-789');

      expect(mockModifyAckDeadline).toHaveBeenCalledWith('receipt-789', 0);
    });
  });

  describe('moveToDLQ', () => {
    it('should move message to DLQ topic', async () => {
      mockPublishMessage.mockResolvedValue('dlq-msg-id');

      const message = {
        id: 'original-msg',
        body: { data: 'failed' },
        attributes: { source: 'test' },
        enqueuedAt: new Date('2024-01-01'),
        retryCount: 3,
      };

      await queue.moveToDLQ('dlq-test', message);

      expect(mockTopic).toHaveBeenCalledWith('dlq-test-dlq');
      expect(mockPublishMessage).toHaveBeenCalledWith({
        data: Buffer.from(JSON.stringify({ data: 'failed' })),
        attributes: expect.objectContaining({
          source: 'test',
          originalQueue: 'dlq-test',
          originalMessageId: 'original-msg',
          retryCount: '3',
        }),
      });
    });

    it('should use custom DLQ suffix', async () => {
      const customQueue = new PubSubQueueProvider({
        client: mockClient,
        dlqSuffix: '-dead-letter',
      });
      mockPublishMessage.mockResolvedValue('dlq-msg-id');

      await customQueue.moveToDLQ('custom-queue', {
        id: 'msg-id',
        body: {},
        enqueuedAt: new Date(),
      });

      expect(mockTopic).toHaveBeenCalledWith('custom-queue-dead-letter');
    });

    it('should support legacy string constructor for dlqSuffix', async () => {
      // This tests backward compatibility - the legacy constructor won't have
      // an injected client, so we skip the actual operation test
      const legacyQueue = new PubSubQueueProvider('-legacy-dlq');
      expect(legacyQueue).toBeDefined();
    });
  });
});
