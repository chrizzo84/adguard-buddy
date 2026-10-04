import { POST } from '../route';
import { httpRequest } from '@/lib/httpRequest';
import { resolveConnection } from '@/lib/serverConnections';

jest.mock('@/lib/httpRequest');
jest.mock('@/lib/serverConnections', () => ({
  ...jest.requireActual('@/lib/serverConnections'),
  resolveConnection: jest.fn(),
}));
jest.mock('../../logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockHttpRequest = httpRequest as jest.MockedFunction<typeof httpRequest>;
const mockResolve = resolveConnection as jest.MockedFunction<typeof resolveConnection>;
const request = (body: unknown) => ({ json: async () => body }) as never;

describe('POST /api/get-all-settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockResolvedValue({ ip: '10.0.0.5', port: 80, username: 'admin', password: 'pw' });
  });

  it('collects every endpoint into settings', async () => {
    mockHttpRequest.mockResolvedValue({ statusCode: 200, headers: {}, body: '{"ok":true}' });

    const data = await (await POST(request({ connectionId: '10.0.0.5:80' }))).json();

    expect(Object.keys(data.settings)).toEqual(expect.arrayContaining([
      'status', 'filtering', 'dnsSettings', 'rewrites', 'blockedServices', 'accessList', 'clients',
    ]));
    expect(data.errors).toEqual({});
  });

  it('records per-endpoint failures without failing the whole request', async () => {
    mockHttpRequest.mockImplementation(async ({ url }) =>
      url.includes('/control/tls/status')
        ? { statusCode: 500, headers: {}, body: '' }
        : { statusCode: 200, headers: {}, body: '{}' });

    const data = await (await POST(request({ connectionId: '10.0.0.5:80' }))).json();

    expect(data.errors.tls).toBe('Failed with status 500');
    expect(data.settings.status).toEqual({});
  });

  it('strips the undocumented "enabled" field from rewrites', async () => {
    mockHttpRequest.mockImplementation(async ({ url }) =>
      url.includes('/control/rewrite/list')
        ? { statusCode: 200, headers: {}, body: '[{"domain":"a.test","answer":"1.1.1.1","enabled":true}]' }
        : { statusCode: 200, headers: {}, body: '{}' });

    const data = await (await POST(request({ connectionId: '10.0.0.5:80' }))).json();

    expect(data.settings.rewrites).toEqual([{ domain: 'a.test', answer: '1.1.1.1' }]);
  });

  it('rejects a missing connectionId', async () => {
    expect((await POST(request({}))).status).toBe(400);
  });

  it('returns 404 for an unknown connection', async () => {
    mockResolve.mockResolvedValue(null);
    expect((await POST(request({ connectionId: 'ghost' }))).status).toBe(404);
  });
});
