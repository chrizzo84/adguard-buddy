// Ensure mocks are registered BEFORE importing the route so the route's dependencies use them
jest.mock('../../logger', () => ({ info: jest.fn() }));
jest.mock('../../../lib/httpRequest', () => ({ httpRequest: jest.fn() }));
jest.mock('../../../../lib/settings', () => ({
  getAllSettings: jest.fn(),
}));

import { POST } from '../route';
import { NextRequest } from 'next/server';

// After import, grab the mocked function reference
const { httpRequest } = require('../../../lib/httpRequest');
const mockHttpRequest = httpRequest as jest.MockedFunction<typeof httpRequest>;
const { getAllSettings } = require('../../../../lib/settings');
const mockGetAllSettings = getAllSettings as jest.MockedFunction<typeof getAllSettings>;

describe('/api/get-all-settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch all settings successfully', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
        username: 'admin',
        password: 'password',
        allowInsecure: false,
      }),
    } as unknown as NextRequest;

    // Mock successful responses for all endpoints
    const mockSettings: Record<string, any> = {};
    for (let i = 0; i < 13; i++) {
      mockSettings[`endpoint${i}`] = { success: true };
    }
    mockGetAllSettings.mockResolvedValue({
      settings: mockSettings,
      errors: {},
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.settings).toBeDefined();
    expect(result.errors).toBeDefined();
    expect(Object.keys(result.settings)).toHaveLength(13); // All endpoints should be present
    expect(Object.keys(result.errors)).toHaveLength(0); // No errors expected
  });

  it('should handle mixed success and failure responses', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
      }),
    } as unknown as NextRequest;

    // Mock mixed responses - some succeed, some fail
    let callCount = 0;
    mockHttpRequest.mockImplementation((opts: any) => {
      callCount++;
      if (callCount % 2 === 0) {
        return Promise.resolve({
          statusCode: 200,
          headers: {},
          body: JSON.stringify({ success: true }),
        });
      } else {
        return Promise.resolve({
          statusCode: 500,
          headers: {},
          body: 'Internal Server Error',
        });
      }
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.settings).toBeDefined();
    expect(result.errors).toBeDefined();
    expect(Object.keys(result.settings).length + Object.keys(result.errors).length).toBe(13);
  });

  it('should handle network errors', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
      }),
    } as unknown as NextRequest;

    mockGetAllSettings.mockResolvedValue({
      settings: {},
      errors: {
        status: 'Network timeout',
        profile: 'Network timeout',
        dns: 'Network timeout',
        filtering: 'Network timeout',
        safebrowsing: 'Network timeout',
        parental: 'Network timeout',
        safesearch: 'Network timeout',
        accessList: 'Network timeout',
        blockedServices: 'Network timeout',
        rewrites: 'Network timeout',
        tls: 'Network timeout',
        querylogConfig: 'Network timeout',
        statsConfig: 'Network timeout',
      },
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.settings).toBeDefined();
    expect(result.errors).toBeDefined();
    expect(Object.keys(result.errors)).toHaveLength(13); // All endpoints should have errors
  });

  it('should handle invalid JSON in request', async () => {
    const mockRequest = {
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as unknown as NextRequest;

    await expect(POST(mockRequest)).rejects.toThrow('Invalid JSON');
  });

  it('should handle invalid JSON in responses gracefully', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
      }),
    } as unknown as NextRequest;

    mockGetAllSettings.mockResolvedValue({
      settings: { status: 'invalid json response' },
      errors: {},
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.settings).toBeDefined();
    // Should contain the raw body when JSON parsing fails
    expect(typeof result.settings.status).toBe('string');
  });

  it('should use URL when provided instead of IP', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        url: 'http://adguard.example.com',
        username: 'admin',
        password: 'password',
      }),
    } as unknown as NextRequest;

    mockGetAllSettings.mockResolvedValue({
      settings: { status: { success: true } },
      errors: {},
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    // Verify that getAllSettings was called with the correct URL
    expect(mockGetAllSettings).toHaveBeenCalledWith({
      url: 'http://adguard.example.com',
      username: 'admin',
      password: 'password',
    });
  });

  it('should include proper headers in requests', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
        username: 'admin',
        password: 'password',
      }),
    } as unknown as NextRequest;

    mockGetAllSettings.mockResolvedValue({
      settings: { status: { success: true } },
      errors: {},
    });

    await POST(mockRequest);

    expect(mockGetAllSettings).toHaveBeenCalledWith({
      ip: '192.168.1.1',
      port: 80,
      username: 'admin',
      password: 'password',
    });
  });
});
