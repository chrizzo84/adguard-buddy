// Mock the logger
jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Mock the doSync function
jest.mock('../../../../lib/sync', () => ({
  doSync: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '../route';

// After import, grab the mocked function reference
const { doSync } = require('../../../../lib/sync');

describe('/api/sync-category', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if required parameters are missing', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({}),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toBe('Missing source, destination, or category');
  });

  it('should return 200 and call doSync for valid parameters', async () => {
    doSync.mockResolvedValue(undefined);
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        sourceConnection: 'conn1',
        destinationConnection: 'conn2',
        category: 'whitelist'
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(doSync).toHaveBeenCalledWith(
      expect.any(Function),
      'conn1',
      'conn2',
      'whitelist'
    );
  });

  it('should handle sync errors gracefully', async () => {
    doSync.mockRejectedValue(new Error('Sync failed'));
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        sourceConnection: 'conn1',
        destinationConnection: 'conn2',
        category: 'whitelist'
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });
});
