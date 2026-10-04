import type { components } from '@/types/adguard';

export type FilterListItem = components['schemas']['Filter'];

export type SettingsValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: SettingsValue }
  | SettingsValue[]
  | FilterListItem;

export type Settings = Record<string, SettingsValue>;

export type DiffType = 'missing' | 'extra' | 'changed' | 'setting';

export type DiffItem = {
  name: string;
  masterVal: string;
  targetVal: string;
  type: DiffType;
};

/** Categories AdGuard Buddy can push from the master to a replica. */
export const SYNCABLE_CATEGORIES = [
  'filtering', 'querylogConfig', 'statsConfig', 'dnsSettings',
  'rewrites', 'blockedServices', 'accessList', 'clients',
] as const;

/** Volatile or instance-specific keys that must not count as drift. */
const IGNORED_KEYS = ['id', 'last_updated', 'default_local_ptr_upstreams'];

function isFilterList(value: SettingsValue[]): value is FilterListItem[] {
  if (value.length === 0) return false;
  const item = value[0];
  return typeof item === 'object' && item !== null && 'url' in item && 'name' in item;
}

/**
 * Structural equality that treats null and [] as the same, compares filter
 * lists as sets, and ignores per-instance keys.
 */
export function areSettingsEqual(a: SettingsValue, b: SettingsValue): boolean {
  if (a === b) return true;
  if ((a === null && Array.isArray(b) && b.length === 0) || (b === null && Array.isArray(a) && a.length === 0)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (isFilterList(a) && isFilterList(b)) {
      const key = (item: FilterListItem) => JSON.stringify({ name: item.name, url: item.url, rules_count: item.rules_count });
      const setA = new Set(a.map(key));
      const setB = new Set(b.map(key));
      if (setA.size !== setB.size) return false;
      for (const item of setA) if (!setB.has(item)) return false;
      return true;
    }

    if (a.length !== b.length) return false;

    const sorted = (arr: SettingsValue[]) => {
      if (arr.length === 0) return arr;
      const item = arr[0];
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        if ('id' in item) return [...arr].sort((x, y) => (x as { id: number }).id - (y as { id: number }).id);
        if ('url' in item) return [...arr].sort((x, y) => String((x as { url: string }).url).localeCompare(String((y as { url: string }).url)));
        if ('domain' in item) return [...arr].sort((x, y) => String((x as { domain: string }).domain).localeCompare(String((y as { domain: string }).domain)));
      }
      return [...arr].sort();
    };

    const sortedA = sorted(a);
    const sortedB = sorted(b);
    for (let i = 0; i < sortedA.length; i++) {
      if (!areSettingsEqual(sortedA[i], sortedB[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  for (const key of keysA) {
    if (IGNORED_KEYS.includes(key)) continue;
    if (!keysB.includes(key)) return false;
    if (!areSettingsEqual((a as Settings)[key], (b as Settings)[key])) return false;
  }
  for (const key of keysB) {
    if (IGNORED_KEYS.includes(key)) continue;
    if (!keysA.includes(key)) return false;
  }
  return true;
}

/**
 * Fields that differ between two persistent clients. Only fields reported by
 * both sides count: a field one AdGuard version lacks cannot be synced, so it
 * would otherwise show up as permanent drift.
 */
export function changedClientFields(a: Settings, b: Settings): string[] {
  return Object.keys(a).filter(key => key in b && !areSettingsEqual(a[key], b[key]));
}

/** Which of the syncable categories differ between master and replica. */
export function driftedCategories(master: Settings, target: Settings): string[] {
  return SYNCABLE_CATEGORIES.filter(key => {
    const m = master[key];
    const t = target[key];
    if ((m === undefined || m === null) && (t === undefined || t === null)) return false;
    if (key === 'clients') return diffCategory(key, m ?? null, t ?? null).length > 0;
    return !areSettingsEqual(m, t);
  });
}

function compareFilterLists(master: FilterListItem[], target: FilterListItem[], diffs: DiffItem[]) {
  const targetByUrl = new Map(target.map(f => [f.url, f]));
  const masterByUrl = new Map(master.map(f => [f.url, f]));

  master.forEach(item => {
    const counterpart = targetByUrl.get(item.url);
    if (!counterpart) {
      diffs.push({ name: item.name, masterVal: 'Present', targetVal: 'Missing', type: 'missing' });
      return;
    }
    if (item.enabled !== counterpart.enabled) {
      diffs.push({
        name: item.name,
        masterVal: item.enabled ? 'Enabled' : 'Disabled',
        targetVal: counterpart.enabled ? 'Enabled' : 'Disabled',
        type: 'changed',
      });
    }
    if (item.rules_count !== counterpart.rules_count) {
      diffs.push({
        name: item.name,
        masterVal: `${item.rules_count} rules`,
        targetVal: `${counterpart.rules_count} rules`,
        type: 'changed',
      });
    }
  });

  target.forEach(item => {
    if (!masterByUrl.has(item.url)) {
      diffs.push({ name: item.name, masterVal: 'Missing', targetVal: 'Present', type: 'extra' });
    }
  });
}

function asFilterList(data: Settings, key: string): FilterListItem[] {
  return Array.isArray(data[key]) ? (data[key] as FilterListItem[]) : [];
}

function blockedServiceIds(data: SettingsValue): string[] {
  if (Array.isArray(data)) return data as string[];
  if (data && typeof data === 'object' && 'ids' in (data as Record<string, unknown>)) {
    return ((data as Record<string, unknown>).ids as string[]) || [];
  }
  return [];
}

/** A human-readable list of what differs for one category. */
export function diffCategory(category: string, masterData: SettingsValue, targetData: SettingsValue): DiffItem[] {
  const diffs: DiffItem[] = [];
  if (!masterData && !targetData) return diffs;

  if (category === 'filtering') {
    const master = (masterData || {}) as Settings;
    const target = (targetData || {}) as Settings;

    if (master.enabled !== target.enabled) {
      diffs.push({
        name: 'Filtering enabled',
        masterVal: master.enabled ? 'Enabled' : 'Disabled',
        targetVal: target.enabled ? 'Enabled' : 'Disabled',
        type: 'setting',
      });
    }
    if (master.interval !== target.interval) {
      diffs.push({
        name: 'Update interval',
        masterVal: `${master.interval}h`,
        targetVal: `${target.interval}h`,
        type: 'setting',
      });
    }

    const masterRules = Array.isArray(master.user_rules) ? master.user_rules : [];
    const targetRules = Array.isArray(target.user_rules) ? target.user_rules : [];
    if (JSON.stringify(masterRules) !== JSON.stringify(targetRules)) {
      diffs.push({
        name: 'Custom rules',
        masterVal: `${masterRules.length} rules`,
        targetVal: `${targetRules.length} rules`,
        type: 'setting',
      });
    }

    compareFilterLists(asFilterList(master, 'filters'), asFilterList(target, 'filters'), diffs);
    compareFilterLists(asFilterList(master, 'whitelist_filters'), asFilterList(target, 'whitelist_filters'), diffs);
    return diffs;
  }

  if (category === 'rewrites') {
    const master = (Array.isArray(masterData) ? masterData : []) as { domain: string; answer: string }[];
    const target = (Array.isArray(targetData) ? targetData : []) as { domain: string; answer: string }[];
    const masterKeys = new Set(master.map(r => `${r.domain}->${r.answer}`));
    const targetKeys = new Set(target.map(r => `${r.domain}->${r.answer}`));

    master.forEach(rewrite => {
      if (!targetKeys.has(`${rewrite.domain}->${rewrite.answer}`)) {
        diffs.push({ name: rewrite.domain, masterVal: rewrite.answer, targetVal: 'Missing', type: 'missing' });
      }
    });
    target.forEach(rewrite => {
      if (!masterKeys.has(`${rewrite.domain}->${rewrite.answer}`)) {
        diffs.push({ name: rewrite.domain, masterVal: 'Missing', targetVal: rewrite.answer, type: 'extra' });
      }
    });
    return diffs;
  }

  if (category === 'clients') {
    const master = (Array.isArray(masterData) ? masterData : []) as Settings[];
    const target = (Array.isArray(targetData) ? targetData : []) as Settings[];
    const targetByName = new Map(target.map(c => [c.name, c]));
    const masterNames = new Set(master.map(c => c.name));
    const ids = (client: Settings) => (Array.isArray(client.ids) ? client.ids.join(', ') : '');

    master.forEach(client => {
      const counterpart = targetByName.get(client.name);
      if (!counterpart) {
        diffs.push({ name: String(client.name), masterVal: ids(client), targetVal: 'Missing', type: 'missing' });
        return;
      }
      const changedFields = changedClientFields(client, counterpart);
      if (changedFields.length > 0) {
        diffs.push({
          name: String(client.name),
          masterVal: changedFields.map(key => `${key}: ${JSON.stringify(client[key] ?? null)}`).join('; '),
          targetVal: changedFields.map(key => `${key}: ${JSON.stringify(counterpart[key] ?? null)}`).join('; '),
          type: 'changed',
        });
      }
    });
    target.forEach(client => {
      if (!masterNames.has(client.name)) {
        diffs.push({ name: String(client.name), masterVal: 'Missing', targetVal: ids(client), type: 'extra' });
      }
    });
    return diffs;
  }

  if (category === 'blockedServices') {
    const masterIds = new Set(blockedServiceIds(masterData));
    const targetIds = new Set(blockedServiceIds(targetData));
    masterIds.forEach(id => {
      if (!targetIds.has(id)) diffs.push({ name: id, masterVal: 'Blocked', targetVal: 'Allowed', type: 'missing' });
    });
    targetIds.forEach(id => {
      if (!masterIds.has(id)) diffs.push({ name: id, masterVal: 'Allowed', targetVal: 'Blocked', type: 'extra' });
    });
    return diffs;
  }

  if (
    typeof masterData === 'object' && masterData !== null && !Array.isArray(masterData) &&
    typeof targetData === 'object' && targetData !== null
  ) {
    const master = masterData as Settings;
    const target = targetData as Settings;
    Object.keys(master).forEach(key => {
      if (IGNORED_KEYS.includes(key)) return;
      if (!areSettingsEqual(master[key], target[key])) {
        diffs.push({
          name: key,
          masterVal: JSON.stringify(master[key]),
          targetVal: target[key] === undefined ? 'Missing' : JSON.stringify(target[key]),
          type: 'setting',
        });
      }
    });
  }

  return diffs;
}
