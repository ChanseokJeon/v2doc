/**
 * Logger 유틸리티 테스트
 */

// We need to test the actual logger, so we don't mock it
// But we need to mock chalk to avoid ESM issues
jest.mock('chalk', () => ({
  red: (s: string) => `[RED]${s}[/RED]`,
  yellow: (s: string) => `[YELLOW]${s}[/YELLOW]`,
  blue: (s: string) => `[BLUE]${s}[/BLUE]`,
  gray: (s: string) => `[GRAY]${s}[/GRAY]`,
  green: (s: string) => `[GREEN]${s}[/GREEN]`,
  cyan: (s: string) => `[CYAN]${s}[/CYAN]`,
}));

import { Logger, logger, log } from '../../../src/utils/logger';

describe('Logger', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let stdoutWriteSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create logger with default error level', () => {
      const l = new Logger();
      expect(l).toBeInstanceOf(Logger);
    });

    it('should create logger with specified level', () => {
      const l = new Logger('debug');
      expect(l).toBeInstanceOf(Logger);
    });
  });

  describe('setLevel', () => {
    it('should change log level', () => {
      const l = new Logger('error');
      l.setLevel('debug');

      // After setting to debug, info should be logged
      l.info('test');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should always log error messages', () => {
      const l = new Logger('error');
      l.error('Test error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Test error'));
    });

    it('should include stack trace in debug mode', () => {
      const l = new Logger('debug');
      const error = new Error('Test error');
      l.error('Error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });

    it('should not include stack trace in error mode', () => {
      const l = new Logger('error');
      const error = new Error('Test error');
      l.error('Error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle error message when no stack', () => {
      const l = new Logger('debug');
      const error = { message: 'No stack error' } as Error;
      l.error('Error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No stack error'));
    });
  });

  describe('warn', () => {
    it('should log warn in warn level', () => {
      const l = new Logger('warn');
      l.warn('Test warning');

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Test warning'));
    });

    it('should not log warn in error level', () => {
      const l = new Logger('error');
      l.warn('Test warning');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should include error details in debug mode', () => {
      const l = new Logger('debug');
      const error = new Error('Warning detail');
      l.warn('Warning occurred', error);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('info', () => {
    it('should log info in info level', () => {
      const l = new Logger('info');
      l.info('Test info');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test info'));
    });

    it('should not log info in warn level', () => {
      const l = new Logger('warn');
      l.info('Test info');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('debug', () => {
    it('should log debug in debug level', () => {
      const l = new Logger('debug');
      l.debug('Test debug');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test debug'));
    });

    it('should not log debug in info level', () => {
      const l = new Logger('info');
      l.debug('Test debug');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should include data object in debug output', () => {
      const l = new Logger('debug');
      const data = { key: 'value', nested: { a: 1 } };
      l.debug('With data', data);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('With data'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(data, null, 2))
      );
    });
  });

  describe('success', () => {
    it('should always log success messages', () => {
      const l = new Logger('error');
      l.success('Operation complete');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Operation complete'));
    });
  });

  describe('progress', () => {
    it('should write progress to stdout', () => {
      const l = new Logger('error');
      l.progress(5, 10, 'Processing');

      expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('50%'));
      expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('5/10'));
      expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Processing'));
    });

    it('should add newline at 100%', () => {
      const l = new Logger('error');
      l.progress(10, 10);

      expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('100%'));
      expect(stdoutWriteSpy).toHaveBeenCalledWith('\n');
    });

    it('should not add newline before 100%', () => {
      const l = new Logger('error');
      l.progress(5, 10);

      expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
    });

    it('should work without message', () => {
      const l = new Logger('error');
      l.progress(3, 6);

      expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('50%'));
      expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('3/6'));
    });
  });

  describe('singleton logger', () => {
    it('should export default logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should allow setting level on singleton', () => {
      logger.setLevel('debug');
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('log convenience functions', () => {
    beforeEach(() => {
      // Set logger to debug to enable all logs
      logger.setLevel('debug');
    });

    it('should have error function', () => {
      log.error('Test');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should have warn function', () => {
      log.warn('Test');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should have info function', () => {
      log.info('Test');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should have debug function', () => {
      log.debug('Test');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should have success function', () => {
      log.success('Test');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should pass error to error function', () => {
      const error = new Error('Test');
      log.error('Failed', error);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should pass error to warn function', () => {
      const error = new Error('Test');
      log.warn('Warning', error);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should pass data to debug function', () => {
      const data = { foo: 'bar' };
      log.debug('Debug data', data);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Debug data'));
    });
  });
});
