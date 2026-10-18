import { GET } from '../route';
import { resolveAllConnections } from '@/lib/serverConnections';

jest.mock('@/lib/serverConnections', () => ({
  ...jest.requireActual('@/lib/serverConnections'),
  resolveAllConnections: jest.fn(),
}));

jest.mock('../../../logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/lib/httpRequest', () => ({ httpRequest: jest.fn() }));

const { httpRequest } = require('@/lib/httpRequest');
const mockHttpRequest = httpRequest as jest.MockedFunction<typeof httpRequest>;
const mockResolveAll = resolveAllConnections as jest.MockedFunction<typeof resolveAllConnections>;

/** Connections come back from the store already decrypted. */
const resolved = (store: { connections: Array<Record<string, unknown>> }) =>
  store.connections.map((conn) => ({ ...conn, password: 'decrypted-password' }));

describe('/api/statistics/combined', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return combined statistics successfully', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password1',
          allowInsecure: false,
        },
        {
          ip: '192.168.1.2',
          port: 80,
          username: 'admin',
          password: 'encrypted-password2',
          allowInsecure: false,
        },
      ],
    };

    const mockStats1 = {
      avg_processing_time: 10,
      num_dns_queries: 1000,
      top_queried_domains: [{ 'google.com': 100 }, { 'youtube.com': 80 }],
      top_blocked_domains: [{ 'ads.example.com': 50 }],
      top_clients: [{ '192.168.1.100': 200 }],
      top_upstreams_responses: [{ '8.8.8.8': 500 }],
      top_upstreams_avg_time: [{ '8.8.8.8': 15 }],
    };

    const mockStats2 = {
      avg_processing_time: 12,
      num_dns_queries: 800,
      top_queried_domains: [{ 'google.com': 80 }, { 'facebook.com': 70 }],
      top_blocked_domains: [{ 'ads.example.com': 30 }],
      top_clients: [{ '192.168.1.101': 150 }],
      top_upstreams_responses: [{ '8.8.8.8': 400 }],
      top_upstreams_avg_time: [{ '8.8.8.8': 18 }],
    };

    mockResolveAll.mockResolvedValue(resolved(mockConnections) as never);

    mockHttpRequest.mockImplementation((opts: any) => {
      if (opts.url.includes('192.168.1.1')) {
        return Promise.resolve({
          statusCode: 200,
          headers: {},
          body: JSON.stringify(mockStats1),
        });
      } else if (opts.url.includes('192.168.1.2')) {
        return Promise.resolve({
          statusCode: 200,
          headers: {},
          body: JSON.stringify(mockStats2),
        });
      }
      return Promise.reject(new Error('Unknown server'));
    });

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.dns_queries).toBe(1800); // 1000 + 800
    expect(result.avg_processing_time).toBeCloseTo(10.89, 1); // Weighted average
    expect(result.top_queried_domains).toHaveLength(3);
    expect(result.top_blocked_domains).toHaveLength(1);
    expect(result.top_clients).toHaveLength(2);
  });

  it('should handle connections with URLs', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          url: 'http://adguard1.example.com',
          username: 'admin',
          password: 'encrypted-password',
          allowInsecure: false,
        },
      ],
    };

    const mockStats = {
      avg_processing_time: 10,
      num_dns_queries: 1000,
      top_queried_domains: [],
      top_blocked_domains: [],
      top_clients: [],
      top_upstreams_responses: [],
      top_upstreams_avg_time: [],
    };

    mockResolveAll.mockResolvedValue(resolved(mockConnections) as never);

    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(mockStats),
    });

    await GET();

    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://adguard1.example.com/control/stats',
        headers: expect.objectContaining({
          Authorization: expect.any(String),
        }),
      })
    );
  });

  it('should handle connections without authentication', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
        },
      ],
    };

    const mockStats = {
      avg_processing_time: 10,
      num_dns_queries: 1000,
      top_queried_domains: [],
      top_blocked_domains: [],
      top_clients: [],
      top_upstreams_responses: [],
      top_upstreams_avg_time: [],
    };

    mockResolveAll.mockResolvedValue(resolved(mockConnections) as never);

    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(mockStats),
    });

    await GET();

    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {},
      })
    );
  });

  it('should return 404 when no connections configured', async () => {
    const mockConnections = {
      connections: [],
    };

    mockResolveAll.mockResolvedValue(resolved(mockConnections) as never);

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.message).toBe('No connections configured.');
  });

  it('should return 502 when cannot fetch from any server', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
        },
      ],
    };

    mockResolveAll.mockResolvedValue(resolved(mockConnections) as never);

    mockHttpRequest.mockResolvedValue({
      statusCode: 500,
      headers: {},
      body: 'Internal Server Error',
    });

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result.message).toBe('Could not fetch stats from any server.');
  });

  it('should handle a missing connections file', async () => {
    // readMigratedStore resolves to an empty store when the file is absent.
    mockResolveAll.mockResolvedValue([]);

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.message).toBe('No connections configured.');
  });

  it('still aggregates when a stored password could not be decrypted', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
        },
      ],
    };

    const mockStats = {
      avg_processing_time: 10,
      num_dns_queries: 1000,
      top_queried_domains: [],
      top_blocked_domains: [],
      top_clients: [],
      top_upstreams_responses: [],
      top_upstreams_avg_time: [],
    };

    mockResolveAll.mockResolvedValue(
      mockConnections.connections.map((conn) => ({ ...conn, password: '' })) as never,
    );

    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(mockStats),
    });

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.dns_queries).toBe(1000);
  });

  it('should handle partial server failures', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password1',
        },
        {
          ip: '192.168.1.2',
          port: 80,
          username: 'admin',
          password: 'encrypted-password2',
        },
      ],
    };

    const mockStats = {
      avg_processing_time: 10,
      num_dns_queries: 1000,
      top_queried_domains: [{ 'google.com': 100 }],
      top_blocked_domains: [],
      top_clients: [],
      top_upstreams_responses: [],
      top_upstreams_avg_time: [],
    };

    mockResolveAll.mockResolvedValue(resolved(mockConnections) as never);

    mockHttpRequest.mockImplementation((opts: any) => {
      if (opts.url.includes('192.168.1.1')) {
        return Promise.resolve({
          statusCode: 200,
          headers: {},
          body: JSON.stringify(mockStats),
        });
      } else {
        return Promise.resolve({
          statusCode: 500,
          headers: {},
          body: 'Server Error',
        });
      }
    });

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.dns_queries).toBe(1000); // Only from the working server
  });

  it('should handle network errors gracefully', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
        },
      ],
    };

    mockResolveAll.mockResolvedValue(resolved(mockConnections) as never);

    mockHttpRequest.mockRejectedValue(new Error('Network timeout'));

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result.message).toBe('Could not fetch stats from any server.');
  });

  it('should handle invalid JSON in server responses', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
        },
      ],
    };

    mockResolveAll.mockResolvedValue(resolved(mockConnections) as never);

    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: 'invalid json response',
    });

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result.message).toBe('Could not fetch stats from any server.');
  });

  it('should aggregate top lists correctly', async () => {
    const mockConnections = {
      connections: [
        {
          ip: '192.168.1.1',
          port: 80,
          username: 'admin',
          password: 'encrypted-password',
        },
      ],
    };

    const mockStats = {
      avg_processing_time: 10,
      num_dns_queries: 100,
      top_queried_domains: [
        { 'google.com': 50 },
        { 'youtube.com': 30 },
        { 'facebook.com': 20 },
      ],
      top_blocked_domains: [
        { 'ads1.com': 25 },
        { 'ads2.com': 15 },
      ],
      top_clients: [
        { '192.168.1.100': 40 },
        { '192.168.1.101': 30 },
      ],
      top_upstreams_responses: [
        { '8.8.8.8': 60 },
        { '1.1.1.1': 40 },
      ],
      top_upstreams_avg_time: [
        { '8.8.8.8': 15 },
        { '1.1.1.1': 20 },
      ],
    };

    mockResolveAll.mockResolvedValue(resolved(mockConnections) as never);

    mockHttpRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: JSON.stringify(mockStats),
    });

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.top_queried_domains).toHaveLength(3);
    expect(result.top_blocked_domains).toHaveLength(2);
    expect(result.top_clients).toHaveLength(2);
    expect(result.top_upstreams_responses).toHaveLength(2);
    expect(result.top_upstreams_avg_time).toHaveLength(2);

    // Check that domains are sorted by count (descending)
    expect(result.top_queried_domains[0]).toEqual({ 'google.com': 50 });
    expect(result.top_queried_domains[1]).toEqual({ 'youtube.com': 30 });
    expect(result.top_queried_domains[2]).toEqual({ 'facebook.com': 20 });
  });

  describe('time units', () => {
    const twoServers = { connections: [{ ip: '192.168.1.1', port: 80 }, { ip: '192.168.1.2', port: 80 }] };

    function serve(stats1: Record<string, unknown>, stats2: Record<string, unknown>) {
      mockResolveAll.mockResolvedValue(resolved(twoServers) as never);
      mockHttpRequest.mockImplementation((opts: any) => Promise.resolve({
        statusCode: 200,
        headers: {},
        body: JSON.stringify(opts.url.includes('192.168.1.1') ? stats1 : stats2),
      }));
    }

    it('reports days when every server keeps daily buckets', async () => {
      serve(
        { time_units: 'days', dns_queries: [1, 2, 3] },
        { time_units: 'days', dns_queries: [10, 20] },
      );

      const result = await (await GET()).json();

      expect(result.time_units).toBe('days');
      expect(result.dns_queries_arr).toEqual([1, 12, 23]);
    });

    it('keeps hours when every server reports hourly buckets', async () => {
      serve(
        { time_units: 'hours', dns_queries: [1, 2] },
        { time_units: 'hours', dns_queries: [3, 4] },
      );

      const result = await (await GET()).json();

      expect(result.time_units).toBe('hours');
      expect(result.dns_queries_arr).toEqual([4, 6]);
    });

    it('rolls hourly servers up into days when units are mixed', async () => {
      serve(
        { time_units: 'hours', dns_queries: new Array(24).fill(1), blocked_filtering: new Array(24).fill(1) },
        { time_units: 'days', dns_queries: [100, 200], blocked_filtering: [10, 20] },
      );

      const result = await (await GET()).json();

      expect(result.time_units).toBe('days');
      expect(result.dns_queries_arr).toEqual([100, 224]);
      expect(result.blocked_filtering_arr).toEqual([10, 44]);
    });
  });
});
