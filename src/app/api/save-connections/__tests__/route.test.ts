import { POST } from '../route';

// Mock fs and path
jest.mock('fs', () => ({
  promises: {
    stat: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
  },
}));
jest.mock('path', () => ({
  join: jest.fn(),
  dirname: jest.fn(),
}));

const mockFs = require('fs').promises;
const mockPath = require('path');

// Mock process.cwd
Object.defineProperty(process, 'cwd', {
  value: jest.fn(() => '/mock/cwd'),
  writable: true,
});

mockPath.join.mockImplementation((...args: string[]) => {
  if (args[0] === '/mock/cwd' && args[1] === '.data' && args[2] === 'connections.json') {
    return '/mock/cwd/.data/connections.json';
  }
  return args.join('/');
});
mockPath.dirname.mockImplementation((path: string) => {
  if (path === '/mock/cwd/.data/connections.json') {
    return '/mock/cwd/.data';
  }
  return path.split('/').slice(0, -1).join('/');
});

describe('/api/save-connections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.join.mockReturnValue('/mock/path/connections.json');
    mockPath.dirname.mockReturnValue('/mock/path');
  });

  it('should save connections data successfully', async () => {
    const mockData = { connections: [{ ip: '192.168.1.1' }], masterServerIp: '192.168.1.100' };
    const mockRequest = {
      json: jest.fn().mockResolvedValue(mockData),
    } as unknown as Request;

    mockFs.stat.mockResolvedValue({} as any); // Directory exists
    mockFs.writeFile.mockResolvedValue(undefined);

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.message).toBe('Connections saved successfully.');
    expect(mockFs.writeFile).toHaveBeenCalled();
  });

  it('should create directory if it does not exist', async () => {
    const mockData = { connections: [], masterServerIp: null };
    const mockRequest = {
      json: jest.fn().mockResolvedValue(mockData),
    } as unknown as Request;

    const error = new Error('Directory not found') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    mockFs.stat.mockRejectedValueOnce(error); // Directory doesn't exist
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.message).toBe('Connections saved successfully.');
    expect(mockFs.mkdir).toHaveBeenCalledWith('/mock/path', { recursive: true });
  });

  it('should return error when JSON parsing fails', async () => {
    const mockRequest = {
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as unknown as Request;

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.message).toBe('Failed to save connections.');
    expect(result.error).toBe('Invalid JSON');
  });

  it('should return error when writeFile fails', async () => {
    const mockData = { connections: [{ ip: '192.168.1.1' }] };
    const mockRequest = {
      json: jest.fn().mockResolvedValue(mockData),
    } as unknown as Request;

    mockFs.stat.mockResolvedValue({} as any);
    mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.message).toBe('Failed to save connections.');
    expect(result.error).toBe('Write failed');
  });

  it('should return error when directory creation fails with non-ENOENT error', async () => {
    const mockData = { connections: [] };
    const mockRequest = {
      json: jest.fn().mockResolvedValue(mockData),
    } as unknown as Request;

    const error = new Error('Permission denied') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    mockFs.stat.mockRejectedValue(error);

    const response = await POST(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.message).toBe('Failed to save connections.');
    expect(result.error).toBe('Permission denied');
  });
});
