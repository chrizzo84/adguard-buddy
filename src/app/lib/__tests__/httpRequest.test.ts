import { httpRequest } from '../httpRequest';
import http from 'http';
import https from 'https';

// Mock the http and https modules
jest.mock('http');
jest.mock('https');

const mockHttp = http as jest.Mocked<typeof http>;
const mockHttps = https as jest.Mocked<typeof https>;

describe('httpRequest (app version)', () => {
  let mockRequest: jest.Mocked<http.ClientRequest>;
  let mockResponse: jest.Mocked<http.IncomingMessage>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock response with proper event handling
    const responseOnMock = jest.fn().mockImplementation((event: string | symbol, callback: (...args: any[]) => void) => {
      if (event === 'data') {
        // Default behavior - will be overridden in specific tests
        setTimeout(() => callback('test response'), 0);
      }
      if (event === 'end') {
        setTimeout(() => callback(), 0);
      }
      return mockResponse;
    });

    mockResponse = {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      setEncoding: jest.fn(),
      on: responseOnMock,
    } as unknown as jest.Mocked<http.IncomingMessage>;

    // Setup mock request with proper event handling
    const requestOnMock = jest.fn().mockImplementation((event: string | symbol, callback: (...args: any[]) => void) => {
      // Default - no error
      return mockRequest;
    });

    mockRequest = {
      write: jest.fn(),
      end: jest.fn(),
      on: requestOnMock,
    } as unknown as jest.Mocked<http.ClientRequest>;

    // Mock the request method for both http and https
    mockHttp.request = jest.fn().mockImplementation((options, callback) => {
      if (callback) callback(mockResponse);
      return mockRequest;
    });
    mockHttps.request = jest.fn().mockImplementation((options, callback) => {
      if (callback) callback(mockResponse);
      return mockRequest;
    });
  });

  it('should make a GET request to HTTP URL', async () => {
    const result = await httpRequest({
      method: 'GET',
      url: 'http://example.com/api/test',
    });

    expect(mockHttp.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 80,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));

    expect(result).toEqual({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: 'test response',
    });
  });

  it('should make a GET request to HTTPS URL', async () => {
    const result = await httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test',
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 443,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));

    expect(result).toEqual({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: 'test response',
    });
  });

  it('should make a POST request with body', async () => {
    const result = await httpRequest({
      method: 'POST',
      url: 'https://example.com/api/test',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name": "test"}',
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'POST',
      hostname: 'example.com',
      port: 443,
      path: '/api/test',
      headers: { 'Content-Type': 'application/json' },
    }, expect.any(Function));

    expect(mockRequest.write).toHaveBeenCalledWith('{"name": "test"}');
    expect(mockRequest.end).toHaveBeenCalled();

    expect(result).toEqual({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: 'test response',
    });
  });

  it('should handle custom port', async () => {
    const result = await httpRequest({
      method: 'GET',
      url: 'http://example.com:8080/api/test',
    });

    expect(mockHttp.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 8080,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));
  });

  it('should handle query parameters', async () => {
    const result = await httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test?param1=value1&param2=value2',
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 443,
      path: '/api/test?param1=value1&param2=value2',
      headers: {},
    }, expect.any(Function));
  });

  it('should handle allowInsecure for HTTPS', async () => {
    const result = await httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test',
      allowInsecure: true,
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 443,
      path: '/api/test',
      headers: {},
      rejectUnauthorized: false,
    }, expect.any(Function));
  });

  it('should not set rejectUnauthorized for HTTP with allowInsecure', async () => {
    const result = await httpRequest({
      method: 'GET',
      url: 'http://example.com/api/test',
      allowInsecure: true,
    });

    expect(mockHttp.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 80,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));
  });

  it('should handle PUT method', async () => {
    const result = await httpRequest({
      method: 'PUT',
      url: 'https://example.com/api/test',
      body: 'updated data',
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'PUT',
      hostname: 'example.com',
      port: 443,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));

    expect(mockRequest.write).toHaveBeenCalledWith('updated data');
  });

  it('should handle DELETE method', async () => {
    const result = await httpRequest({
      method: 'DELETE',
      url: 'https://example.com/api/test',
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'DELETE',
      hostname: 'example.com',
      port: 443,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));

    expect(mockRequest.write).not.toHaveBeenCalled();
  });

  it('should handle multiple data chunks', async () => {
    // Override the default behavior for this test
    mockResponse.on.mockClear();
    mockResponse.on.mockImplementation((event: string | symbol, callback: (...args: any[]) => void) => {
      if (event === 'data') {
        setTimeout(() => {
          callback('chunk1');
          callback('chunk2');
          callback('chunk3');
        }, 0);
      }
      if (event === 'end') {
        setTimeout(() => callback(), 0);
      }
      return mockResponse;
    });

    const result = await httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test',
    });

    expect(result.body).toBe('chunk1chunk2chunk3');
  });

  it('should handle request error', async () => {
    const networkError = new Error('Network connection failed');

    // Override the mock request for this specific test
    mockRequest.on.mockClear();
    mockRequest.on.mockImplementation((event: string | symbol, callback: (...args: any[]) => void) => {
      if (event === 'error') {
        setTimeout(() => callback(networkError), 0);
      }
      return mockRequest;
    });

    // Override the mock response to not emit data/end events
    mockResponse.on.mockClear();
    mockResponse.on.mockImplementation((event: string | symbol, callback: (...args: any[]) => void) => {
      // Don't emit data or end events for error case
      return mockResponse;
    });

    await expect(httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test',
    })).rejects.toThrow('Network connection failed');
  });

  it('should handle malformed URL', async () => {
    await expect(httpRequest({
      method: 'GET',
      url: 'not-a-valid-url',
    })).rejects.toThrow();
  });

  it('should handle null body', async () => {
    const result = await httpRequest({
      method: 'POST',
      url: 'https://example.com/api/test',
      body: null,
    });

    expect(mockRequest.write).not.toHaveBeenCalled();
    expect(mockRequest.end).toHaveBeenCalled();
  });

  it('should handle empty body', async () => {
    const result = await httpRequest({
      method: 'POST',
      url: 'https://example.com/api/test',
      body: '',
    });

    expect(mockRequest.write).not.toHaveBeenCalled();
    expect(mockRequest.end).toHaveBeenCalled();
  });

  it('should handle missing status code', async () => {
    mockResponse.statusCode = undefined;
    const result = await httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test',
    });

    expect(result.statusCode).toBe(0);
  });

  it('should handle empty headers', async () => {
    const result = await httpRequest({
      method: 'GET',
      url: 'https://example.com/api/test',
      headers: {},
    });

    expect(mockHttps.request).toHaveBeenCalledWith({
      method: 'GET',
      hostname: 'example.com',
      port: 443,
      path: '/api/test',
      headers: {},
    }, expect.any(Function));
  });
});
