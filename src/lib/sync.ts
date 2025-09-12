import fs from 'fs/promises';
import path from 'path';
import CryptoJS from 'crypto-js';
import { components } from '../types/adguard';
import { httpRequest } from './httpRequest';
import { getConnections } from './connections';
import { getAllSettings } from './settings';

// Types


type FilterListItem = components['schemas']['Filter'];

type SettingsValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: SettingsValue }
  | SettingsValue[]
  | FilterListItem;



type Filter = {
    url: string;
    name: string;
    enabled: boolean;
};

type ConnectionDetails = {
  ip: string;
  port: number;
  username: string;
  password: string;
    url?: string;
    allowInsecure?: boolean;
};

export const areSettingsEqual = (a: SettingsValue, b: SettingsValue): boolean => {
    if (a === b) return true;

    // Treat null and empty array as equivalent, which AdGuard Home sometimes uses interchangeably.
    if ((a === null && Array.isArray(b) && b.length === 0) || (b === null && Array.isArray(a) && a.length === 0)) {
        return true;
    }

    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return a === b;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
        const isFilterList = (arr: SettingsValue[]): arr is FilterListItem[] => {
            if (arr.length === 0) return false; // An empty array could be anything, so we don't use the special logic.
            const item = arr[0];
            // Heuristic: It's a filter list if items have 'url' and 'name'.
            return typeof item === 'object' && item !== null && 'url' in item && 'name' in item;
        };

        if (isFilterList(a) && isFilterList(b)) {
            const toComparableString = (item: FilterListItem) => JSON.stringify({ name: item.name, url: item.url });
            const setA = new Set(a.map(toComparableString));
            const setB = new Set(b.map(toComparableString));

            if (setA.size !== setB.size) return false;
            for (const item of setA) {
                if (!setB.has(item)) return false;
            }
            return true;
        }

        if (a.length !== b.length) return false;

        const sortKey = (arr: SettingsValue[]) => {
            if (arr.length === 0) return arr;
            const item = arr[0];
            if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                if ('id' in item) {
                    return [...arr].sort((x, y) => ((x as { id: number }).id - (y as { id: number }).id));
                }
                if ('url' in item) {
                    return [...arr].sort((x, y) => String((x as { url: string }).url).localeCompare(String((y as { url: string }).url)));
                }
                if ('domain' in item) {
                    return [...arr].sort((x, y) => String((x as { domain: string }).domain).localeCompare(String((y as { domain: string }).domain)));
                }
            }
            return [...arr].sort();
        };

        const sortedA = sortKey(a);
        const sortedB = sortKey(b);

        for (let i = 0; i < sortedA.length; i++) {
            if (!areSettingsEqual(sortedA[i], sortedB[i])) {
                return false;
            }
        }
        return true;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    const IGNORED_COMPARISON_KEYS = ['id', 'last_updated', 'rules_count'];

    for (const key of keysA) {
        if (IGNORED_COMPARISON_KEYS.includes(key)) continue;
        if (!keysB.includes(key) || !areSettingsEqual((a as Record<string, SettingsValue>)[key], (b as Record<string, SettingsValue>)[key])) {
            return false;
        }
    }

    for (const key of keysB) {
        if (IGNORED_COMPARISON_KEYS.includes(key)) continue;
        if (!keysA.includes(key)) return false;
    }

    return true;
};

const logFile = path.join(process.cwd(), 'logs', 'autosync.log');
const encryptionKey = process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY || "adguard-buddy-key";

const fileLogger = async (message: string) => {
    const timestamp = new Date().toISOString();
    await fs.appendFile(logFile, `[${timestamp}] ${message}\n`);
};

const fetchApi = async (conn: ConnectionDetails & { url?: string; allowInsecure?: boolean }, endpoint: string, options: RequestInit = {}) => {
    const protocol = (conn.port === 443 || (conn.url && conn.url.startsWith('https'))) ? 'https' : 'http';
    const base = conn.url && conn.url.length > 0 ? conn.url.replace(/\/$/g, '') : `${protocol}://${conn.ip}:${conn.port}`;
    const url = `${base}/control/${endpoint}`;
    const headers = { ...(options.headers as Record<string,string> || {}), 'Authorization': conn.username ? "Basic " + Buffer.from(`${conn.username}:${conn.password}`).toString("base64") : '' } as Record<string,string>;
    const method = (options.method && (options.method === 'POST' || options.method === 'PUT')) ? String(options.method) : 'GET';
    const r = await httpRequest({ method: method as 'GET' | 'POST' | 'PUT' | 'DELETE', url, headers, body: options.body as string || null, allowInsecure: conn.allowInsecure });
    return { ok: r.statusCode >= 200 && r.statusCode < 300, status: r.statusCode, text: async () => r.body, json: async () => JSON.parse(r.body || '{}') } as Response;
};

export const doSync = async (
    log: (message: string) => void,
    sourceConnection: ConnectionDetails,
    destinationConnection: ConnectionDetails,
    category: string
) => {
    log(`Starting sync for category: ${category} from ${sourceConnection.ip || sourceConnection.url} to ${destinationConnection.ip || destinationConnection.url}`);

    if (category === 'filtering') {
        log(`-> Fetching filtering status from master: ${sourceConnection.ip}`);
        const masterRes = await fetchApi(sourceConnection, 'filtering/status');
        if (!masterRes.ok) throw new Error(`Failed to fetch filtering status from master ${sourceConnection.ip}: ${masterRes.status}`);
        const masterSettings = await masterRes.json();
        log(`<- Successfully fetched settings from master.`);

        log(`-> Fetching filtering status from replica: ${destinationConnection.ip}`);
        const replicaRes = await fetchApi(destinationConnection, 'filtering/status');
        if (!replicaRes.ok) throw new Error(`Failed to fetch filtering status from replica ${destinationConnection.ip}: ${replicaRes.status}`);
        const replicaSettings = await replicaRes.json();
        log(`<- Successfully fetched settings from replica.`);

        log("-> Syncing basic filtering config (enabled status and interval).");
        const configRes = await fetchApi(destinationConnection, 'filtering/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: masterSettings.enabled, interval: masterSettings.interval }),
        });
        if(!configRes.ok) {
            const errorText = await configRes.text();
            throw new Error(`Failed to sync basic filtering config to replica ${destinationConnection.ip}: ${configRes.status} ${errorText}`);
        }
        log("<- Basic config synced.");

        log("-> Syncing user rules.");
        const rulesRes = await fetchApi(destinationConnection, 'filtering/set_rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rules: masterSettings.user_rules }),
        });
        if(!rulesRes.ok) {
            const errorText = await rulesRes.text();
            throw new Error(`Failed to sync user rules to replica ${destinationConnection.ip}: ${rulesRes.status} ${errorText}`);
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
                        throw new Error(`Failed to remove filter ${filter.url} from replica ${destinationConnection.ip}`);
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
                        throw new Error(`Failed to add filter ${masterFilter.url} to replica ${destinationConnection.ip}`);
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
                            throw new Error(`Failed to update filter ${masterFilter.url} on replica ${destinationConnection.ip}`);
                        }
                        log(`   * Updated successfully.`);
                    }
                }
            }
            log(`<- ${listType} filters sync completed.`);
        };


        await syncFilterList(masterSettings.filters, replicaSettings.filters, false);
        await syncFilterList(masterSettings.whitelist_filters, replicaSettings.whitelist_filters, true);

    } else if (category === 'querylogConfig' || category === 'statsConfig') {
        const getConfigEndpoint = category === 'querylogConfig' ? 'querylog/config' : 'stats/config';
        const setConfigEndpoint = category === 'querylogConfig' ? 'querylog/config/update' : 'stats/config/update';

        log(`-> Fetching ${category} from master: ${sourceConnection.ip}`);
        const masterRes = await fetchApi(sourceConnection, getConfigEndpoint);
        if (!masterRes.ok) throw new Error(`Failed to fetch ${category} from master ${sourceConnection.ip}`);
        const masterConfig = await masterRes.json();
        log(`<- Fetched ${category} successfully.`);

        log(`-> Pushing ${category} to replica: ${destinationConnection.ip}`);
        const replicaRes = await fetchApi(destinationConnection, setConfigEndpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(masterConfig),
        });

        if (!replicaRes.ok) {
            const errorText = await replicaRes.text();
            throw new Error(`Failed to push ${category} to replica ${destinationConnection.ip}: ${replicaRes.status} ${errorText}`);
        }
        log(`<- ${category} synced successfully.`);
    } else if (category === 'accessList') {
        log(`-> Fetching ${category} from master: ${sourceConnection.ip}`);
        const masterRes = await fetchApi(sourceConnection, 'access/list');
        if (!masterRes.ok) throw new Error(`Failed to fetch ${category} from master ${sourceConnection.ip}`);
        const masterConfig = await masterRes.json();
        log(`<- Fetched ${category} successfully.`);

        log(`-> Pushing ${category} to replica: ${destinationConnection.ip}`);
        const replicaRes = await fetchApi(destinationConnection, 'access/set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(masterConfig),
        });

        if (!replicaRes.ok) {
            const errorText = await replicaRes.text();
            throw new Error(`Failed to push ${category} to replica ${destinationConnection.ip}: ${replicaRes.status} ${errorText}`);
        }
        log(`<- ${category} synced successfully.`);
    } else if (category === 'blockedServices') {
        log(`-> Fetching ${category} from master: ${sourceConnection.ip}`);
        const masterRes = await fetchApi(sourceConnection, 'blocked_services/get');
        if (!masterRes.ok) throw new Error(`Failed to fetch ${category} from master ${sourceConnection.ip}`);
        const masterConfig = await masterRes.json();
        log(`<- Fetched ${category} successfully.`);

        log(`-> Pushing ${category} to replica: ${destinationConnection.ip}`);
        const replicaRes = await fetchApi(destinationConnection, 'blocked_services/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(masterConfig),
        });

        if (!replicaRes.ok) {
            const errorText = await replicaRes.text();
            throw new Error(`Failed to push ${category} to replica ${destinationConnection.ip}: ${replicaRes.status} ${errorText}`);
        }
        log(`<- ${category} synced successfully.`);
    } else if (category === 'rewrites') {
        log(`-> Fetching rewrites from master: ${sourceConnection.ip}`);
        const masterRes = await fetchApi(sourceConnection, 'rewrite/list');
        if (!masterRes.ok) throw new Error(`Failed to fetch rewrites from master ${sourceConnection.ip}`);
        const masterRewrites = await masterRes.json() as components['schemas']['RewriteList'];
        log(`<- Fetched rewrites successfully.`);

        log(`-> Fetching rewrites from replica: ${destinationConnection.ip}`);
        const replicaRes = await fetchApi(destinationConnection, 'rewrite/list');
        if (!replicaRes.ok) throw new Error(`Failed to fetch rewrites from replica ${destinationConnection.ip}`);
        const replicaRewrites = await replicaRes.json() as components['schemas']['RewriteList'];
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
                    throw new Error(`Failed to remove rewrite ${rewrite.domain} from replica ${destinationConnection.ip}`);
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
                    throw new Error(`Failed to add rewrite ${masterRewrite.domain} to replica ${destinationConnection.ip}`);
                }
                log(`   + Added successfully.`);
            }
        }
        log(`<- Rewrites sync completed.`);
    } else {
        throw new Error(`Sync for category '${category}' is not yet implemented.`);
    }
}

export const syncAll = async (log = fileLogger) => {
    const runId = Date.now().toString(36);
    const baseLogger = log;
    const logWithRun = async (message: string) => baseLogger(`[run:${runId}] ${message}`);
    await logWithRun('Autosync started.');

    const { connections, masterServerIp } = await getConnections();

    if (!connections || !masterServerIp) {
        await log('Master server or connections not configured.');
        await log('Autosync finished.');
        return;
    }

    type BasicConnection = { ip?: string; url?: string; port: number; username: string; password: string; allowInsecure?: boolean };
    const masterConn = (connections as BasicConnection[]).find(c => (c.url && c.url.replace(/\/$/g, '') === masterServerIp) || c.ip === masterServerIp);
    if (!masterConn) {
        await log('Master server not found in connections list.');
        await log('Autosync finished.');
        return;
    }

    // A replica is any connection that is NOT the master. The previous implementation used an 'AND'
    // between url and ip comparisons which caused IP-only replicas (without a url field) to be excluded,
    // because the first clause (c.url && ...) evaluated to falsy and thus the whole condition failed.
    // We instead exclude a connection only if it matches the master by IP or by normalized URL.
    const replicaConns = (connections as BasicConnection[]).filter(c => !(
        (c.url && c.url.replace(/\/$/g, '') === masterServerIp) ||
        c.ip === masterServerIp
    ));

    if (replicaConns.length === 0) {
        await log('No replica servers found.');
        await log('Autosync finished.');
        return;
    }

    await log(`Master server: ${masterConn.ip || masterConn.url}`);
    await logWithRun(`Found ${replicaConns.length} replica server(s).`);

    const masterConnWithDecryptedPassword = {
        ...masterConn,
        password: CryptoJS.AES.decrypt(masterConn.password, encryptionKey).toString(CryptoJS.enc.Utf8)
    };
    const masterSettingsResult = await getAllSettings(masterConnWithDecryptedPassword);
    const masterSettings = masterSettingsResult.settings;

    const SYNCABLE_KEYS = ['filtering', 'querylogConfig', 'statsConfig', 'rewrites', 'blockedServices', 'accessList'];

    // Helper to create a logger scoped to a replica (adds replica tag)
    const makeReplicaLogger = (replicaLabel: string) => async (msg: string) => {
        await baseLogger(`[run:${runId}] [replica:${replicaLabel}] ${msg}`);
    };
    // Helper to create a logger scoped to category within a replica
    const makeCategoryLogger = (replicaLabel: string, category: string) => async (msg: string) => {
        await baseLogger(`[run:${runId}] [replica:${replicaLabel}] [cat:${category}] ${msg}`);
    };

    for (let idx = 0; idx < replicaConns.length; idx++) {
        const replica = replicaConns[idx];
        const replicaLabel = String(replica.ip || replica.url);
        const rLog = makeReplicaLogger(replicaLabel);
        await rLog(`===== Replica ${idx + 1}/${replicaConns.length} START (${replicaLabel}) =====`);
        const replicaWithDecryptedPassword = {
            ...replica,
            password: CryptoJS.AES.decrypt(replica.password, encryptionKey).toString(CryptoJS.enc.Utf8)
        };
        const replicaSettingsResult = await getAllSettings(replicaWithDecryptedPassword);
        const replicaSettings = replicaSettingsResult.settings;

        const differences = SYNCABLE_KEYS.filter(key => {
            const m = masterSettings[key] as unknown as SettingsValue;
            const r = replicaSettings[key] as unknown as SettingsValue;
            return !areSettingsEqual(m, r);
        });

        if (differences.length === 0) {
            await rLog('Replica is in sync with master.');
        } else {
            await rLog(`Found ${differences.length} categories to sync: ${differences.join(', ')}`);
        }

        for (const category of differences) {
            const cLog = makeCategoryLogger(replicaLabel, category);
            await cLog('--- CATEGORY START ---');
            const catStart = Date.now();
            const sourceDecrypted = CryptoJS.AES.decrypt(masterConn.password, encryptionKey).toString(CryptoJS.enc.Utf8);
            const destDecrypted = CryptoJS.AES.decrypt(replica.password, encryptionKey).toString(CryptoJS.enc.Utf8);

            try {
                const masterForSync = { ...masterConn, ip: String(masterConn.ip || ''), password: sourceDecrypted } as unknown as { ip: string; port: number; username: string; password: string; url?: string; allowInsecure?: boolean };
                const replicaForSync = { ...replica, ip: String(replica.ip || ''), password: destDecrypted } as unknown as { ip: string; port: number; username: string; password: string; url?: string; allowInsecure?: boolean };
                await doSync(cLog, masterForSync, replicaForSync, category);
                const dur = Date.now() - catStart;
                await cLog(`SUCCESS in ${dur}ms`);
            } catch (error) {
                const err = error as Error;
                const dur = Date.now() - catStart;
                await cLog(`FAIL after ${dur}ms: ${err.message}`);
            }
            await cLog('--- CATEGORY END ---');
        }
        await rLog(`===== Replica ${idx + 1}/${replicaConns.length} END (${replicaLabel}) =====`);
    }

    await logWithRun('Autosync finished.');
};
