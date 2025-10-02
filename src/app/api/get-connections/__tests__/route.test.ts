import { GET } from '../route';

// Mock logger
jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock fs and path
jest.mock('fs', () => ({
  promises: {
    stat: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));
jest.mock('path', () => ({
  join: jest.fn(),
}));

const mockFs = require('fs').promises;
const mockPath = require('path');

// Mock process.cwd
const originalProcess = process;
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

describe('/api/get-connections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.join.mockReturnValue('/mock/path/connections.json');
  });

  it('should return connections data when file exists', async () => {
    const mockData = { connections: [{ ip: '192.168.1.1' }], masterServerIp: '192.168.1.100' };

    mockFs.stat.mockResolvedValue({} as any);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockData));

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual(mockData);
    expect(mockFs.stat).toHaveBeenCalled();
    expect(mockFs.readFile).toHaveBeenCalled();
  });

  it('should return default empty state when file does not exist', async () => {
    const error = new Error('File not found') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    mockFs.stat.mockRejectedValue(error);

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({ connections: [], masterServerIp: null });
  });

  it('should return error when stat fails with non-ENOENT error', async () => {
    const error = new Error('Permission denied') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    mockFs.stat.mockRejectedValue(error);

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.message).toBe('Failed to read connections file.');
    expect(result.error).toBe('Permission denied');
  });

  it('should return error when JSON parsing fails', async () => {
    mockFs.stat.mockResolvedValue({} as any);
    mockFs.readFile.mockResolvedValue('invalid json');

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.message).toBe('Failed to parse connections data.');
    expect(result.error).toContain('Unexpected token');
  });
});
