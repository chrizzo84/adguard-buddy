import { POST } from '../route';
import { NextRequest } from 'next/server';
import { getAutoSyncScheduler } from '@/app/lib/auto-sync-scheduler';

// Mock the scheduler
jest.mock('@/app/lib/auto-sync-scheduler');

// Mock the logger
jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('/api/auto-sync-pause', () => {
  const mockScheduler = {
    pause: jest.fn(),
    resume: jest.fn(),
    isPaused: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAutoSyncScheduler as jest.Mock).mockReturnValue(mockScheduler);
  });

  it('pauses auto-sync successfully', async () => {
    mockScheduler.pause.mockReturnValue(undefined);
    mockScheduler.isPaused.mockReturnValue(true);

    const mockRequest = {
      json: jest.fn().mockResolvedValue({ action: 'pause' }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.paused).toBe(true);
    expect(mockScheduler.pause).toHaveBeenCalledTimes(1);
  });

  it('resumes auto-sync successfully', async () => {
    mockScheduler.resume.mockReturnValue(undefined);
    mockScheduler.isPaused.mockReturnValue(false);

    const mockRequest = {
      json: jest.fn().mockResolvedValue({ action: 'resume' }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.paused).toBe(false);
    expect(mockScheduler.resume).toHaveBeenCalledTimes(1);
  });

  it('returns error for invalid action', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({ action: 'invalid' }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid action. Must be "pause" or "resume"');
    expect(mockScheduler.pause).not.toHaveBeenCalled();
    expect(mockScheduler.resume).not.toHaveBeenCalled();
  });

  it('returns error for missing action', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({}),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid action. Must be "pause" or "resume"');
  });

  it('handles scheduler errors gracefully', async () => {
    mockScheduler.pause.mockImplementation(() => {
      throw new Error('Scheduler error');
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({ action: 'pause' }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Scheduler error');
  });
});
