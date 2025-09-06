import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock the logger
jest.mock('../../logger', () => ({
  info: jest.fn(),
}));

// Mock the httpRequest function
jest.mock('../../../lib/httpRequest', () => ({
  httpRequest: jest.fn(),
}));

const { httpRequest } = require('../../../lib/httpRequest');
const mockHttpRequest = httpRequest as jest.MockedFunction<typeof httpRequest>;

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
    mockHttpRequest.mockImplementation((opts: any) => {
      const mockResponse = {
        statusCode: 200,
        headers: {},
        body: JSON.stringify({ success: true }),
      };
      return Promise.resolve(mockResponse);
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

    mockHttpRequest.mockRejectedValue(new Error('Network timeout'));

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

    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: 'invalid json response',
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

    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify({ success: true }),
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    // Verify that httpRequest was called with the correct URL
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('http://adguard.example.com'),
        headers: expect.objectContaining({
          Authorization: expect.any(String),
        }),
      })
    );
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

    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify({ success: true }),
    });

    await POST(mockRequest);

    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'curl/8.0.1',
          'Accept': '*/*',
          'Connection': 'close',
          'Authorization': expect.any(String),
        }),
      })
    );
  });
});
