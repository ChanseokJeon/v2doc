export { JobProcessor } from './processor';
export type { WorkerConfig } from './processor';

// Entry point for running worker standalone
if (require.main === module) {
  const { JobProcessor } = require('./processor');

  const worker = new JobProcessor();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down...');
    await worker.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down...');
    await worker.stop();
    process.exit(0);
  });

  // Start worker
  worker.start().catch((error: Error) => {
    console.error('Worker failed:', error);
    process.exit(1);
  });
}
