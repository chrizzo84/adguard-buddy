
import { NextResponse } from "next/server";
import { promises as fs } from 'fs';
import path from 'path';
import CryptoJS from "crypto-js";
import logger from "../../logger";

// Types
type Connection = {
  ip: string;
  username: string;
  password: string; // encrypted
  port?: number;
};

type TopArrayEntry = { [key: string]: number };

type StatsData = {
  avg_processing_time: number;
  dns_queries: number;
  top_queried_domains: TopArrayEntry[];
  top_blocked_domains: TopArrayEntry[];
  top_clients: TopArrayEntry[];
  top_upstreams_avg_time: TopArrayEntry[];
  top_upstreams_responses: TopArrayEntry[];
};

const dataFilePath = path.join(process.cwd(), '.data', 'connections.json');
const encryptionKey = process.env.NEXT_PUBLIC_ADGUARD_BUDUDY_ENCRYPTION_KEY || "adguard-buddy-key";

async function getConnections(): Promise<Connection[]> {
    try {
        await fs.stat(dataFilePath);
        const fileContent = await fs.readFile(dataFilePath, 'utf-8');
        const data = JSON.parse(fileContent);
        return data.connections || [];
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            return [];
        }
        logger.error(`Failed to read connections file: ${err.message}`);
        throw new Error('Failed to read connections file.');
    }
}

async function fetchStatsForServer(connection: Connection): Promise<StatsData | null> {
    try {
        let decryptedPassword = "";
        try {
            decryptedPassword = CryptoJS.AES.decrypt(connection.password, encryptionKey).toString(CryptoJS.enc.Utf8);
        } catch {
            // Ignore decryption errors for now, maybe the password is not encrypted
        }

        const port = connection.port || 80;
        const statsUrl = `http://${connection.ip}:${port}/control/stats`;
        const headers: Record<string, string> = {};
        if (connection.username && decryptedPassword) {
            headers["Authorization"] = "Basic " + Buffer.from(`${connection.username}:${decryptedPassword}`).toString("base64");
        }

        const response = await fetch(statsUrl, { method: "GET", headers });
        if (!response.ok) {
            logger.warn(`Failed to fetch stats from ${connection.ip}: ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        // AdGuard API returns some fields with num_ prefix, we need to align them with our StatsData type
        return {
            ...data,
            dns_queries: data.num_dns_queries || 0,
        };
    } catch (error) {
        logger.error(`Error fetching stats from ${connection.ip}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

function aggregateStats(statsList: StatsData[]): StatsData {
    const combined: StatsData = {
        avg_processing_time: 0,
        dns_queries: 0,
        top_queried_domains: [],
        top_blocked_domains: [],
        top_clients: [],
        top_upstreams_avg_time: [],
        top_upstreams_responses: [],
    };

    const totalDnsQueries = statsList.reduce((sum, stats) => sum + (stats.dns_queries || 0), 0);
    combined.dns_queries = totalDnsQueries;

    // Weighted average for processing time
    if (totalDnsQueries > 0) {
        const totalProcessingTime = statsList.reduce((sum, stats) => sum + (stats.avg_processing_time * (stats.dns_queries || 0)), 0);
        combined.avg_processing_time = totalProcessingTime / totalDnsQueries;
    }

    const aggregateTopList = (listName: keyof Pick<StatsData, 'top_queried_domains' | 'top_blocked_domains' | 'top_clients' | 'top_upstreams_responses' | 'top_upstreams_avg_time'>) => {
        const map = new Map<string, number>();
        for (const stats of statsList) {
            const list = stats[listName] as TopArrayEntry[] | undefined;
            if (list) {
                for (const entry of list) {
                    const [key, value] = Object.entries(entry)[0];
                    map.set(key, (map.get(key) || 0) + value);
                }
            }
        }
        return Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([key, value]) => ({ [key]: value }));
    };
    
    // For avg_time upstreams, we need to calculate the weighted average
    const aggregateTopListAvg = (listName: keyof Pick<StatsData, 'top_upstreams_avg_time'>) => {
        const timeMap = new Map<string, { totalTime: number, count: number }>();
        const responseMap = new Map<string, number>();

        // First, get total responses for each upstream
        for (const stats of statsList) {
            const responses = stats.top_upstreams_responses as TopArrayEntry[] | undefined;
            if (responses) {
                for (const entry of responses) {
                    const [key, value] = Object.entries(entry)[0];
                    responseMap.set(key, (responseMap.get(key) || 0) + value);
                }
            }
        }

        // Then, calculate weighted average for avg_time
        for (const stats of statsList) {
            const avgTimes = stats[listName] as TopArrayEntry[] | undefined;
            const responses = stats.top_upstreams_responses as TopArrayEntry[] | undefined;
            if (avgTimes && responses) {
                const statResponseMap = new Map(responses.flatMap(e => Object.entries(e)));
                for (const entry of avgTimes) {
                    const [key, avgTime] = Object.entries(entry)[0];
                    const responseCount = statResponseMap.get(key) || 0;
                    const current = timeMap.get(key) || { totalTime: 0, count: 0 };
                    timeMap.set(key, {
                        totalTime: current.totalTime + (avgTime * responseCount),
                        count: current.count + responseCount,
                    });
                }
            }
        }

        return Array.from(timeMap.entries())
            .map(([key, { totalTime, count }]) => ({ [key]: count > 0 ? totalTime / count : 0 }))
            .sort((a, b) => Object.values(b)[0] - Object.values(a)[0]);
    };


    combined.top_queried_domains = aggregateTopList('top_queried_domains');
    combined.top_blocked_domains = aggregateTopList('top_blocked_domains');
    combined.top_clients = aggregateTopList('top_clients');
    combined.top_upstreams_responses = aggregateTopList('top_upstreams_responses');
    combined.top_upstreams_avg_time = aggregateTopListAvg('top_upstreams_avg_time');


    return combined;
}

export async function GET() {
    logger.info("GET /statistics/combined called");
    try {
        const connections = await getConnections();
        if (connections.length === 0) {
            return NextResponse.json({ message: "No connections configured." }, { status: 404 });
        }

        const allStatsPromises = connections.map(fetchStatsForServer);
        const allStatsResults = await Promise.all(allStatsPromises);
        const validStats = allStatsResults.filter((s): s is StatsData => s !== null);

        if (validStats.length === 0) {
            return NextResponse.json({ message: "Could not fetch stats from any server." }, { status: 502 });
        }

        const combinedStats = aggregateStats(validStats);
        logger.info("Successfully fetched and combined statistics.");
        return NextResponse.json(combinedStats);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        logger.error(`Internal server error in /statistics/combined: ${errorMessage}`);
        return new NextResponse(
            JSON.stringify({ message: `Internal server error: ${errorMessage}` }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
