export { JobProcessor } from './processor';
export type { WorkerConfig } from './processor';

// Entry point for running worker standalone
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
  const { JobProcessor } = require('./processor');

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const worker = new JobProcessor() as { stop: () => Promise<void>; start: () => Promise<void> };

  // Graceful shutdown
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  process.on('SIGTERM', async () => {
    // eslint-disable-next-line no-console
    console.log('Received SIGTERM, shutting down...');
    await worker.stop();
    process.exit(0);
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  process.on('SIGINT', async () => {
    // eslint-disable-next-line no-console
    console.log('Received SIGINT, shutting down...');
    await worker.stop();
    process.exit(0);
  });

  // Start worker
  void worker.start().catch((error: Error) => {
    // eslint-disable-next-line no-console
    console.error('Worker failed:', error);
    process.exit(1);
  });
}
