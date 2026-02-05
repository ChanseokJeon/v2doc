import { LocalQueueProvider } from '../../../src/cloud/local/queue';

describe('LocalQueueProvider', () => {
  let queue: LocalQueueProvider;

  beforeEach(() => {
    queue = new LocalQueueProvider();
  });

  describe('enqueue', () => {
    it('should enqueue a message and return id', async () => {
      const id = await queue.enqueue('test-queue', { data: 'test' });
      expect(id).toMatch(/^local-msg-\d+$/);
      expect(queue.getQueueLength('test-queue')).toBe(1);
    });

    it('should handle priority messages', async () => {
      await queue.enqueue('priority-queue', { order: 1 });
      await queue.enqueue('priority-queue', { order: 2 }, { priority: 'high' });

      const messages = await queue.receive('priority-queue', { maxMessages: 2 });
      expect(messages[0].body).toEqual({ order: 2 }); // High priority first
    });
  });

  describe('receive', () => {
    it('should receive messages from queue', async () => {
      await queue.enqueue('receive-queue', { msg: 'first' });
      await queue.enqueue('receive-queue', { msg: 'second' });

      const messages = await queue.receive('receive-queue');
      expect(messages).toHaveLength(2);
      expect(messages[0].body).toEqual({ msg: 'first' });
    });

    it('should respect maxMessages', async () => {
      for (let i = 0; i < 5; i++) {
        await queue.enqueue('max-queue', { i });
      }

      const messages = await queue.receive('max-queue', { maxMessages: 2 });
      expect(messages).toHaveLength(2);
      expect(queue.getQueueLength('max-queue')).toBe(3);
    });

    it('should return empty array for empty queue', async () => {
      const messages = await queue.receive('empty-queue');
      expect(messages).toEqual([]);
    });
  });

  describe('ack', () => {
    it('should acknowledge message (no-op in local impl)', async () => {
      await queue.enqueue('ack-queue', { data: 'test' });
      const [msg] = await queue.receive('ack-queue');

      await expect(queue.ack('ack-queue', msg.receiptHandle!))
        .resolves.not.toThrow();
    });
  });

  describe('nack', () => {
    it('should return message to queue', async () => {
      await queue.enqueue('nack-queue', { data: 'test' });
      const [msg] = await queue.receive('nack-queue');

      expect(queue.getQueueLength('nack-queue')).toBe(0);

      await queue.nack('nack-queue', msg.receiptHandle!);
      expect(queue.getQueueLength('nack-queue')).toBe(1);
    });

    it('should preserve original message body on NACK', async () => {
      const originalBody = { data: 'important-data', id: 123 };
      await queue.enqueue('nack-body-queue', originalBody);
      const [msg] = await queue.receive('nack-body-queue');

      expect(msg.body).toEqual(originalBody);

      await queue.nack('nack-body-queue', msg.receiptHandle!);

      const [reQueuedMsg] = await queue.receive('nack-body-queue');
      expect(reQueuedMsg.body).toEqual(originalBody);
      expect(reQueuedMsg.retryCount).toBe(1);
    });

    it('should throw error when NACKing non-existent message', async () => {
      // nack() throws synchronously when message not found
      await expect(async () => {
        await queue.nack('nack-queue', 'invalid-receipt-handle');
      }).rejects.toThrow('not found in in-flight messages');
    });
  });

  describe('moveToDLQ', () => {
    it('should move message to DLQ', async () => {
      await queue.enqueue('dlq-test', { data: 'failed' });
      const [msg] = await queue.receive('dlq-test');

      await queue.moveToDLQ('dlq-test', msg);

      expect(queue.getDLQLength('dlq-test')).toBe(1);
    });
  });

  describe('helpers', () => {
    it('should clear all queues', async () => {
      await queue.enqueue('clear-test-1', { data: 1 });
      await queue.enqueue('clear-test-2', { data: 2 });

      queue.clear();

      expect(queue.getQueueLength('clear-test-1')).toBe(0);
      expect(queue.getQueueLength('clear-test-2')).toBe(0);
    });

    it('should clear specific queue', async () => {
      await queue.enqueue('specific-1', { data: 1 });
      await queue.enqueue('specific-2', { data: 2 });

      queue.clearQueue('specific-1');

      expect(queue.getQueueLength('specific-1')).toBe(0);
      expect(queue.getQueueLength('specific-2')).toBe(1);
    });
  });

  describe('delayed messages', () => {
    it('should handle delayed enqueue', async () => {
      jest.useFakeTimers();

      await queue.enqueue('delayed-queue', { data: 'delayed' }, { delaySeconds: 1 });

      // Message not in queue immediately
      expect(queue.getQueueLength('delayed-queue')).toBe(0);

      // Advance time
      jest.advanceTimersByTime(1100);

      // Now message should be in queue
      expect(queue.getQueueLength('delayed-queue')).toBe(1);

      jest.useRealTimers();
    });

    it('should handle nack with delay', async () => {
      jest.useFakeTimers();

      await queue.enqueue('nack-delay-queue', { data: 'test' });
      const [msg] = await queue.receive('nack-delay-queue');

      expect(queue.getQueueLength('nack-delay-queue')).toBe(0);

      await queue.nack('nack-delay-queue', msg.receiptHandle!, 1);

      // Message not re-queued immediately
      expect(queue.getQueueLength('nack-delay-queue')).toBe(0);

      // Advance time
      jest.advanceTimersByTime(1100);

      // Now message should be back
      expect(queue.getQueueLength('nack-delay-queue')).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('receive with wait', () => {
    it('should wait for messages when queue is empty', async () => {
      jest.useFakeTimers();

      const receivePromise = queue.receive('wait-queue', { waitTimeSeconds: 2 });

      // Queue is empty, should wait

      // Enqueue after 500ms
      setTimeout(() => {
        queue.enqueue('wait-queue', { data: 'arrived' });
      }, 500);

      jest.advanceTimersByTime(600);

      const messages = await receivePromise;
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toEqual({ data: 'arrived' });

      jest.useRealTimers();
    });

    it('should return empty after wait timeout', async () => {
      jest.useFakeTimers();

      const receivePromise = queue.receive('empty-wait-queue', { waitTimeSeconds: 1 });

      jest.advanceTimersByTime(1100);

      const messages = await receivePromise;
      expect(messages).toHaveLength(0);

      jest.useRealTimers();
    });
  });
});
