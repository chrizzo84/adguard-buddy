import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock the logger
jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Mock http and https modules
jest.mock('http', () => ({
  request: jest.fn(),
}));
jest.mock('https', () => ({
  request: jest.fn(),
}));

const mockHttpRequest = require('http').request as jest.MockedFunction<any>;
const mockHttpsRequest = require('https').request as jest.MockedFunction<any>;

describe('/api/adguard-control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('should handle missing required fields', async () => {
    // Mock the request to simulate network failure
    const mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'error') {
          // Immediately call the error callback
          setImmediate(() => callback(new Error('Network error')));
        }
      }),
    };
    mockHttpRequest.mockReturnValue(mockReq);

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        // missing protection_enabled
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(502); // Network error returns 502
    expect(result.status).toBe('error');
    expect(result.message).toContain('Failed to reach AdGuard Home');
  });

  it('should successfully update protection status with IP', async () => {
    const mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn((event: any, callback: any) => {
        if (event === 'error') {
          (mockReq as any).errorCallback = callback;
        }
      }),
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('{"protection_enabled": true}');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    mockHttpRequest.mockImplementation((options: any, callback: any) => {
      setTimeout(() => {
        callback(mockRes);
      }, 10);
      return mockReq;
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 80,
        protection_enabled: true,
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe('success');
    expect(result.message).toBe('Protection status updated successfully.');
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        hostname: '192.168.1.1',
        port: 80,
        path: '/control/dns_config',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
      expect.any(Function)
    );
  });

  it('should successfully update protection status with URL', async () => {
    const mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn((event: any, callback: any) => {
        if (event === 'error') {
          (mockReq as any).errorCallback = callback;
        }
      }),
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('{"protection_enabled": false}');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    mockHttpRequest.mockImplementation((options: any, callback: any) => {
      setTimeout(() => {
        callback(mockRes);
      }, 10);
      return mockReq;
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        url: 'http://adguard.example.com:8080',
        protection_enabled: false,
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe('success');
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: 'adguard.example.com',
        port: 8080,
        path: '/control/dns_config',
      }),
      expect.any(Function)
    );
  });

  it('should handle authentication with username and password', async () => {
    const mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn((event: any, callback: any) => {
        if (event === 'error') {
          (mockReq as any).errorCallback = callback;
        }
      }),
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('{"protection_enabled": true}');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    mockHttpRequest.mockImplementation((options: any, callback: any) => {
      setTimeout(() => {
        callback(mockRes);
      }, 10);
      return mockReq;
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        username: 'admin',
        password: 'secret',
        protection_enabled: true,
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe('success');
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from('admin:secret').toString('base64'),
        }),
      }),
      expect.any(Function)
    );
  });

  it('should handle AdGuard Home error response', async () => {
    const mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn((event: any, callback: any) => {
        if (event === 'error') {
          (mockReq as any).errorCallback = callback;
        }
      }),
    };
    const mockRes = {
      statusCode: 400,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('Invalid request parameters');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    mockHttpRequest.mockImplementation((options: any, callback: any) => {
      setTimeout(() => {
        callback(mockRes);
      }, 10);
      return mockReq;
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        protection_enabled: true,
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.status).toBe('error');
    expect(result.message).toContain('Failed to update AdGuard Home protection status');
  });

  it('should handle HTTPS requests with allowInsecure flag', async () => {
    const mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn((event: any, callback: any) => {
        if (event === 'error') {
          (mockReq as any).errorCallback = callback;
        }
      }),
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('{"protection_enabled": true}');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    mockHttpsRequest.mockImplementation((options: any, callback: any) => {
      setTimeout(() => {
        callback(mockRes);
      }, 10);
      return mockReq;
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        url: 'https://adguard.example.com',
        protection_enabled: true,
        allowInsecure: true,
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe('success');
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
    const mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn((event: any, callback: any) => {
        if (event === 'error') {
          (mockReq as any).errorCallback = callback;
        }
      }),
    };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('{"protection_enabled": true}');
        } else if (event === 'end') {
          callback();
        }
      }),
    };

    mockHttpRequest.mockImplementation((options: any, callback: any) => {
      setTimeout(() => {
        callback(mockRes);
      }, 10);
      return mockReq;
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        ip: '192.168.1.1',
        port: 8080,
        protection_enabled: true,
      }),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe('success');
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: '192.168.1.1',
        port: 8080,
      }),
      expect.any(Function)
    );
  });
});