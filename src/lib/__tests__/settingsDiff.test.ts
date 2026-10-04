import { areSettingsEqual, diffCategory, driftedCategories } from '../settingsDiff';

describe('areSettingsEqual', () => {
  it('treats null and an empty array as equal', () => {
    expect(areSettingsEqual(null, [])).toBe(true);
    expect(areSettingsEqual([], null)).toBe(true);
  });

  it('compares primitives', () => {
    expect(areSettingsEqual(1, 1)).toBe(true);
    expect(areSettingsEqual('a', 'b')).toBe(false);
    expect(areSettingsEqual(true, false)).toBe(false);
  });

  it('ignores per-instance keys', () => {
    expect(areSettingsEqual(
      { enabled: true, id: 1, last_updated: '2024-01-01' },
      { enabled: true, id: 2, last_updated: '2025-01-01' },
    )).toBe(true);
  });

  it('compares filter lists as sets regardless of order', () => {
    const a = [
      { url: 'https://a.test/l.txt', name: 'A', rules_count: 10, enabled: true },
      { url: 'https://b.test/l.txt', name: 'B', rules_count: 20, enabled: true },
    ];
    expect(areSettingsEqual(a, [...a].reverse())).toBe(true);
  });

  it('detects a changed rules_count in a filter list', () => {
    expect(areSettingsEqual(
      [{ url: 'https://a.test/l.txt', name: 'A', rules_count: 10, enabled: true }],
      [{ url: 'https://a.test/l.txt', name: 'A', rules_count: 11, enabled: true }],
    )).toBe(false);
  });

  it('sorts plain arrays before comparing', () => {
    expect(areSettingsEqual(['1.1.1.1', '8.8.8.8'], ['8.8.8.8', '1.1.1.1'])).toBe(true);
  });

  it('detects arrays of different length', () => {
    expect(areSettingsEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('detects a key present on only one side', () => {
    expect(areSettingsEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(areSettingsEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('recurses into nested objects', () => {
    expect(areSettingsEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } })).toBe(true);
    expect(areSettingsEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } })).toBe(false);
  });
});

describe('driftedCategories', () => {
  it('returns only categories that actually differ', () => {
    const master = { filtering: { enabled: true }, rewrites: [], statsConfig: { interval: 1 } };
    const replica = { filtering: { enabled: false }, rewrites: [], statsConfig: { interval: 1 } };

    expect(driftedCategories(master, replica)).toEqual(['filtering']);
  });

  it('ignores a category missing on both sides', () => {
    expect(driftedCategories({ filtering: { enabled: true } }, { filtering: { enabled: true } })).toEqual([]);
  });

  it('flags a category present on only one side', () => {
    expect(driftedCategories({ rewrites: [{ domain: 'a.test', answer: '1.1.1.1' }] }, {}))
      .toEqual(['rewrites']);
  });
});

describe('diffCategory', () => {
  describe('filtering', () => {
    it('reports the enabled flag and interval', () => {
      const diffs = diffCategory(
        'filtering',
        { enabled: true, interval: 24, user_rules: [], filters: [], whitelist_filters: [] },
        { enabled: false, interval: 1, user_rules: [], filters: [], whitelist_filters: [] },
      );

      expect(diffs).toContainEqual({
        name: 'Filtering enabled', masterVal: 'Enabled', targetVal: 'Disabled', type: 'setting',
      });
      expect(diffs).toContainEqual({
        name: 'Update interval', masterVal: '24h', targetVal: '1h', type: 'setting',
      });
    });

    it('reports differing custom rule counts', () => {
      const diffs = diffCategory(
        'filtering',
        { enabled: true, interval: 1, user_rules: ['a', 'b'], filters: [], whitelist_filters: [] },
        { enabled: true, interval: 1, user_rules: [], filters: [], whitelist_filters: [] },
      );

      expect(diffs).toContainEqual({
        name: 'Custom rules', masterVal: '2 rules', targetVal: '0 rules', type: 'setting',
      });
    });

    it('marks a filter the replica lacks as missing and an unknown one as extra', () => {
      const diffs = diffCategory(
        'filtering',
        {
          enabled: true, interval: 1, user_rules: [], whitelist_filters: [],
          filters: [{ url: 'https://a.test/l.txt', name: 'A', enabled: true }],
        },
        {
          enabled: true, interval: 1, user_rules: [], whitelist_filters: [],
          filters: [{ url: 'https://z.test/l.txt', name: 'Z', enabled: true }],
        },
      );

      expect(diffs).toContainEqual({ name: 'A', masterVal: 'Present', targetVal: 'Missing', type: 'missing' });
      expect(diffs).toContainEqual({ name: 'Z', masterVal: 'Missing', targetVal: 'Present', type: 'extra' });
    });

    it('marks a filter whose enabled flag drifted as changed', () => {
      const diffs = diffCategory(
        'filtering',
        {
          enabled: true, interval: 1, user_rules: [], whitelist_filters: [],
          filters: [{ url: 'https://a.test/l.txt', name: 'A', enabled: true }],
        },
        {
          enabled: true, interval: 1, user_rules: [], whitelist_filters: [],
          filters: [{ url: 'https://a.test/l.txt', name: 'A', enabled: false }],
        },
      );

      expect(diffs).toContainEqual({
        name: 'A', masterVal: 'Enabled', targetVal: 'Disabled', type: 'changed',
      });
    });
  });

  describe('rewrites', () => {
    it('lists missing and extra rewrites', () => {
      const diffs = diffCategory(
        'rewrites',
        [{ domain: 'a.test', answer: '1.1.1.1' }],
        [{ domain: 'z.test', answer: '9.9.9.9' }],
      );

      expect(diffs).toContainEqual({ name: 'a.test', masterVal: '1.1.1.1', targetVal: 'Missing', type: 'missing' });
      expect(diffs).toContainEqual({ name: 'z.test', masterVal: 'Missing', targetVal: '9.9.9.9', type: 'extra' });
    });

    it('returns nothing for identical rewrites', () => {
      const list = [{ domain: 'a.test', answer: '1.1.1.1' }];
      expect(diffCategory('rewrites', list, [...list])).toEqual([]);
    });
  });

  describe('clients', () => {
    const tablet = { name: 'Tablet', ids: ['10.0.0.5'], parental_enabled: true };

    it('lists missing, extra and changed clients', () => {
      const diffs = diffCategory('clients',
        [tablet, { name: 'TV', ids: ['10.0.0.6'] }],
        [{ ...tablet, parental_enabled: false }, { name: 'Old', ids: ['10.0.0.7'] }]);
      expect(diffs).toEqual([
        { name: 'Tablet', masterVal: 'parental_enabled: true', targetVal: 'parental_enabled: false', type: 'changed' },
        { name: 'TV', masterVal: '10.0.0.6', targetVal: 'Missing', type: 'missing' },
        { name: 'Old', masterVal: 'Missing', targetVal: '10.0.0.7', type: 'extra' },
      ]);
    });

    it('ignores fields only one side reports', () => {
      expect(diffCategory('clients', [tablet], [{ ...tablet, upstreams_cache_size: 0 }])).toEqual([]);
      expect(driftedCategories({ clients: [tablet] }, { clients: [{ ...tablet, upstreams_cache_size: 0 }] }))
        .toEqual([]);
    });
  });

  describe('blockedServices', () => {
    it('handles the plain array shape', () => {
      const diffs = diffCategory('blockedServices', ['facebook'], []);
      expect(diffs).toContainEqual({ name: 'facebook', masterVal: 'Blocked', targetVal: 'Allowed', type: 'missing' });
    });

    it('handles the { ids: [...] } shape', () => {
      const diffs = diffCategory('blockedServices', { ids: [] }, { ids: ['tiktok'] });
      expect(diffs).toContainEqual({ name: 'tiktok', masterVal: 'Allowed', targetVal: 'Blocked', type: 'extra' });
    });
  });

  describe('generic settings', () => {
    it('reports a changed key', () => {
      const diffs = diffCategory('dnsSettings', { cache_size: 4096 }, { cache_size: 1024 });
      expect(diffs).toContainEqual({
        name: 'cache_size', masterVal: '4096', targetVal: '1024', type: 'setting',
      });
    });

    it('reports a key the replica does not have', () => {
      const diffs = diffCategory('dnsSettings', { dnssec_enabled: true }, {});
      expect(diffs).toContainEqual({
        name: 'dnssec_enabled', masterVal: 'true', targetVal: 'Missing', type: 'setting',
      });
    });

    it('ignores per-instance keys', () => {
      expect(diffCategory('dnsSettings', { id: 1 }, { id: 2 })).toEqual([]);
    });
  });

  it('returns nothing when both sides are absent', () => {
    expect(diffCategory('filtering', null, null)).toEqual([]);
  });
});
