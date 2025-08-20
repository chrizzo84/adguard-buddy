import { NextRequest } from "next/server";
import logger from "../logger";

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
};

// Helper to create a streamable response
const createStreamingResponse = (
    cb: (log: (message: string) => void) => Promise<void>
) => {
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            // Unified log function: logs to Winston and to stream
            const log = (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message })}\n\n`));
                if (level === 'info') logger.info(message);
                else if (level === 'warn') logger.warn(message);
                else if (level === 'error') logger.error(message);
            };

            log("SYNC: Process started", 'info');
            try {
                await cb(log);
                log("SYNC: Process finished successfully", 'info');
                log("Done.", 'info');
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : String(e);
                log(`SYNC ERROR: ${message}`, 'error');
                log(`ERROR: ${message}`, 'error');
                console.error("Stream Error:", e);
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
};

const doSync = async (
    log: (message: string) => void,
    sourceConnection: ConnectionDetails,
    destinationConnection: ConnectionDetails,
    category: string
) => {
    const fetchApi = async (conn: ConnectionDetails, endpoint: string, options: RequestInit = {}) => {
        const url = `http://${conn.ip}:${conn.port}/control/${endpoint}`;
        const headers = { ...options.headers, 'Authorization': conn.username ? "Basic " + Buffer.from(`${conn.username}:${conn.password}`).toString("base64") : '' };
        return fetch(url, { ...options, headers });
    };

    log(`Starting sync for category: ${category}`);

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
    } else {
        throw new Error(`Sync for category '${category}' is not yet implemented.`);
    }
}

export async function POST(req: NextRequest) {
    try {
        const {
            sourceConnection,
            destinationConnection,
            category
        } = await req.json();

        if (!sourceConnection || !destinationConnection || !category) {
            return new Response(
                JSON.stringify({ message: "Missing source, destination, or category" }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return createStreamingResponse(async (log) => {
            await doSync(log, sourceConnection, destinationConnection, category);
        });

    } catch (error) {
        let errorMessage = "An unknown error occurred during request setup.";
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        // This part won't stream, it's for initial request parsing errors
        return new Response(
          JSON.stringify({ message: `Internal server error: ${errorMessage}` }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
