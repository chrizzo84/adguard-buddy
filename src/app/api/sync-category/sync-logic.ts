import { components } from "../../../types/adguard";
import { httpRequest } from '../../lib/httpRequest';
import { getConnectionDisplayName, type Connection } from '@/lib/connectionUtils';
import { normalizeRewrites } from '../rewriteUtils';

type Filter = {
    url: string;
    name: string;
    enabled: boolean;
};

// ConnectionDetails is compatible with Connection type from connectionUtils
type ConnectionDetails = Connection;

/**
 * Performs a category sync between a source (master) and destination (replica) connection.
 * This is the core sync logic extracted for reuse by both manual sync and auto-sync.
 */
export async function performCategorySync(
    sourceConnection: ConnectionDetails,
    destinationConnection: ConnectionDetails,
    category: string,
    log: (message: string) => void
): Promise<void> {
    // Helper to get display names for logging
    const sourceName = getConnectionDisplayName(sourceConnection);
    const destName = getConnectionDisplayName(destinationConnection);

    const fetchApi = async (conn: ConnectionDetails & { url?: string; allowInsecure?: boolean }, endpoint: string, options: RequestInit = {}) => {
        // Build base URL - prefer explicit URL over IP:port
        let base: string;
        if (conn.url && conn.url.length > 0) {
            base = conn.url.replace(/\/$/, '');
        } else if (conn.ip) {
            base = `http://${conn.ip}${conn.port ? ':' + conn.port : ''}`;
        } else {
            throw new Error('Connection must have either url or ip specified');
        }

        const url = `${base}/control/${endpoint}`;

        // Check if password is empty (decryption might have failed)
        if (!conn.password || conn.password.length === 0) {
            log(`WARNING: Empty password for connection - authentication will fail!`);
            log(`  Username: ${conn.username}`);
            log(`  URL: ${url}`);
        }

        const headers = { ...(options.headers as Record<string, string> || {}), 'Authorization': conn.username ? "Basic " + Buffer.from(`${conn.username}:${conn.password}`).toString("base64") : '' } as Record<string, string>;
        const method = (options.method && (options.method === 'POST' || options.method === 'PUT')) ? String(options.method) : 'GET';
        const r = await httpRequest({ method: method as 'GET' | 'POST' | 'PUT' | 'DELETE', url, headers, body: options.body as string || null, allowInsecure: conn.allowInsecure });
        return { ok: r.statusCode >= 200 && r.statusCode < 300, status: r.statusCode, text: async () => r.body, json: async () => JSON.parse(r.body || '{}') } as Response;
    };

    log(`Starting sync for category: ${category}`);

    if (category === 'filtering') {
        log(`-> Fetching filtering status from master: ${sourceName}`);
        const masterRes = await fetchApi(sourceConnection, 'filtering/status');
        if (!masterRes.ok) throw new Error(`Failed to fetch filtering status from master ${sourceName}: ${masterRes.status}`);
        const masterSettings = await masterRes.json();
        log(`<- Successfully fetched settings from master.`);

        log(`-> Fetching filtering status from replica: ${destName}`);
        const replicaRes = await fetchApi(destinationConnection, 'filtering/status');
        if (!replicaRes.ok) throw new Error(`Failed to fetch filtering status from replica ${destName}: ${replicaRes.status}`);
        const replicaSettings = await replicaRes.json();
        log(`<- Successfully fetched settings from replica.`);

        log("-> Syncing basic filtering config (enabled status and interval).");
        const configRes = await fetchApi(destinationConnection, 'filtering/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: masterSettings.enabled, interval: masterSettings.interval }),
        });
        if (!configRes.ok) {
            const errorText = await configRes.text();
            throw new Error(`Failed to sync basic filtering config to replica ${destName}: ${configRes.status} ${errorText}`);
        }
        log("<- Basic config synced.");

        log("-> Syncing user rules.");
        const rulesRes = await fetchApi(destinationConnection, 'filtering/set_rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rules: masterSettings.user_rules }),
        });
        if (!rulesRes.ok) {
            const errorText = await rulesRes.text();
            throw new Error(`Failed to sync user rules to replica ${destName}: ${rulesRes.status} ${errorText}`);
        }
        log("<- User rules synced.");

        const syncFilterList = async (masterFilters: Filter[] | null, replicaFilters: Filter[] | null, isWhitelist: boolean) => {
            const listType = isWhitelist ? "Whitelist" : "Blocklist";
            log(`-> Syncing ${listType} filters...`);

            const safeMasterFilters = masterFilters || [];
            const safeReplicaFilters = replicaFilters || [];
            const masterUrls = new Set(safeMasterFilters.map(f => f.url));

            for (const filter of safeReplicaFilters) {
                if (!masterUrls.has(filter.url)) {
                    log(`   - Removing ${listType} filter: ${filter.name} (${filter.url})`);
                    const removeRes = await fetchApi(destinationConnection, 'filtering/remove_url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: filter.url, whitelist: isWhitelist }),
                    });
                    if (!removeRes.ok) {
                        const errorText = await removeRes.text();
                        log(`   - FAILED to remove filter ${filter.url}: ${removeRes.status} ${errorText}`);
                        throw new Error(`Failed to remove filter ${filter.url} from replica ${destName}`);
                    }
                    log(`   - Removed successfully.`);
                }
            }

            const replicaMap = new Map(safeReplicaFilters.map(f => [f.url, f]));
            for (const masterFilter of safeMasterFilters) {
                const replicaFilter = replicaMap.get(masterFilter.url);

                if (!replicaFilter) {
                    // Add new filter
                    log(`   + Adding new ${listType} filter: ${masterFilter.name} (${masterFilter.url})`);
                    const addRes = await fetchApi(destinationConnection, 'filtering/add_url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: masterFilter.url, name: masterFilter.name, whitelist: isWhitelist }),
                    });
                    if (!addRes.ok) {
                        const errorText = await addRes.text();
                        log(`   + FAILED to add filter ${masterFilter.url}: ${addRes.status} ${errorText}`);
                        throw new Error(`Failed to add filter ${masterFilter.url} to replica ${destName}`);
                    }
                    log(`   + Added successfully.`);
                } else {
                    // Check for updates on existing filters
                    if (masterFilter.name !== replicaFilter.name || masterFilter.enabled !== replicaFilter.enabled) {
                        log(`   * Updating ${listType} filter: ${masterFilter.name} (${masterFilter.url})`);
                        const updateRes = await fetchApi(destinationConnection, 'filtering/set_url', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                url: masterFilter.url,
                                whitelist: isWhitelist,
                                data: { name: masterFilter.name, enabled: masterFilter.enabled }
                            }),
                        });
                        if (!updateRes.ok) {
                            const errorText = await updateRes.text();
                            log(`   * FAILED to update filter ${masterFilter.url}: ${updateRes.status} ${errorText}`);
                            throw new Error(`Failed to update filter ${masterFilter.url} on replica ${destName}`);
                        }
                        log(`   * Updated successfully.`);
                    }
                }
            }
            log(`<- ${listType} filters sync completed.`);
        };

        await syncFilterList(masterSettings.filters, replicaSettings.filters, false);
        await syncFilterList(masterSettings.whitelist_filters, replicaSettings.whitelist_filters, true);

        // Trigger filter list refresh on BOTH master and replica to ensure both have latest rules
        log("--> Triggering filter list refresh on master...");
        const masterRefreshRes = await fetchApi(sourceConnection, 'filtering/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ whitelist: false }),
        });
        if (!masterRefreshRes.ok) {
            const errorText = await masterRefreshRes.text();
            log(`<- WARNING: Master filter refresh failed: ${masterRefreshRes.status} ${errorText}`);
        } else {
            log("<- Master filter refresh triggered successfully.");
        }

        log("--> Triggering filter list refresh on replica...");
        const replicaRefreshRes = await fetchApi(destinationConnection, 'filtering/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ whitelist: false }),
        });
        if (!replicaRefreshRes.ok) {
            const errorText = await replicaRefreshRes.text();
            log(`<- WARNING: Replica filter refresh failed: ${replicaRefreshRes.status} ${errorText}`);
        } else {
            log("<- Replica filter refresh triggered successfully.");
        }

    } else if (category === 'querylogConfig' || category === 'statsConfig') {
        const getConfigEndpoint = category === 'querylogConfig' ? 'querylog/config' : 'stats/config';
        const setConfigEndpoint = category === 'querylogConfig' ? 'querylog/config/update' : 'stats/config/update';

        log(`-> Fetching ${category} from master: ${sourceName}`);
        const masterRes = await fetchApi(sourceConnection, getConfigEndpoint);
        if (!masterRes.ok) throw new Error(`Failed to fetch ${category} from master ${sourceName}`);
        const masterConfig = await masterRes.json();
        log(`<- Fetched ${category} successfully.`);

        log(`-> Pushing ${category} to replica: ${destName}`);
        const replicaRes = await fetchApi(destinationConnection, setConfigEndpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(masterConfig),
        });

        if (!replicaRes.ok) {
            const errorText = await replicaRes.text();
            throw new Error(`Failed to push ${category} to replica ${destName}: ${replicaRes.status} ${errorText}`);
        }
        log(`<- ${category} synced successfully.`);
    } else if (category === 'accessList') {
        log(`-> Fetching ${category} from master: ${sourceName}`);
        const masterRes = await fetchApi(sourceConnection, 'access/list');
        if (!masterRes.ok) throw new Error(`Failed to fetch ${category} from master ${sourceName}`);
        const masterConfig = await masterRes.json();
        log(`<- Fetched ${category} successfully.`);

        log(`-> Pushing ${category} to replica: ${destName}`);
        const replicaRes = await fetchApi(destinationConnection, 'access/set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(masterConfig),
        });

        if (!replicaRes.ok) {
            const errorText = await replicaRes.text();
            throw new Error(`Failed to push ${category} to replica ${destName}: ${replicaRes.status} ${errorText}`);
        }
        log(`<- ${category} synced successfully.`);
    } else if (category === 'blockedServices') {
        log(`-> Fetching ${category} from master: ${sourceName}`);
        const masterRes = await fetchApi(sourceConnection, 'blocked_services/get');
        if (!masterRes.ok) throw new Error(`Failed to fetch ${category} from master ${sourceName}`);
        const masterConfig = await masterRes.json();
        log(`<- Fetched ${category} successfully.`);

        log(`-> Pushing ${category} to replica: ${destName}`);
        const replicaRes = await fetchApi(destinationConnection, 'blocked_services/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(masterConfig),
        });

        if (!replicaRes.ok) {
            const errorText = await replicaRes.text();
            throw new Error(`Failed to push ${category} to replica ${destName}: ${replicaRes.status} ${errorText}`);
        }
        log(`<- ${category} synced successfully.`);
    } else if (category === 'rewrites') {
        log(`-> Fetching rewrites from master: ${sourceName}`);
        const masterRes = await fetchApi(sourceConnection, 'rewrite/list');
        if (!masterRes.ok) throw new Error(`Failed to fetch rewrites from master ${sourceName}`);
        let masterRewrites = await masterRes.json() as components['schemas']['RewriteList'];
        masterRewrites = normalizeRewrites(masterRewrites);
        log(`<- Fetched rewrites successfully.`);

        log(`-> Fetching rewrites from replica: ${destName}`);
        const replicaRes = await fetchApi(destinationConnection, 'rewrite/list');
        if (!replicaRes.ok) throw new Error(`Failed to fetch rewrites from replica ${destName}`);
        let replicaRewrites = await replicaRes.json() as components['schemas']['RewriteList'];
        replicaRewrites = normalizeRewrites(replicaRewrites);
        log(`<- Fetched rewrites successfully.`);

        const masterRewriteSet = new Set(masterRewrites.map(r => JSON.stringify(r)));
        const replicaRewriteMap = new Map(replicaRewrites.map(r => [JSON.stringify(r), r]));

        for (const rewrite of replicaRewrites) {
            if (!masterRewriteSet.has(JSON.stringify(rewrite))) {
                log(`   - Removing rewrite: ${rewrite.domain} -> ${rewrite.answer}`);
                const deleteRes = await fetchApi(destinationConnection, 'rewrite/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rewrite),
                });
                if (!deleteRes.ok) {
                    const errorText = await deleteRes.text();
                    log(`   - FAILED to remove rewrite ${rewrite.domain}: ${deleteRes.status} ${errorText}`);
                    throw new Error(`Failed to remove rewrite ${rewrite.domain} from replica ${destName}`);
                }
                log(`   - Removed successfully.`);
            }
        }

        for (const masterRewrite of masterRewrites) {
            if (!replicaRewriteMap.has(JSON.stringify(masterRewrite))) {
                log(`   + Adding new rewrite: ${masterRewrite.domain} -> ${masterRewrite.answer}`);
                const addRes = await fetchApi(destinationConnection, 'rewrite/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(masterRewrite),
                });
                if (!addRes.ok) {
                    const errorText = await addRes.text();
                    log(`   + FAILED to add rewrite ${masterRewrite.domain}: ${addRes.status} ${errorText}`);
                    throw new Error(`Failed to add rewrite ${masterRewrite.domain} to replica ${destName}`);
                }
                log(`   + Added successfully.`);
            }
        }
        log(`<- Rewrites sync completed.`);
    } else if (category === 'dnsSettings') {
        log(`-> Fetching DNS settings from master: ${sourceName}`);
        const masterRes = await fetchApi(sourceConnection, 'dns_info');
        if (!masterRes.ok) throw new Error(`Failed to fetch DNS settings from master ${sourceName}`);
        const masterDnsSettings = await masterRes.json();
        log(`<- Fetched DNS settings successfully.`);

        log(`-> Fetching DNS settings from replica: ${destName}`);
        const replicaRes = await fetchApi(destinationConnection, 'dns_info');
        if (!replicaRes.ok) throw new Error(`Failed to fetch DNS settings from replica ${destName}`);
        const replicaDnsSettings = await replicaRes.json();
        log(`<- Fetched replica DNS settings successfully.`);

        // List of DNS settings properties to sync/compare
        const DNS_SETTINGS_PROPERTIES = [
            "upstream_dns",
            "fallback_dns",
            "bootstrap_dns",
            "upstream_mode",
            "upstream_timeout",
            "cache_size",
            "cache_ttl_min",
            "cache_ttl_max",
            "cache_enabled",
            "cache_optimistic",
            "blocking_mode",
            "blocking_ipv4",
            "blocking_ipv6",
            "blocked_response_ttl",
            "dnssec_enabled",
            "disable_ipv6",
            "edns_cs_enabled",
            "edns_cs_use_custom",
            "edns_cs_custom_ip",
            "ratelimit",
            "ratelimit_subnet_subnet_len_ipv4",
            "ratelimit_subnet_subnet_len_ipv6",
            "ratelimit_whitelist",
            "local_ptr_upstreams",
            "use_private_ptr_resolvers",
            "resolve_clients",
        ];

        // Extract the DNS settings that should be synced
        const dnsSettingsToSync = Object.fromEntries(
            DNS_SETTINGS_PROPERTIES.map(key => [key, masterDnsSettings[key]])
        );

        // Check if settings are different
        const replicaDnsSettingsToCompare = Object.fromEntries(
            DNS_SETTINGS_PROPERTIES.map(key => [key, replicaDnsSettings[key]])
        );

        const settingsMatch = JSON.stringify(dnsSettingsToSync) === JSON.stringify(replicaDnsSettingsToCompare);

        if (settingsMatch) {
            log(`-> DNS settings are already in sync, no changes needed.`);
        } else {
            log(`-> DNS settings differ, syncing to replica: ${destName}`);

            // Log specific differences for debugging
            for (const key in dnsSettingsToSync) {
                const masterValue = (dnsSettingsToSync as Record<string, unknown>)[key];
                const replicaValue = (replicaDnsSettingsToCompare as Record<string, unknown>)[key];
                if (JSON.stringify(masterValue) !== JSON.stringify(replicaValue)) {
                    log(`   - ${key}: master=[${masterValue}] replica=[${replicaValue}]`);
                }
            }

            const pushRes = await fetchApi(destinationConnection, 'dns_config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dnsSettingsToSync),
            });

            if (!pushRes.ok) {
                const errorText = await pushRes.text();
                throw new Error(`Failed to push DNS settings to replica ${destName}: ${pushRes.status} ${errorText}`);
            }
            log(`<- DNS settings synced successfully.`);
        }
    } else {
        throw new Error(`Sync for category '${category}' is not yet implemented.`);
    }
}
