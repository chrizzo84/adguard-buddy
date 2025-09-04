import { GET } from '../route';
import { promises as fs } from 'fs';

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;

describe('/api/news-img', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should serve PNG image successfully', async () => {
    const mockImageBuffer = Buffer.from('fake png data');
    mockReadFile.mockResolvedValue(mockImageBuffer);

    const mockRequest = {
      url: 'http://localhost/api/news-img?name=test.png',
    } as Request;

    const response = await GET(mockRequest);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(mockReadFile).toHaveBeenCalledWith('/Users/chrizzo/Documents/GitHub/adguard-buddy/pics/test.png');
    // Don't try to call .json() on binary response
  });

  it('should serve JPEG image successfully', async () => {
    const mockImageBuffer = Buffer.from('fake jpeg data');
    mockReadFile.mockResolvedValue(mockImageBuffer);

    const mockRequest = {
      url: 'http://localhost/api/news-img?name=photo.jpg',
    } as Request;

    const response = await GET(mockRequest);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(mockReadFile).toHaveBeenCalledWith('/Users/chrizzo/Documents/GitHub/adguard-buddy/pics/photo.jpg');
  });

  it('should serve SVG image successfully', async () => {
    const mockImageBuffer = Buffer.from('<svg></svg>');
    mockReadFile.mockResolvedValue(mockImageBuffer);

    const mockRequest = {
      url: 'http://localhost/api/news-img?name=icon.svg',
    } as Request;

    const response = await GET(mockRequest);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
  });

  it('should serve GIF image successfully', async () => {
    const mockImageBuffer = Buffer.from('fake gif data');
    mockReadFile.mockResolvedValue(mockImageBuffer);

    const mockRequest = {
      url: 'http://localhost/api/news-img?name=animation.gif',
    } as Request;

    const response = await GET(mockRequest);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/gif');
  });

  it('should serve unknown file type as octet-stream', async () => {
    const mockImageBuffer = Buffer.from('unknown file data');
    mockReadFile.mockResolvedValue(mockImageBuffer);

    const mockRequest = {
      url: 'http://localhost/api/news-img?name=document.xyz',
    } as Request;

    const response = await GET(mockRequest);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
  });

  it('should return 400 for missing name parameter', async () => {
    const mockRequest = {
      url: 'http://localhost/api/news-img',
    } as Request;

    const response = await GET(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid or missing name parameter');
  });

  it('should return 400 for invalid name parameter', async () => {
    const mockRequest = {
      url: 'http://localhost/api/news-img?name=../../../etc/passwd',
    } as Request;

    const response = await GET(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid or missing name parameter');
  });

  it('should return 400 for name with invalid characters', async () => {
    const mockRequest = {
      url: 'http://localhost/api/news-img?name=test<script>.png',
    } as Request;

    const response = await GET(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid or missing name parameter');
  });

  it('should return 404 when image file not found', async () => {
    const error = new Error('File not found') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    mockReadFile.mockRejectedValue(error);

    const mockRequest = {
      url: 'http://localhost/api/news-img?name=missing.png',
    } as Request;

    const response = await GET(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.error).toBe('Image not found');
  });

  it('should return 404 for other file system errors', async () => {
    mockReadFile.mockRejectedValue(new Error('Permission denied'));

    const mockRequest = {
      url: 'http://localhost/api/news-img?name=protected.png',
    } as Request;

    const response = await GET(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.error).toBe('Image not found');
  });

  it('should handle empty name parameter', async () => {
    const mockRequest = {
      url: 'http://localhost/api/news-img?name=',
    } as Request;

    const response = await GET(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid or missing name parameter');
  });

  it('should handle name with only dots', async () => {
    const mockRequest = {
      url: 'http://localhost/api/news-img?name=...',
    } as Request;

    const response = await GET(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.error).toBe('Image not found');
  });

  it('should handle name with spaces', async () => {
    const mockRequest = {
      url: 'http://localhost/api/news-img?name=test image.png',
    } as Request;

    const response = await GET(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid or missing name parameter');
  });

  it('should handle name with special characters', async () => {
    const mockRequest = {
      url: 'http://localhost/api/news-img?name=test@#$%.png',
    } as Request;

    const response = await GET(mockRequest);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid or missing name parameter');
  });
});
