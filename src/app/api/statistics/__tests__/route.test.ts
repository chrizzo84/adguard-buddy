import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock the logger
jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Mock NextResponse
jest.mock('next/server', () => {
  const MockNextResponse = class NextResponse {
    status: number;
    body: string;
    headers: any;
    constructor(body: string, init: any = {}) {
      this.status = init.status || 200;
      this.body = body;
      this.headers = init.headers || {};
    }
    json() {
      return Promise.resolve(JSON.parse(this.body));
    }
    static json(data: any, options: any = {}) {
      const body = JSON.stringify(data);
      return new MockNextResponse(body, options);
    }
  };
  return {
    NextRequest: jest.fn(),
    NextResponse: MockNextResponse,
  };
});

// Mock the httpRequest function
jest.mock('../../../lib/httpRequest', () => ({
  httpRequest: jest.fn(),
}));

const { httpRequest } = require('../../../lib/httpRequest');
const mockHttpRequest = httpRequest as jest.MockedFunction<typeof httpRequest>;

describe('/api/statistics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return statistics data when request succeeds', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
        username: 'admin',
        password: 'password',
        allowInsecure: false,
      }),
    } as unknown as NextRequest;

    const mockStats = { num_dns_queries: 100, num_blocked_queries: 10 };
    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(mockStats),
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual(mockStats);
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
    expect(result.message).toBe('Failed to fetch stats from server');
    expect(result.status).toBe('error');
  });

  it('should return error when httpRequest fails', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
      }),
    } as unknown as NextRequest;

    mockHttpRequest.mockRejectedValue(new Error('Connection failed'));

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result.message).toContain('Failed to reach AdGuard Home: Connection failed');
  });

  it('should handle invalid JSON in request', async () => {
    const mockRequest = {
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(500);
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
      body: 'invalid json',
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result.message).toContain('Failed to reach AdGuard Home');
  });

  it('should use URL when provided instead of IP', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        url: 'http://adguard.example.com',
        username: 'admin',
        password: 'password',
      }),
    } as unknown as NextRequest;

    const mockStats = { num_dns_queries: 50 };
    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(mockStats),
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual(mockStats);
    expect(mockHttpRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: 'http://adguard.example.com/control/stats',
      headers: {
        Authorization: 'Basic ' + Buffer.from('admin:password').toString('base64'),
      },
      allowInsecure: false,
    });
  });
});
