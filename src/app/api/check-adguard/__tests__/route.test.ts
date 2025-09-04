import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock the logger
jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

// Mock the http and https modules
jest.mock('http', () => ({
  request: jest.fn(),
}));
jest.mock('https', () => ({
  request: jest.fn(),
}));

const mockHttpRequest = require('http').request;
const mockHttpsRequest = require('https').request;

describe('/api/check-adguard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return connected status when AdGuard Home is reachable', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
        username: 'admin',
        password: 'password',
        allowInsecure: false,
      }),
    } as unknown as NextRequest;

    // Mock the http request for status
    const mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn((event: any, callback: any) => {
        if (event === 'error') {
          // Store error callback for later
          (mockReq as any).errorCallback = callback;
        }
      }),
      errorCallback: null as any,
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('{"version": "v0.107.0"}');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    mockHttpRequest.mockImplementation((options: any, callback: any) => {
      // Simulate async behavior
      setTimeout(() => {
        callback(mockRes);
      }, 10);
      return mockReq;
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe('connected');
    expect(result.code).toBe(200);
  }, 10000);

  it('should return error status when AdGuard Home is not reachable', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
      }),
    } as unknown as NextRequest;

    const mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    };

    mockHttpRequest.mockImplementation((options: any, callback: any) => {
      mockReq.on.mock.calls.find(call => call[0] === 'error')[1](new Error('Connection failed'));
      return mockReq;
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result.status).toBe('error');
    expect(result.message).toContain('Failed to reach AdGuard Home');
  });

  it('should handle invalid JSON in request', async () => {
    const mockRequest = {
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.status).toBe('error');
    expect(result.message).toContain('Internal server error');
  });

  it('should successfully fetch status and stats with authentication', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
        username: 'admin',
        password: 'password',
        allowInsecure: false,
      }),
    } as unknown as NextRequest;

    // Mock status request
    const mockStatusReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    };
    const mockStatusRes = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('{"version": "v0.107.0"}');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    // Mock stats request
    const mockStatsReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    };
    const mockStatsRes = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('{"num_dns_queries": 1000, "num_blocked_filtering": 100}');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    let callCount = 0;
    mockHttpRequest.mockImplementation((options: any, callback: any) => {
      // Make synchronous to avoid timeout
      if (options.path.includes('/control/status')) {
        callback(mockStatusRes);
      } else if (options.path.includes('/control/stats')) {
        callback(mockStatsRes);
      }
      return callCount++ === 0 ? mockStatusReq : mockStatsReq;
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe('connected');
    expect(result.code).toBe(200);
    expect(result.response).toBe('{"version": "v0.107.0"}');
    expect(result.stats).toEqual({
      num_dns_queries: 1000,
      num_blocked_filtering: 100,
    });
  });

  it('should handle URL-based connection', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        url: 'http://adguard.example.com:8080',
        allowInsecure: false,
      }),
    } as unknown as NextRequest;

    const mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('{"version": "v0.107.0"}');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    mockHttpRequest.mockImplementation((options: any, callback: any) => {
      // Remove setTimeout to make it synchronous
      callback(mockRes);
      return mockReq;
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe('connected');
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: 'adguard.example.com',
        port: 8080,
        path: '/control/status',
      }),
      expect.any(Function)
    );
  }, 10000);

  it('should handle failed stats retrieval gracefully', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
      }),
    } as unknown as NextRequest;

    // Mock status request success
    const mockStatusReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    };
    const mockStatusRes = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('{"version": "v0.107.0"}');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    // Mock stats request failure
    const mockStatsReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'error') {
          callback(new Error('Stats request failed'));
        }
      }),
    };

    let callCount = 0;
    mockHttpRequest.mockImplementation((options: any, callback: any) => {
      // Make synchronous to avoid timeout
      if (options.path.includes('/control/status')) {
        callback(mockStatusRes);
      }
      return callCount++ === 0 ? mockStatusReq : mockStatsReq;
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe('connected');
    expect(result.code).toBe(200);
    expect(result.stats).toBeNull();
  });

  it('should handle AdGuard Home returning error status', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
      }),
    } as unknown as NextRequest;

    const mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    };
    const mockRes = {
      statusCode: 500,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('Internal server error');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    mockHttpRequest.mockImplementation((options: any, callback: any) => {
      // Make synchronous
      callback(mockRes);
      return mockReq;
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe('error');
    expect(result.code).toBe(500);
    expect(result.response).toBe('Internal server error');
  });

  it('should handle HTTPS requests with allowInsecure flag', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        url: 'https://adguard.example.com',
        allowInsecure: true,
      }),
    } as unknown as NextRequest;

    const mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('{"version": "v0.107.0"}');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    mockHttpsRequest.mockImplementation((options: any, callback: any) => {
      // Make synchronous
      callback(mockRes);
      return mockReq;
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe('connected');
    expect(mockHttpsRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: 'adguard.example.com',
        port: 443,
        rejectUnauthorized: false,
      }),
      expect.any(Function)
    );
  });

  it('should handle custom port configuration', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 8080,
      }),
    } as unknown as NextRequest;

    const mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('{"version": "v0.107.0"}');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    mockHttpRequest.mockImplementation((options: any, callback: any) => {
      // Make synchronous
      callback(mockRes);
      return mockReq;
    });

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe('connected');
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: '192.168.1.1',
        port: 8080,
        path: '/control/status',
      }),
      expect.any(Function)
    );
  });
});
