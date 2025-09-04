import { GET } from '../route';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// Mock fs, path, and crypto
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));
jest.mock('path', () => ({
  join: jest.fn(),
}));
jest.mock('crypto', () => ({
  createHash: jest.fn(),
}));

const mockFs = require('fs').promises;
const mockPath = require('path');
const mockCrypto = require('crypto');

describe('/api/news', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.join.mockImplementation((...args: string[]) => {
      if (args[0] === '/mock/cwd' && args[1] === 'docs/News.md') {
        return '/mock/cwd/docs/News.md';
      }
      return args.join('/');
    });

    // Mock process.cwd
    Object.defineProperty(process, 'cwd', {
      value: jest.fn(() => '/mock/cwd'),
      writable: true,
    });
  });

  it('should return news content with hash when file exists', async () => {
    const mockContent = '# News Title\n\nSome news content here.';
    const mockHash = 'mocked-hash-value';

    mockFs.readFile.mockResolvedValue(mockContent);

    const mockHashInstance = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue(mockHash),
    };
    mockCrypto.createHash.mockReturnValue(mockHashInstance);

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({
      hash: mockHash,
      content: mockContent,
    });
    expect(mockFs.readFile).toHaveBeenCalledWith('/mock/cwd/docs/News.md', 'utf-8');
    expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
    expect(mockHashInstance.update).toHaveBeenCalledWith(mockContent);
    expect(mockHashInstance.digest).toHaveBeenCalledWith('hex');
  });

  it('should return error when file read fails', async () => {
    const error = new Error('File not found');
    mockFs.readFile.mockRejectedValue(error);

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result).toEqual({
      error: 'Could not retrieve news content.',
    });
  });

  it('should handle empty file content', async () => {
    const mockContent = '';
    const mockHash = 'empty-hash';

    mockFs.readFile.mockResolvedValue(mockContent);

    const mockHashInstance = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue(mockHash),
    };
    mockCrypto.createHash.mockReturnValue(mockHashInstance);

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({
      hash: mockHash,
      content: mockContent,
    });
  });
});
