import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock the logger
jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Mock the httpRequest function
jest.mock('../../../lib/httpRequest', () => ({
  httpRequest: jest.fn(),
}));

const { httpRequest } = require('../../../lib/httpRequest');
const mockHttpRequest = httpRequest as jest.MockedFunction<typeof httpRequest>;

describe('/api/query-log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch query log successfully with default parameters', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
        username: 'admin',
        password: 'password',
        allowInsecure: false,
      }),
    } as unknown as NextRequest;

    const mockQueryLog = {
      data: [
        { time: '2024-01-01T00:00:00Z', domain: 'example.com', client: '192.168.1.100' },
      ],
    };

    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(mockQueryLog),
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual(mockQueryLog);
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://192.168.1.1:80/control/querylog?limit=100&offset=0&response_status=all',
        headers: expect.objectContaining({
          Authorization: expect.any(String),
        }),
      })
    );
  });

  it('should fetch query log with custom parameters', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 8080,
        limit: 50,
        offset: 100,
        response_status: 'blocked',
        allowInsecure: true,
      }),
    } as unknown as NextRequest;

    const mockQueryLog = { data: [] };

    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(mockQueryLog),
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://192.168.1.1:8080/control/querylog?limit=50&offset=100&response_status=blocked',
        allowInsecure: true,
      })
    );
  });

  it('should use URL when provided instead of IP', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        url: 'https://adguard.example.com',
        username: 'admin',
        password: 'password',
      }),
    } as unknown as NextRequest;

    const mockQueryLog = { data: [] };

    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(mockQueryLog),
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://adguard.example.com/control/querylog?limit=100&offset=0&response_status=all',
      })
    );
  });

  it('should return error when AdGuard Home responds with error status', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
      }),
    } as unknown as NextRequest;

    mockHttpRequest.mockResolvedValue({
      statusCode: 500,
      headers: {},
      body: 'Internal Server Error',
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result.status).toBe('error');
    expect(result.message).toBe('Failed to fetch query log from AdGuard Home');
  });

  it('should return error when httpRequest fails', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
      }),
    } as unknown as NextRequest;

    mockHttpRequest.mockRejectedValue(new Error('Connection timeout'));

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result.status).toBe('error');
    expect(result.message).toContain('Failed to reach AdGuard Home: Connection timeout');
  });

  it('should handle invalid JSON in request', async () => {
    const mockRequest = {
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.status).toBe('error');
    expect(result.message).toContain('Internal server error: Invalid JSON');
  });

  it('should handle invalid JSON in response', async () => {
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

    expect(response.status).toBe(502);
    expect(result.status).toBe('error');
    expect(result.message).toContain('Failed to reach AdGuard Home');
  });

  it('should work without authentication', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
      }),
    } as unknown as NextRequest;

    const mockQueryLog = { data: [] };

    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(mockQueryLog),
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {}, // No Authorization header
      })
    );
  });

  it('should handle URL with trailing slash', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        url: 'http://adguard.example.com/',
        username: 'admin',
        password: 'password',
      }),
    } as unknown as NextRequest;

    const mockQueryLog = { data: [] };

    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(mockQueryLog),
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://adguard.example.com/control/querylog?limit=100&offset=0&response_status=all',
      })
    );
  });
});
