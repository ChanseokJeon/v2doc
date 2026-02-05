import { JobProcessor } from './processor';

async function main() {
  // eslint-disable-next-line no-console
  console.log('Starting yt2pdf Worker...');

  const worker = new JobProcessor({
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '3', 10),
    visibilityTimeout: parseInt(process.env.VISIBILITY_TIMEOUT || '600', 10),
    pollingInterval: parseInt(process.env.POLLING_INTERVAL || '5000', 10),
    tempDir: process.env.TEMP_DIR || '/tmp/yt2pdf',
    outputBucket: process.env.OUTPUT_BUCKET || 'yt2pdf-results',
  });

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down gracefully...`);
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
  });

  // Start the worker
  await worker.start();
}

main().catch((error) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
