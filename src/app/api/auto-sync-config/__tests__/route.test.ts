import { GET, POST } from '../route';
import { getAutoSyncScheduler } from '@/app/lib/auto-sync-scheduler';
import { NextRequest } from 'next/server';

// Mock the scheduler
jest.mock('@/app/lib/auto-sync-scheduler');

describe('/api/auto-sync-config', () => {
  let mockScheduler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockScheduler = {
      getConfig: jest.fn(),
      isRunning: jest.fn(),
      isPaused: jest.fn(),
      getNextSyncTime: jest.fn(),
      getLogs: jest.fn(),
      updateConfig: jest.fn(),
    };

    (getAutoSyncScheduler as jest.Mock).mockReturnValue(mockScheduler);
  });

  describe('GET', () => {
    it('should return auto-sync configuration and status', async () => {
      const mockConfig = {
        enabled: true,
        interval: '15min' as const,
        categories: ['filtering', 'querylogConfig'],
        paused: false,
      };
      const mockLogs = [
        {
          timestamp: '2025-10-01T10:00:00Z',
          status: 'success',
          message: 'Sync completed',
          details: {},
        },
      ];

      mockScheduler.getConfig.mockReturnValue(mockConfig);
      mockScheduler.isRunning.mockReturnValue(true);
      mockScheduler.isPaused.mockReturnValue(false);
      mockScheduler.getNextSyncTime.mockReturnValue('2025-10-01T10:15:00Z');
      mockScheduler.getLogs.mockReturnValue(mockLogs);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        config: mockConfig,
        isRunning: true,
        isPaused: false,
        nextSync: '2025-10-01T10:15:00Z',
        recentLogs: mockLogs,
      });
      expect(mockScheduler.getLogs).toHaveBeenCalledWith(50);
    });

    it('should return paused status when auto-sync is paused', async () => {
      const mockConfig = {
        enabled: true,
        interval: '15min' as const,
        categories: ['filtering'],
        paused: true,
      };

      mockScheduler.getConfig.mockReturnValue(mockConfig);
      mockScheduler.isRunning.mockReturnValue(true);
      mockScheduler.isPaused.mockReturnValue(true);
      mockScheduler.getNextSyncTime.mockReturnValue('2025-10-01T10:15:00Z');
      mockScheduler.getLogs.mockReturnValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isPaused).toBe(true);
      expect(data.config.paused).toBe(true);
    });

    it('should return disabled status when auto-sync is disabled', async () => {
      const mockConfig = {
        enabled: false,
        interval: 'disabled' as const,
        categories: [],
        paused: false,
      };

      mockScheduler.getConfig.mockReturnValue(mockConfig);
      mockScheduler.isRunning.mockReturnValue(false);
      mockScheduler.isPaused.mockReturnValue(false);
      mockScheduler.getNextSyncTime.mockReturnValue(null);
      mockScheduler.getLogs.mockReturnValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isRunning).toBe(false);
      expect(data.config.enabled).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockScheduler.getConfig.mockImplementation(() => {
        throw new Error('Scheduler error');
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Scheduler error' });
    });

    it('should handle non-Error objects', async () => {
      mockScheduler.getConfig.mockImplementation(() => {
        throw 'String error';
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'String error' });
    });
  });

  describe('POST', () => {
    it('should update auto-sync configuration', async () => {
      const updates = {
        enabled: true,
        interval: '30min',
        categories: ['filtering', 'rewrites'],
      };

      const updatedConfig = {
        enabled: true,
        interval: '30min' as const,
        categories: ['filtering', 'rewrites'],
        paused: false,
      };

      mockScheduler.updateConfig.mockImplementation(() => {});
      mockScheduler.getConfig.mockReturnValue(updatedConfig);

      const request = {
        json: jest.fn().mockResolvedValue(updates),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        config: updatedConfig,
      });
      expect(mockScheduler.updateConfig).toHaveBeenCalledWith(updates);
    });

    it('should enable auto-sync from disabled state', async () => {
      const updates = {
        enabled: true,
        interval: '15min',
        categories: ['filtering'],
      };

      mockScheduler.updateConfig.mockImplementation(() => {});
      mockScheduler.getConfig.mockReturnValue({
        ...updates,
        paused: false,
      });

      const request = {
        json: jest.fn().mockResolvedValue(updates),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.config.enabled).toBe(true);
    });

    it('should disable auto-sync', async () => {
      const updates = {
        enabled: false,
        interval: 'disabled',
      };

      mockScheduler.updateConfig.mockImplementation(() => {});
      mockScheduler.getConfig.mockReturnValue({
        enabled: false,
        interval: 'disabled' as const,
        categories: [],
        paused: false,
      });

      const request = {
        json: jest.fn().mockResolvedValue(updates),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.config.enabled).toBe(false);
    });

    it('should update categories only', async () => {
      const updates = {
        categories: ['filtering', 'querylogConfig', 'statsConfig'],
      };

      mockScheduler.updateConfig.mockImplementation(() => {});
      mockScheduler.getConfig.mockReturnValue({
        enabled: true,
        interval: '15min' as const,
        categories: ['filtering', 'querylogConfig', 'statsConfig'],
        paused: false,
      });

      const request = {
        json: jest.fn().mockResolvedValue(updates),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.config.categories).toHaveLength(3);
    });

    it('should handle invalid JSON', async () => {
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('should handle scheduler errors during update', async () => {
      const updates = { enabled: true };

      mockScheduler.updateConfig.mockImplementation(() => {
        throw new Error('Update failed');
      });

      const request = {
        json: jest.fn().mockResolvedValue(updates),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Update failed' });
    });
  });
});
