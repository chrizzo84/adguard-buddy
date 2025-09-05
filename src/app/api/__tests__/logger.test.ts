import logger from '../logger';

describe('logger', () => {
  it('exports a logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger).toBe('object');
  });

  it('has expected logger methods', () => {
    expect(logger).toHaveProperty('info');
    expect(logger).toHaveProperty('error');
    expect(logger).toHaveProperty('warn');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });
});
