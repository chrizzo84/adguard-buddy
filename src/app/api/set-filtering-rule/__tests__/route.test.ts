import { POST } from '../route';
import { promises as fs } from 'fs';
import path from 'path';
import CryptoJS from 'crypto-js';

// Mock fs, path, and crypto
jest.mock('fs', () => ({
  promises: {
    stat: jest.fn(),
    readFile: jest.fn(),
  },
}));
jest.mock('path', () => ({
  join: jest.fn(),
}));
jest.mock('crypto-js', () => ({
  AES: {
    decrypt: jest.fn(),
  },
  enc: {
    Utf8: 'utf8',
  },
}));

// Mock the httpRequest function
jest.mock('../../../lib/httpRequest', () => ({
  httpRequest: jest.fn(),
}));

const mockFs = require('fs').promises;
const mockPath = require('path');
const mockCryptoJS = require('crypto-js');
const { httpRequest } = require('../../../lib/httpRequest');
const mockHttpRequest = httpRequest as jest.MockedFunction<typeof httpRequest>;

describe('/api/set-filtering-rule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.join.mockImplementation((...args: string[]) => {
      if (args[0] === '/mock/cwd' && args[1] === '.data' && args[2] === 'connections.json') {
        return '/mock/cwd/.data/connections.json';
      }
      return args.join('/');
    });

    // Mock process.cwd and environment
    Object.defineProperty(process, 'cwd', {
      value: jest.fn(() => '/mock/cwd'),
      writable: true,
    });
    process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY = 'test-key';
  });

  it('should return 400 when domain is missing', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        action: 'block',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.message).toBe('Domain and action are required.');
  });

  it('should return 400 when action is missing', async () => {
    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.message).toBe('Domain and action are required.');
  });

  it('should process blocking rule successfully', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
          allowInsecure: false,
        },
      ],
      masterServerIp: null,
    };

    mockFs.stat.mockResolvedValue({} as any);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockConnections));
    mockCryptoJS.AES.decrypt.mockReturnValue({
      toString: jest.fn().mockReturnValue('decrypted-password'),
    });
    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify({ success: true }),
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
        action: 'block',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: JSON.stringify({ rules: ['||example.com^'] }),
      })
    );
  });

  it('should process allow rule successfully', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
          allowInsecure: false,
        },
      ],
      masterServerIp: null,
    };

    mockFs.stat.mockResolvedValue({} as any);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockConnections));
    mockCryptoJS.AES.decrypt.mockReturnValue({
      toString: jest.fn().mockReturnValue('decrypted-password'),
    });
    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify({ success: true }),
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
        action: 'allow',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: JSON.stringify({ rules: ['@@||example.com^'] }),
      })
    );
  });

  it('should handle multiple connections', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin1',
          password: 'encrypted-password1',
          allowInsecure: false,
        },
        {
          ip: '192.168.1.2',
          port: 80,
          username: 'admin2',
          password: 'encrypted-password2',
          allowInsecure: true,
        },
      ],
      masterServerIp: null,
    };

    mockFs.stat.mockResolvedValue({} as any);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockConnections));
    mockCryptoJS.AES.decrypt.mockReturnValue({
      toString: jest.fn().mockReturnValue('decrypted-password'),
    });
    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify({ success: true }),
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
        action: 'block',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    expect(mockHttpRequest).toHaveBeenCalledTimes(2);
  });

  it('should handle connection failures gracefully', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
          allowInsecure: false,
        },
      ],
      masterServerIp: null,
    };

    mockFs.stat.mockResolvedValue({} as any);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockConnections));
    mockCryptoJS.AES.decrypt.mockReturnValue({
      toString: jest.fn().mockReturnValue('decrypted-password'),
    });
    mockHttpRequest.mockRejectedValue(new Error('Connection failed'));

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
        action: 'block',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    // Should still return SSE response even with failures
  });

  it('should handle decryption failures', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
          allowInsecure: false,
        },
      ],
      masterServerIp: null,
    };

    mockFs.stat.mockResolvedValue({} as any);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockConnections));
    mockCryptoJS.AES.decrypt.mockReturnValue({
      toString: jest.fn().mockReturnValue(''), // Empty string = decryption failed
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
        action: 'block',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    // Should handle decryption failure gracefully
  });

  it('should handle missing connections file', async () => {
    const error = new Error('File not found') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    mockFs.stat.mockRejectedValue(error);

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
        action: 'block',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    // Should handle empty connections gracefully
  });

  it('should handle connections with URLs', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
          url: 'http://adguard.example.com',
          allowInsecure: false,
        },
      ],
      masterServerIp: null,
    };

    mockFs.stat.mockResolvedValue({} as any);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockConnections));
    mockCryptoJS.AES.decrypt.mockReturnValue({
      toString: jest.fn().mockReturnValue('decrypted-password'),
    });
    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify({ success: true }),
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
        action: 'block',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://adguard.example.com/control/filtering/set_rules',
      })
    );
  });

  it('should handle non-ENOENT file system errors', async () => {
    const error = new Error('Permission denied') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    mockFs.stat.mockRejectedValue(error);

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
        action: 'block',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    // Should handle file system errors gracefully by returning empty connections
  });

  it('should handle AdGuard API error with JSON response', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
          allowInsecure: false,
        },
      ],
      masterServerIp: null,
    };

    mockFs.stat.mockResolvedValue({} as any);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockConnections));
    mockCryptoJS.AES.decrypt.mockReturnValue({
      toString: jest.fn().mockReturnValue('decrypted-password'),
    });
    mockHttpRequest.mockResolvedValue({
      statusCode: 400,
      headers: {},
      body: JSON.stringify({ message: 'Invalid rule format' }),
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
        action: 'block',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    // Should continue processing other connections even if one fails
  });

  it('should handle AdGuard API error without JSON response', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
          allowInsecure: false,
        },
      ],
      masterServerIp: null,
    };

    mockFs.stat.mockResolvedValue({} as any);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockConnections));
    mockCryptoJS.AES.decrypt.mockReturnValue({
      toString: jest.fn().mockReturnValue('decrypted-password'),
    });
    
    // Mock httpRequest to return a response that will fail JSON parsing
    const mockResponse = {
      statusCode: 500,
      headers: {},
      body: '<html>Internal Server Error</html>', // HTML response that can't be parsed as JSON
    };
    mockHttpRequest.mockResolvedValue(mockResponse);

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
        action: 'block',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    // Should handle non-JSON error responses gracefully
  });

  it('should handle AdGuard API error with different status codes', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
          allowInsecure: false,
        },
      ],
      masterServerIp: null,
    };

    mockFs.stat.mockResolvedValue({} as any);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockConnections));
    mockCryptoJS.AES.decrypt.mockReturnValue({
      toString: jest.fn().mockReturnValue('decrypted-password'),
    });
    
    // Mock httpRequest to return a 404 error (not 500)
    const mockResponse = {
      statusCode: 404,
      headers: {},
      body: JSON.stringify({ message: 'Not found' }),
    };
    mockHttpRequest.mockResolvedValue(mockResponse);

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
        action: 'block',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    // Should handle different error status codes
  });

  it('should handle connections with allowInsecure enabled', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
          allowInsecure: true, // Test with allowInsecure: true
        },
      ],
      masterServerIp: null,
    };

    mockFs.stat.mockResolvedValue({} as any);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockConnections));
    mockCryptoJS.AES.decrypt.mockReturnValue({
      toString: jest.fn().mockReturnValue('decrypted-password'),
    });
    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify({ success: true }),
    });

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
        action: 'block',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        allowInsecure: true,
      })
    );
  });

  it('should handle malformed connections file', async () => {
    mockFs.stat.mockResolvedValue({} as any);
    mockFs.readFile.mockResolvedValue('invalid json content');

    const mockRequest = {
      json: jest.fn().mockResolvedValue({
        domain: 'example.com',
        action: 'block',
      }),
    } as unknown as Request;

    const response = await POST(mockRequest);

    expect(response.status).toBe(200);
    // Should handle JSON parse errors gracefully
  });
});
