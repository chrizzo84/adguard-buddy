import { POST } from '../route';
import { getAutoSyncScheduler } from '@/app/lib/auto-sync-scheduler';

// Mock the scheduler
jest.mock('@/app/lib/auto-sync-scheduler');

describe('/api/auto-sync-trigger', () => {
  let mockScheduler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockScheduler = {
      triggerManualSync: jest.fn(),
    };

    (getAutoSyncScheduler as jest.Mock).mockReturnValue(mockScheduler);
  });

  describe('POST', () => {
    it('should trigger manual sync successfully', async () => {
      mockScheduler.triggerManualSync.mockResolvedValue(undefined);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        message: 'Manual auto-sync triggered successfully',
      });
      expect(mockScheduler.triggerManualSync).toHaveBeenCalledTimes(1);
    });

    it('should handle sync already in progress', async () => {
      mockScheduler.triggerManualSync.mockResolvedValue(undefined);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle scheduler errors', async () => {
      mockScheduler.triggerManualSync.mockRejectedValue(new Error('Sync failed'));

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Sync failed' });
    });

    it('should handle non-Error objects', async () => {
      mockScheduler.triggerManualSync.mockRejectedValue('String error');

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'String error' });
    });

    it('should handle network timeouts', async () => {
      mockScheduler.triggerManualSync.mockRejectedValue(new Error('Network timeout'));

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Network timeout');
    });

    it('should handle scheduler not initialized', async () => {
      (getAutoSyncScheduler as jest.Mock).mockImplementation(() => {
        throw new Error('Scheduler not initialized');
      });

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Scheduler not initialized');
    });

    it('should handle concurrent trigger attempts', async () => {
      mockScheduler.triggerManualSync.mockResolvedValue(undefined);

      const [response1, response2] = await Promise.all([POST(), POST()]);
      const [data1, data2] = await Promise.all([response1.json(), response2.json()]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(data1.success).toBe(true);
      expect(data2.success).toBe(true);
      expect(mockScheduler.triggerManualSync).toHaveBeenCalledTimes(2);
    });
  });
});
