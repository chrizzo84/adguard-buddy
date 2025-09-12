/**
 * @jest-environment node
 */
import { startAutosyncScheduler, stopAutosyncScheduler, restartAutosyncScheduler } from '../autosyncScheduler';
import cron from 'node-cron';
import fs from 'fs/promises';

jest.mock('node-cron');
jest.mock('fs/promises');

const mockCron = cron as unknown as {
  schedule: jest.Mock;
};

const mockFs = fs as unknown as {
  readFile: jest.Mock;
};

describe('autosyncScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCron.schedule.mockImplementation(() => ({ stop: jest.fn() }));
  });

  afterEach(() => {
    // Ensure any running job is stopped and modules are reset to avoid leaking mocks to other test files
    stopAutosyncScheduler();
    jest.resetModules();
  });

  it('schedules a job when enabled with minute interval', async () => {
    mockFs.readFile.mockResolvedValue(JSON.stringify({ enabled: true, interval: '5m' }));
    await startAutosyncScheduler();
    expect(mockCron.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));
  });

  it('schedules a job when enabled with hour interval', async () => {
    mockFs.readFile.mockResolvedValue(JSON.stringify({ enabled: true, interval: '2h' }));
    await startAutosyncScheduler();
    expect(mockCron.schedule).toHaveBeenCalledWith('0 */2 * * *', expect.any(Function));
  });

  it('does not schedule when disabled', async () => {
    mockFs.readFile.mockResolvedValue(JSON.stringify({ enabled: false, interval: '5m' }));
    await startAutosyncScheduler();
    expect(mockCron.schedule).not.toHaveBeenCalled();
  });

  it('restart stops previous job', async () => {
    mockFs.readFile.mockResolvedValue(JSON.stringify({ enabled: true, interval: '1m' }));
    const stopFn = jest.fn();
    mockCron.schedule.mockReturnValue({ stop: stopFn });
    await startAutosyncScheduler();
    await restartAutosyncScheduler();
    expect(stopFn).toHaveBeenCalled();
    expect(mockCron.schedule).toHaveBeenCalledTimes(2);
  });
});
