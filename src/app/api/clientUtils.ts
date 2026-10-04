import { components } from '../../types/adguard';

type Client = components['schemas']['Client'];

/**
 * Configurable fields of a persistent client.
 *
 * `GET /control/clients` also returns runtime data (WHOIS info, `disallowed`,
 * `disallowed_rule`, …) that differs per instance and is rejected or ignored
 * by `/clients/add`. Only these fields are compared and pushed during a sync.
 */
const CLIENT_FIELDS = [
    'name',
    'ids',
    'tags',
    'use_global_settings',
    'filtering_enabled',
    'parental_enabled',
    'safebrowsing_enabled',
    'safesearch_enabled',
    'safe_search',
    'use_global_blocked_services',
    'blocked_services',
    'blocked_services_schedule',
    'upstreams',
    'upstreams_cache_enabled',
    'upstreams_cache_size',
    'ignore_querylog',
    'ignore_statistics',
] as const;

/** List fields AdGuard reports as null when empty. */
const LIST_FIELDS = ['ids', 'tags', 'blocked_services', 'upstreams'] as const;

/**
 * Extracts the persistent clients from a `GET /control/clients` response,
 * keeping only configurable fields, turning null lists into [] and sorting by
 * name so that two instances with the same clients compare equal.
 *
 * Runtime ("auto") clients are dropped: they are discovered per instance and
 * cannot be created through the API.
 *
 * @param response - Raw `GET /control/clients` body
 * @returns Normalized persistent clients, sorted by name
 */
export function normalizeClients(response: unknown): Client[] {
    const clients = (response as { clients?: unknown } | null)?.clients;
    if (!Array.isArray(clients)) return [];

    return clients
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => {
            const normalized: Record<string, unknown> = {};
            for (const field of CLIENT_FIELDS) {
                if (item[field] !== undefined) normalized[field] = item[field];
            }
            for (const field of LIST_FIELDS) {
                if (normalized[field] === null) normalized[field] = [];
            }
            return normalized as Client;
        })
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
