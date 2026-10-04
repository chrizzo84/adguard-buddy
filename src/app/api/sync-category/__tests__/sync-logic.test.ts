import { performCategorySync } from '../sync-logic';
import { httpRequest } from '@/lib/httpRequest';

jest.mock('@/lib/httpRequest', () => ({ httpRequest: jest.fn() }));

const mockHttpRequest = httpRequest as jest.MockedFunction<typeof httpRequest>;

const SOURCE = { ip: '192.168.1.1', port: 80, username: 'admin', password: 'master-pw' };
const DEST = { ip: '192.168.1.2', port: 80, username: 'admin', password: 'replica-pw' };

const ok = (body: unknown) => ({ statusCode: 200, headers: {}, body: JSON.stringify(body) });
const fail = (statusCode: number, body = '') => ({ statusCode, headers: {}, body });

/** Routes each mocked call by host + endpoint. */
function route(handlers: Record<string, (isSource: boolean) => { statusCode: number; headers: object; body: string }>) {
  mockHttpRequest.mockImplementation(async ({ url }) => {
    const isSource = url.includes('192.168.1.1');
    const endpoint = url.split('/control/')[1];
    const handler = handlers[endpoint];
    if (!handler) throw new Error(`Unexpected endpoint: ${endpoint}`);
    return handler(isSource) as never;
  });
}

function callsTo(endpoint: string) {
  return mockHttpRequest.mock.calls.filter(([opts]) => opts.url.endsWith(`/control/${endpoint}`));
}

describe('performCategorySync', () => {
  let log: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    log = jest.fn();
  });

  describe('authentication and addressing', () => {
    it('sends basic auth built from each connection', async () => {
      route({
        'querylog/config': () => ok({ enabled: true }),
        'querylog/config/update': () => ok({}),
      });

      await performCategorySync(SOURCE, DEST, 'querylogConfig', log);

      expect(mockHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
        url: 'http://192.168.1.1:80/control/querylog/config',
        headers: expect.objectContaining({
          Authorization: 'Basic ' + Buffer.from('admin:master-pw').toString('base64'),
        }),
      }));
      expect(mockHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
        url: 'http://192.168.1.2:80/control/querylog/config/update',
        headers: expect.objectContaining({
          Authorization: 'Basic ' + Buffer.from('admin:replica-pw').toString('base64'),
        }),
      }));
    });

    it('prefers a configured URL over ip:port', async () => {
      mockHttpRequest.mockResolvedValue(ok({}));

      await performCategorySync(
        { url: 'https://master.test/', username: 'a', password: 'b', allowInsecure: true },
        { url: 'https://replica.test', username: 'a', password: 'b' },
        'accessList',
        log,
      );

      expect(mockHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://master.test/control/access/list',
        allowInsecure: true,
      }));
    });

    it('throws when a connection has neither url nor ip', async () => {
      await expect(
        performCategorySync({ username: 'a', password: 'b' }, DEST, 'accessList', log),
      ).rejects.toThrow('Connection must have either url or ip specified');
    });

    it('warns about an empty password instead of silently authenticating', async () => {
      mockHttpRequest.mockResolvedValue(ok({}));

      await performCategorySync({ ...SOURCE, password: '' }, DEST, 'accessList', log);

      expect(log).toHaveBeenCalledWith(expect.stringContaining('Empty password for connection'));
    });
  });

  describe('filtering', () => {
    const masterStatus = {
      enabled: true,
      interval: 24,
      user_rules: ['||ads.test^'],
      filters: [{ url: 'https://a.test/list.txt', name: 'A', enabled: true }],
      whitelist_filters: [],
    };

    it('syncs config, rules and filter lists, then refreshes both sides', async () => {
      route({
        'filtering/status': isSource => ok(isSource
          ? masterStatus
          : { enabled: false, interval: 1, user_rules: [], filters: [], whitelist_filters: [] }),
        'filtering/config': () => ok({}),
        'filtering/set_rules': () => ok({}),
        'filtering/add_url': () => ok({}),
        'filtering/refresh': () => ok({}),
      });

      await performCategorySync(SOURCE, DEST, 'filtering', log);

      expect(JSON.parse(callsTo('filtering/config')[0][0].body as string))
        .toEqual({ enabled: true, interval: 24 });
      expect(JSON.parse(callsTo('filtering/set_rules')[0][0].body as string))
        .toEqual({ rules: ['||ads.test^'] });
      expect(JSON.parse(callsTo('filtering/add_url')[0][0].body as string))
        .toEqual({ url: 'https://a.test/list.txt', name: 'A', whitelist: false });
      // Both master and replica get refreshed.
      expect(callsTo('filtering/refresh')).toHaveLength(2);
    });

    it('removes filters the master no longer has', async () => {
      route({
        'filtering/status': isSource => ok(isSource
          ? { ...masterStatus, filters: [] }
          : { ...masterStatus, filters: [{ url: 'https://old.test/l.txt', name: 'Old', enabled: true }] }),
        'filtering/config': () => ok({}),
        'filtering/set_rules': () => ok({}),
        'filtering/remove_url': () => ok({}),
        'filtering/refresh': () => ok({}),
      });

      await performCategorySync(SOURCE, DEST, 'filtering', log);

      expect(JSON.parse(callsTo('filtering/remove_url')[0][0].body as string))
        .toEqual({ url: 'https://old.test/l.txt', whitelist: false });
    });

    it('updates a filter whose name or enabled state drifted', async () => {
      route({
        'filtering/status': isSource => ok(isSource
          ? { ...masterStatus, filters: [{ url: 'https://a.test/list.txt', name: 'New name', enabled: false }] }
          : { ...masterStatus, filters: [{ url: 'https://a.test/list.txt', name: 'Old name', enabled: true }] }),
        'filtering/config': () => ok({}),
        'filtering/set_rules': () => ok({}),
        'filtering/set_url': () => ok({}),
        'filtering/refresh': () => ok({}),
      });

      await performCategorySync(SOURCE, DEST, 'filtering', log);

      expect(JSON.parse(callsTo('filtering/set_url')[0][0].body as string)).toEqual({
        url: 'https://a.test/list.txt',
        whitelist: false,
        data: { name: 'New name', enabled: false },
      });
    });

    it('marks whitelist operations with whitelist: true', async () => {
      route({
        'filtering/status': isSource => ok(isSource
          ? { ...masterStatus, filters: [], whitelist_filters: [{ url: 'https://w.test/w.txt', name: 'W', enabled: true }] }
          : { ...masterStatus, filters: [], whitelist_filters: [] }),
        'filtering/config': () => ok({}),
        'filtering/set_rules': () => ok({}),
        'filtering/add_url': () => ok({}),
        'filtering/refresh': () => ok({}),
      });

      await performCategorySync(SOURCE, DEST, 'filtering', log);

      expect(JSON.parse(callsTo('filtering/add_url')[0][0].body as string).whitelist).toBe(true);
    });

    it('tolerates null filter lists', async () => {
      route({
        'filtering/status': () => ok({ ...masterStatus, filters: null, whitelist_filters: null }),
        'filtering/config': () => ok({}),
        'filtering/set_rules': () => ok({}),
        'filtering/refresh': () => ok({}),
      });

      await expect(performCategorySync(SOURCE, DEST, 'filtering', log)).resolves.toBeUndefined();
    });

    it('throws when the master status cannot be read', async () => {
      route({ 'filtering/status': () => fail(401) });

      await expect(performCategorySync(SOURCE, DEST, 'filtering', log))
        .rejects.toThrow(/Failed to fetch filtering status from master/);
    });

    it('throws when pushing user rules fails', async () => {
      route({
        'filtering/status': () => ok(masterStatus),
        'filtering/config': () => ok({}),
        'filtering/set_rules': () => fail(500, 'boom'),
      });

      await expect(performCategorySync(SOURCE, DEST, 'filtering', log))
        .rejects.toThrow(/Failed to sync user rules/);
    });

    it('warns but does not fail when a refresh call fails', async () => {
      route({
        'filtering/status': () => ok({ ...masterStatus, filters: [], whitelist_filters: [] }),
        'filtering/config': () => ok({}),
        'filtering/set_rules': () => ok({}),
        'filtering/refresh': () => fail(500, 'busy'),
      });

      await expect(performCategorySync(SOURCE, DEST, 'filtering', log)).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledWith(expect.stringContaining('WARNING: Master filter refresh failed'));
      expect(log).toHaveBeenCalledWith(expect.stringContaining('WARNING: Replica filter refresh failed'));
    });
  });

  describe('config categories', () => {
    it.each([
      ['querylogConfig', 'querylog/config', 'querylog/config/update', 'PUT'],
      ['statsConfig', 'stats/config', 'stats/config/update', 'PUT'],
      ['accessList', 'access/list', 'access/set', 'POST'],
      ['blockedServices', 'blocked_services/get', 'blocked_services/update', 'PUT'],
    ])('%s reads %s and writes %s', async (category, getEndpoint, setEndpoint, method) => {
      const payload = { some: 'config' };
      route({
        [getEndpoint]: () => ok(payload),
        [setEndpoint]: () => ok({}),
      });

      await performCategorySync(SOURCE, DEST, category, log);

      const [opts] = callsTo(setEndpoint)[0];
      expect(opts.method).toBe(method);
      expect(JSON.parse(opts.body as string)).toEqual(payload);
    });

    it('throws when the replica rejects the push', async () => {
      route({
        'access/list': () => ok({}),
        'access/set': () => fail(500, 'nope'),
      });

      await expect(performCategorySync(SOURCE, DEST, 'accessList', log))
        .rejects.toThrow(/Failed to push accessList to replica/);
    });
  });

  describe('rewrites', () => {
    it('adds missing rewrites and removes extra ones', async () => {
      route({
        'rewrite/list': isSource => ok(isSource
          ? [{ domain: 'keep.test', answer: '1.1.1.1' }, { domain: 'new.test', answer: '2.2.2.2' }]
          : [{ domain: 'keep.test', answer: '1.1.1.1' }, { domain: 'stale.test', answer: '3.3.3.3' }]),
        'rewrite/add': () => ok({}),
        'rewrite/delete': () => ok({}),
      });

      await performCategorySync(SOURCE, DEST, 'rewrites', log);

      expect(JSON.parse(callsTo('rewrite/delete')[0][0].body as string))
        .toEqual({ domain: 'stale.test', answer: '3.3.3.3' });
      expect(JSON.parse(callsTo('rewrite/add')[0][0].body as string))
        .toEqual({ domain: 'new.test', answer: '2.2.2.2' });
    });

    it('ignores the undocumented "enabled" field when comparing', async () => {
      route({
        'rewrite/list': isSource => ok(isSource
          ? [{ domain: 'a.test', answer: '1.1.1.1' }]
          : [{ domain: 'a.test', answer: '1.1.1.1', enabled: true }]),
        'rewrite/add': () => ok({}),
        'rewrite/delete': () => ok({}),
      });

      await performCategorySync(SOURCE, DEST, 'rewrites', log);

      expect(callsTo('rewrite/add')).toHaveLength(0);
      expect(callsTo('rewrite/delete')).toHaveLength(0);
    });

    it('throws when a rewrite cannot be added', async () => {
      route({
        'rewrite/list': isSource => ok(isSource ? [{ domain: 'a.test', answer: '1.1.1.1' }] : []),
        'rewrite/add': () => fail(500),
      });

      await expect(performCategorySync(SOURCE, DEST, 'rewrites', log))
        .rejects.toThrow(/Failed to add rewrite a.test/);
    });
  });

  describe('clients', () => {
    const client = (name: string, overrides: Record<string, unknown> = {}) => ({
      name,
      ids: [`${name}.lan`],
      use_global_settings: true,
      filtering_enabled: true,
      blocked_services: null,
      ...overrides,
    });

    it('adds missing clients and removes extra ones', async () => {
      route({
        clients: isSource => ok({
          clients: isSource ? [client('keep'), client('new')] : [client('keep'), client('stale')],
          auto_clients: [{ ip: '10.0.0.9', name: 'runtime', source: 'arp' }],
        }),
        'clients/add': () => ok({}),
        'clients/delete': () => ok({}),
      });

      await performCategorySync(SOURCE, DEST, 'clients', log);

      expect(callsTo('clients/delete').map(([opts]) => JSON.parse(opts.body as string)))
        .toEqual([{ name: 'stale' }]);
      expect(callsTo('clients/add').map(([opts]) => JSON.parse(opts.body as string)))
        .toEqual([{ ...client('new'), blocked_services: [] }]);
    });

    it('replaces a changed client by deleting before adding', async () => {
      route({
        clients: isSource => ok({
          clients: [client('tablet', { parental_enabled: isSource })],
        }),
        'clients/add': () => ok({}),
        'clients/delete': () => ok({}),
      });

      await performCategorySync(SOURCE, DEST, 'clients', log);

      const order = mockHttpRequest.mock.calls
        .map(([opts]) => opts.url.split('/control/')[1])
        .filter(endpoint => endpoint !== 'clients');
      expect(order).toEqual(['clients/delete', 'clients/add']);
      expect(JSON.parse(callsTo('clients/add')[0][0].body as string).parental_enabled).toBe(true);
    });

    it('leaves clients alone that only differ in runtime or version-specific fields', async () => {
      route({
        clients: isSource => ok({
          clients: [isSource
            ? client('tv', { whois_info: { country: 'DE' } })
            : client('tv', { blocked_services: [], upstreams_cache_enabled: false, disallowed: false })],
        }),
      });

      await performCategorySync(SOURCE, DEST, 'clients', log);

      expect(callsTo('clients/add')).toHaveLength(0);
      expect(callsTo('clients/delete')).toHaveLength(0);
    });

    it('tolerates a null client list', async () => {
      route({
        clients: isSource => ok({ clients: isSource ? [client('a')] : null }),
        'clients/add': () => ok({}),
      });

      await performCategorySync(SOURCE, DEST, 'clients', log);

      expect(callsTo('clients/add')).toHaveLength(1);
    });

    it('throws when a client cannot be added', async () => {
      route({
        clients: isSource => ok({ clients: isSource ? [client('a')] : [] }),
        'clients/add': () => fail(400, 'duplicate'),
      });

      await expect(performCategorySync(SOURCE, DEST, 'clients', log))
        .rejects.toThrow(/Failed to add client a/);
    });
  });

  describe('dnsSettings', () => {
    const dnsInfo = (overrides: Record<string, unknown> = {}) => ({
      upstream_dns: ['1.1.1.1'],
      cache_size: 4194304,
      blocking_mode: 'default',
      ...overrides,
    });

    it('skips the push when the tracked properties already match', async () => {
      route({ dns_info: () => ok(dnsInfo()) });

      await performCategorySync(SOURCE, DEST, 'dnsSettings', log);

      expect(callsTo('dns_config')).toHaveLength(0);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('already in sync'));
    });

    it('pushes only the tracked properties when they differ', async () => {
      route({
        dns_info: isSource => ok(isSource
          ? dnsInfo({ instance_only_field: 'master' })
          : dnsInfo({ cache_size: 1024 })),
        dns_config: () => ok({}),
      });

      await performCategorySync(SOURCE, DEST, 'dnsSettings', log);

      const pushed = JSON.parse(callsTo('dns_config')[0][0].body as string);
      expect(pushed.cache_size).toBe(4194304);
      expect(pushed).not.toHaveProperty('instance_only_field');
      expect(log).toHaveBeenCalledWith(expect.stringContaining('cache_size: master=[4194304] replica=[1024]'));
    });

    it('throws when the replica rejects the DNS config', async () => {
      route({
        dns_info: isSource => ok(isSource ? dnsInfo() : dnsInfo({ cache_size: 1 })),
        dns_config: () => fail(400, 'invalid'),
      });

      await expect(performCategorySync(SOURCE, DEST, 'dnsSettings', log))
        .rejects.toThrow(/Failed to push DNS settings/);
    });
  });

  it('throws for an unimplemented category', async () => {
    await expect(performCategorySync(SOURCE, DEST, 'tls', log))
      .rejects.toThrow("Sync for category 'tls' is not yet implemented.");
  });
});
