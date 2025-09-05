import '@testing-library/jest-dom'

// Mock console methods to reduce noise in test output for expected errors
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn((...args) => {
    // Only suppress specific expected error messages during tests
    const message = args.join(' ');
    if (message.includes('Sync for category') && message.includes('is not yet implemented')) {
      return; // Suppress expected unimplemented category errors
    }
    if (message.includes('Error reading or hashing docs/News.md')) {
      return; // Suppress expected file not found errors
    }
    if (message.includes('Stream Error:')) {
      return; // Suppress stream error logs
    }
    if (message.includes('Error serving news image:')) {
      return; // Suppress expected news image serving errors (file not found, permission denied, etc.)
    }
    if (message.includes('Error reading connections file:')) {
      return; // Suppress expected connections file reading errors (permission denied, malformed JSON, etc.)
    }
    if (message.includes('Failed to check for news')) {
      return; // Suppress expected news fetching errors in tests
    }
    // For all other errors, use the original console.error
    originalConsoleError.apply(console, args);
  });
  
  console.warn = jest.fn((...args) => {
    // Suppress expected warnings if any
    const message = args.join(' ');
    if (message.includes('expected warning')) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  });
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Mock NextRequest and NextResponse for API route testing
jest.mock('next/server', () => {
  const MockNextResponse = class NextResponse {
    constructor(body, init = {}) {
      this.status = init.status || 200;
      this.body = body;
      this._headers = new Map();
      if (init.headers) {
        Object.entries(init.headers).forEach(([key, value]) => {
          this._headers.set(key, value);
        });
      }
    }
    json() {
      // Only try to parse as JSON if body is a string
      if (typeof this.body === 'string') {
        return Promise.resolve(JSON.parse(this.body));
      }
      // For binary bodies, this should not be called
      throw new Error('Cannot call json() on binary response');
    }
    get headers() {
      return {
        get: (key) => this._headers.get(key),
      };
    }
  };
  MockNextResponse.json = (data, options = {}) => {
    const body = JSON.stringify(data);
    return new MockNextResponse(body, options);
  };
  return {
    NextRequest: jest.fn(),
    NextResponse: MockNextResponse,
  };
});

// Polyfills for Web APIs
global.ReadableStream = class ReadableStream {
  constructor(options) {
    this.options = options;
    // Execute the start method immediately for testing
    if (options && options.start) {
      const mockController = {
        enqueue: jest.fn(),
        close: jest.fn(),
      };
      options.start(mockController);
    }
  }
};

global.TextEncoder = class TextEncoder {
  encode(str) {
    return Buffer.from(str, 'utf-8');
  }
};

global.TextDecoder = class TextDecoder {
  decode(buffer) {
    return buffer.toString('utf-8');
  }
};

global.Response = class Response {
  constructor(body, init = {}) {
    this.status = init.status || 200;
    this.statusText = init.statusText || '';
    this._headers = new Map();
    this.body = body || '';
    if (init.headers) {
      Object.entries(init.headers).forEach(([key, value]) => {
        this._headers.set(key, value);
      });
    }
  }

  json() {
    return Promise.resolve(JSON.parse(this.body));
  }

  text() {
    return Promise.resolve(this.body);
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }

  getHeaders() {
    return this._headers;
  }

  get headers() {
    return {
      get: (key) => this._headers.get(key),
    };
  }
};
